import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Portal redesign (2026-11-22): 4 action-first tabs. Self-contained fixtures,
// FULL cleanup in finally (owner: Neon free tier — no test residue). Runs in
// the mutations project so portal fixtures never race public-page specs.
async function login(page) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${instructor}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/portal')}&token=${raw}&email=${encodeURIComponent(instructor)}`);
  await page.waitForURL('**/portal');
  return token;
}

test('Portal tabs: grouping, filters, caps, Withdraw, Received one-click, UUID-free labels, EN/CN', async ({ page }) => {
  test.setTimeout(120_000);
  const prefix = 'PT-' + randomUUID().slice(0, 8);
  const email = prefix.toLowerCase() + '@example.com';
  const statuses = ['awaiting_deposit', 'awaiting_deposit', 'payment_claimed', 'confirmed', 'completed', 'cancelled'];
  const bids = statuses.map((_, i) => `${prefix}-B${i}`);
  const decl = { certAgency: 'PADI', certLevel: 'Open Water', agencyOther: '', levelOther: '', loggedDives: 15, insurance: true, medical: false, emergencyName: 'Test Contact', emergencyPhone: '+60123456789', dob: '1990-01-01', whatsapp: null, locale: 'en' };
  const eq = { choices: { mask: 'own', snorkel: 'own', fins: 'rent', boots: 'rent', wetsuit: 'rent', bcd: 'rent', regulator: 'own', computer: 'own', smb: 'rent', torch: 'none', camera: 'none', other: 'none' }, wetsuit: 'M', bcd: 'L', footwear: '42', footwearUnit: 'EU', fitNote: '', otherNote: '' };
  await sql`INSERT INTO customers (id, name, email, locale) VALUES (${prefix}, ${prefix}, ${email}, 'en')`;
  for (let i = 0; i < statuses.length; i++) {
    await sql`INSERT INTO bookings (id, customer_id, product_type, product_id, status, eligibility_status, deposit_amount, balance_amount, currency, declarations, equipment) VALUES (${bids[i]}, ${prefix}, 'trip', 'TRP-004', ${statuses[i]}, 'approved', '360.00', '840.00', 'MYR', ${JSON.stringify(decl)}::json, ${JSON.stringify(eq)}::json)`;
  }
  await sql`INSERT INTO payment_claims (id, booking_id, amount, currency, paid_on, reference, kind, status, operation_key) VALUES (${prefix + '-C'}, ${bids[2]}, '360.00', 'MYR', ${new Date(Date.now() - 86400000).toISOString()}, ${bids[2]}, 'deposit', 'pending', ${prefix + '-op'})`;
  const token = await login(page);

  try {
    // Default tab = Actions; tab bar with icons + badges.
    await expect(page.locator('#portal-tab-actions')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#portal-tab-actions .portal-tab-count')).toBeVisible();
    await expect(page.locator('#verify')).toContainText(prefix);
    // Queue row shows the booking ref ONCE (reference === booking id by design).
    const rowText = await page.locator('#verify .portal-row', { hasText: prefix }).first().textContent();
    expect(rowText.split(bids[2]).length - 1).toBe(1);

    // One-click Received on a booking request (seamless flow S1).
    const reqCard = page.locator('.portal-request', { hasText: bids[0] });
    await expect(reqCard).toBeVisible();
    await expect(reqCard).toContainText('MYR 360.00');
    await reqCard.locator('button', { hasText: 'Received' }).click();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id = ${bids[0]}`)[0].status).toBe('confirmed');
    // TRP-004's balance due date has passed — the card flips to the balance.
    await expect(page.locator('.portal-request', { hasText: bids[0] })).toContainText('MYR 840.00', { timeout: 15000 });

    // Bookings: filters, cap + show-all, human declaration labels.
    await page.locator('#portal-tab-bookings').click();
    await expect(page.locator('#bookings')).toBeVisible();
    const activeRows = await page.locator('#portal-panel-bookings .portal-booking-compact').count();
    expect(activeRows).toBeLessThanOrEqual(10);
    await page.locator('.kind-pill', { hasText: 'All' }).click();
    await expect(page.locator('#portal-panel-bookings .portal-show-all')).toBeVisible();
    await page.locator('#portal-panel-bookings .portal-show-all').click();
    expect(await page.locator('#portal-panel-bookings .portal-booking-compact').count()).toBeGreaterThan(activeRows);
    await page.locator('.kind-pill', { hasText: 'Past' }).click();
    const pastText = await page.locator('#bookings').textContent();
    expect(pastText).toContain('Completed');
    expect(pastText).not.toContain('Awaiting deposit');
    await page.locator('.kind-pill', { hasText: 'All' }).click();
    if (await page.locator('#portal-panel-bookings .portal-show-all').isVisible()) await page.locator('#portal-panel-bookings .portal-show-all').click();
    await page.locator(`#booking-${bids[0]} summary`).click();
    const declText = await page.locator(`#booking-${bids[0]} .portal-declarations-grid`).textContent();
    expect(declText).toContain('Certification agency');
    expect(declText).toContain('Emergency contact');
    expect(declText).not.toContain('certAgency');

    // Withdraw (owner 2026-11-22: replaces eligibility approve/decline).
    // Unpaid booking → cancelled; paid booking → refund review.
    await page.locator(`#booking-${bids[1]} .portal-withdraw button`).click();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id = ${bids[1]}`)[0].status).toBe('cancelled');
    await page.locator(`#booking-${bids[0]} .portal-withdraw button`).click();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id = ${bids[0]}`)[0].status).toBe('refund_flagged');
    const withdrawnAudits = await sql`SELECT action FROM audit_log WHERE entity_id = ANY(${[bids[0], bids[1]]}) AND action = 'booking_withdrawn'`;
    expect(withdrawnAudits.length).toBe(2);

    // Money: receipt from the verify act; refund picker never shows UUIDs.
    await page.locator('#portal-tab-money').click();
    await expect(page.locator('.portal-receipts')).toContainText(bids[0]);
    const options = await page.locator('select[name=paymentId] option').allTextContents();
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) expect(o).not.toMatch(UUID_RE);
    await expect(page.locator('#points tbody tr').first()).toBeVisible();

    // Manage sections reachable.
    await page.locator('#portal-tab-manage').click();
    await expect(page.locator('#trips')).toBeVisible();
    await expect(page.locator('#policies')).toBeVisible();
    await expect(page.locator('#settings')).toBeVisible();

    // Keyboard navigation + deep link.
    await page.locator('#portal-tab-actions').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#portal-tab-bookings')).toHaveAttribute('aria-selected', 'true');
    await page.goto('/contact');
    await page.goto('/portal#points');
    await expect(page.locator('#portal-tab-money')).toHaveAttribute('aria-selected', 'true');

    // EN purity + layout across tabs; then CN.
    for (const tab of ['actions', 'bookings', 'money', 'manage']) {
      await page.locator(`#portal-tab-${tab}`).click();
      const m = await page.evaluate((tabId) => {
        const panel = document.getElementById(`portal-panel-${tabId}`);
        const hiddenByDetails = el => { let cur = el; while (cur && cur !== panel) { if (cur.tagName === 'DETAILS' && !cur.open) { const s = cur.querySelector(':scope > summary'); if (!s || !s.contains(el)) return true; } cur = cur.parentElement; } return false; };
        const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT); let n; const cjk = [];
        while ((n = walker.nextNode())) {
          const el = n.parentElement;
          if (!el || el.closest('[data-lang-toggle]') || el.tagName === 'SCRIPT' || el.offsetParent === null || hiddenByDetails(el)) continue;
          if (/[\u4e00-\u9fff]/.test(n.textContent)) cjk.push(n.textContent.trim().slice(0, 30));
        }
        const controls = [...panel.querySelectorAll('button, a.btn, select, input:not([type=hidden])')].filter(el => el.getBoundingClientRect().height > 0);
        const small = controls.filter(el => el.getBoundingClientRect().height < 44 || el.getBoundingClientRect().width < 44).length;
        return { cjk, small, overflow: document.documentElement.scrollWidth > window.innerWidth };
      }, tab);
      expect(m.cjk, `CJK leak in ${tab}`).toEqual([]);
      expect(m.small, `small targets in ${tab}`).toBe(0);
      expect(m.overflow, `overflow in ${tab}`).toBe(false);
    }
    await page.locator('[data-lang-toggle]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    await page.locator('#portal-tab-actions').click();
    await expect(page.locator('#portal-tab-actions')).toContainText('待办事项');
    await expect(page.locator('#requests h2')).toHaveText('预订请求');
    await expect(page.locator('main.portal h1')).toHaveText('教练工作台');
  } finally {
    const claimIds = (await sql`SELECT id FROM payment_claims WHERE booking_id = ANY(${bids})`).map(r => r.id);
    const payIds = (await sql`SELECT id FROM payments WHERE booking_id = ANY(${bids})`).map(r => r.id);
    const auditIds = [...bids, ...claimIds, ...payIds, prefix];
    await sql`DELETE FROM audit_log WHERE entity_id = ANY(${auditIds})`;
    await sql`DELETE FROM points_ledger WHERE booking_id = ANY(${bids}) OR customer_id = ${prefix}`;
    await sql`DELETE FROM payments WHERE booking_id = ANY(${bids})`;
    await sql`DELETE FROM payment_claims WHERE booking_id = ANY(${bids})`;
    await sql`DELETE FROM bookings WHERE id = ANY(${bids})`;
    await sql`DELETE FROM customers WHERE id = ${prefix}`;
    await sql`DELETE FROM verification_tokens WHERE identifier = ${instructor} AND token = ${token}`;
  }
});
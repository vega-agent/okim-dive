import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();

// Seamless journey (S1–S5): booking request → Received one-click → confirmation;
// extend/release; lazy sweep expiry; trip-level completion; Register interest;
// wizard hold + prompt email. Self-contained fixtures, FULL cleanup in finally
// (owner: Neon free tier — zero residue). Email sends are ATTEMPTS to
// @example.com fixtures (API-rejected by Resend, zero quota); audits record the attempt.
async function login(page, email, target) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100' + target)}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL(`**${target}`);
  return token;
}

test('Seamless flow: request→Received, escape hatch, extend/release, sweep, completion, interest, wizard hold', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const prefix = 'SF-' + randomUUID().slice(0, 8);
  const email = prefix.toLowerCase() + '@example.com';
  const tripId = prefix + '-trip';
  const bids = [0, 1, 2, 3, 4].map(i => `${prefix}-B${i}`);
  const decl = { certAgency: 'PADI', certLevel: 'Open Water', agencyOther: '', levelOther: '', loggedDives: 15, insurance: true, medical: false, emergencyName: 'Test Contact', emergencyPhone: '+60123456789', dob: '1990-01-01', whatsapp: null, locale: 'en' };
  const eq = { choices: Object.fromEntries(['mask', 'snorkel', 'fins', 'boots', 'wetsuit', 'bcd', 'regulator', 'computer', 'smb', 'torch', 'camera', 'other'].map(id => [id, 'own'])), wetsuit: 'M', bcd: 'L', footwear: '42', footwearUnit: 'EU', fitNote: '', otherNote: '' };
  const future = new Date(Date.now() + 14 * 86400000).toISOString();
  const past = new Date(Date.now() - 6 * 86400000).toISOString();
  const mkBooking = (id, trip, status, hold, elig = 'approved') => sql`INSERT INTO bookings (id, customer_id, product_type, product_id, status, eligibility_status, deposit_amount, balance_amount, currency, declarations, equipment, created_at, hold_expires_at) VALUES (${id}, ${prefix}, 'trip', ${trip}, ${status}, ${elig}, '360.00', '840.00', 'MYR', ${JSON.stringify(decl)}::json, ${JSON.stringify(eq)}::json, ${new Date(Date.now() - 2 * 86400000).toISOString()}, ${hold})`;

  await sql`INSERT INTO customers (id, name, email, locale) VALUES (${prefix}, ${prefix}, ${email}, 'en')`;
  await sql`INSERT INTO trips (id, slug, title_en, title_zh, status, published, price_amount, deposit_value, capacity, travel_start, travel_end, sample, departure_timezone) VALUES (${tripId}, ${prefix.toLowerCase()}, 'Seamless fixture', '无缝测试', 'open', true, 100, 30, 1, ${new Date(Date.now() + 10 * 86400000).toISOString()}, ${new Date(Date.now() + 12 * 86400000).toISOString()}, true, 'Asia/Kuala_Lumpur')`;
  await mkBooking(bids[0], 'TRP-004', 'awaiting_deposit', future);
  await mkBooking(bids[1], 'TRP-004', 'awaiting_deposit', future);
  await mkBooking(bids[2], 'TRP-004', 'awaiting_deposit', past);
  await mkBooking(bids[3], 'TRP-DEMO-01', 'confirmed', null);
  await mkBooking(bids[4], tripId, 'awaiting_deposit', future);
  const tokens = [await login(page, instructor, '/portal')];

  try {
    // --- Request card: expected deposit pre-filled, one-click Received ---
    const card = page.locator('.portal-request', { hasText: bids[0] });
    await expect(card).toBeVisible();
    await expect(card).toContainText('MYR 360.00');
    await expect(card).toContainText('days left');
    await card.locator('button', { hasText: 'Received' }).click();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id = ${bids[0]}`)[0].status).toBe('confirmed');
    const [pay] = await sql`SELECT id, receipt_no, amount FROM payments WHERE booking_id = ${bids[0]}`;
    expect(pay.amount).toBe('360.00');
    expect(pay.receipt_no).toMatch(/^RCT-/);
    const earnings = await sql`SELECT points FROM points_ledger WHERE booking_id = ${bids[0]} AND type = 'earned'`;
    expect(earnings).toEqual([]);
    const audits = await sql`SELECT action FROM audit_log WHERE entity_id = ${pay.id} OR entity_id IN (SELECT id FROM payment_claims WHERE booking_id = ${bids[0]})`;
    expect(audits.map(a => a.action)).toEqual(expect.arrayContaining(['payment_recorded', 'payment_verified']));
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id = ${bids[0]} AND action = 'booking_confirmed_notified'`)[0].n).toBe(1);

    // --- Escape hatch: balance due (TRP-004 balance date passed), partial 100 ---
    const balCard = page.locator('.portal-request', { hasText: bids[0] });
    await expect(balCard).toBeVisible();
    await expect(balCard).toContainText('MYR 840.00');
    await balCard.locator('summary', { hasText: 'Different amount' }).click();
    await balCard.locator('input[name=amount]').fill('100');
    await balCard.locator('input[name=paidOn]').fill(new Date().toISOString().slice(0, 10));
    await balCard.locator('button', { hasText: 'Confirm this amount' }).click();
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM payments WHERE booking_id = ${bids[0]}`)[0].n).toBe(2);

    // --- Extend then Release (unpaid) ---
    const relCard = page.locator('.portal-request', { hasText: bids[1] });
    await relCard.locator('button[name=days][value="7"]').click();
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id = ${bids[1]} AND action = 'hold_extended'`)[0].n).toBe(1);
    await relCard.locator('summary', { hasText: 'Release slot' }).click();
    await relCard.locator('input[name=reason]').fill('Diver withdrew (test)');
    await relCard.locator('button', { hasText: 'Release and email' }).click();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id = ${bids[1]}`)[0].status).toBe('cancelled');
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id = ${bids[1]} AND action = 'hold_release_notified'`)[0].n).toBe(1);

    // --- Lazy sweep: expired hold released on portal load (B2 hold in past) ---
    await page.reload();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id = ${bids[2]}`)[0].status).toBe('expired');
    const expiryAudits = await sql`SELECT action FROM audit_log WHERE entity_id = ${bids[2]}`;
    expect(expiryAudits.map(a => a.action)).toEqual(expect.arrayContaining(['hold_expired', 'hold_expiry_notified']));

    // --- Explicit individual completion; never bulk-complete demo bookings ---
    await page.locator('#portal-tab-bookings').click();
    await page.getByRole('radio', { name: 'All', exact: true }).check();
    const completionRow = page.locator(`#booking-${bids[3]}`);
    await completionRow.locator('input[name=participated]').check();
    await completionRow.getByRole('button', { name: 'Complete individual booking' }).click();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id = ${bids[3]}`)[0].status).toBe('completed');

    // --- Register interest on the full fixture trip (public) ---
    await page.goto(`/trips/${prefix.toLowerCase()}`);
    await expect(page.locator('.trip-interest')).toBeVisible();
    await page.locator('.trip-interest input[name=name]').fill(prefix + ' Interested');
    await page.locator('.trip-interest input[name=email]').fill(prefix.toLowerCase() + '-interest@example.com');
    await page.locator('.trip-interest input[name=consent]').check();
    await page.locator('.trip-interest button[type=submit], .trip-interest .btn-primary').click();
    await page.waitForURL('**interest=registered');
    await expect(page.locator('[role=status]')).toContainText('Interest registered');
    const [interest] = await sql`SELECT interest_detail, trip_id FROM inquiries WHERE email = ${prefix.toLowerCase() + '-interest@example.com'}`;
    expect(interest.interest_detail).toBe('waitlist');
    expect(interest.trip_id).toBe(tripId);

    // --- Wizard: booking creates a 14-day hold + prompt email attempt ---
    // Name travels via the signup stash (product flow); sign-in provisions a
    // separate CUS-xxx customer for this email — cleaned up in finally.
    const email2 = prefix.toLowerCase() + '-diver@example.com';
    await sql`INSERT INTO signup_names (email, name, created_at) VALUES (${email2}, ${prefix + ' Diver'}, ${new Date().toISOString()})`;
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    tokens.push(await login(p2, email2, `/book/${prefix.toLowerCase()}`));
    // fixture trip is full (1/1) — wizard must refuse with trip_full
    await p2.locator('select[name=cert_agency]').selectOption('PADI');
    await p2.locator('select[name=cert_level]').selectOption('Open Water');
    await p2.locator('#b-dives').fill('15');
    await p2.locator('#b-name').fill(prefix + ' Diver');
    await p2.locator('#b-emergency-name').fill('Contact');
    await p2.locator('#b-emergency-phone').fill('12345');
    await p2.locator('#b-dob').fill('1990-01-01');
    await p2.locator('input[name=insurance]').check();
    await p2.locator('input[name=medical]').check();
    await p2.locator('input[name=accept_policy]').check();
    await p2.getByRole('button', { name: 'Bring all', exact: true }).click();
    await p2.getByRole('button', { name: 'Create booking', exact: true }).click();
    await expect(p2.locator('p[role=alert].form-status-error')).toContainText('full', { timeout: 15000 });
    // book TRP-004 instead (has capacity): hold + prompt email
    await p2.goto('/book/tioman-reef-weekend');
    await p2.locator('select[name=cert_agency]').selectOption('PADI');
    await p2.locator('select[name=cert_level]').selectOption('Open Water');
    await p2.locator('#b-dives').fill('15');
    await p2.locator('#b-name').fill(prefix + ' Diver');
    await p2.locator('#b-emergency-name').fill('Contact');
    await p2.locator('#b-emergency-phone').fill('12345');
    await p2.locator('#b-dob').fill('1990-01-01');
    await p2.locator('input[name=insurance]').check();
    await p2.locator('input[name=medical]').check();
    await p2.locator('input[name=accept_policy]').check();
    await p2.getByRole('button', { name: 'Bring all', exact: true }).click();
    await p2.getByRole('button', { name: 'Create booking', exact: true }).click();
    await expect(p2.locator('.booking-id')).toBeVisible({ timeout: 20000 });
    const newBkg = (await p2.locator('.booking-id').textContent()).trim();
    await expect(p2.locator('dl.booking-summary')).toContainText('Transfer deposit by');
    const [held] = await sql`SELECT hold_expires_at, status FROM bookings WHERE id = ${newBkg}`;
    expect(held.status).toBe('awaiting_deposit');
    expect(new Date(held.hold_expires_at).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000);
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id = ${newBkg} AND action = 'deposit_prompt_notified'`)[0].n).toBe(1);
    await ctx2.close();

    // --- EN purity on Actions (CN toggle spot check) ---
    await page.goto('/portal');
    await page.locator('.portal-tabs').waitFor();
    await page.locator('#portal-tab-actions').click();
    const cjk = await page.evaluate(() => {
      const panel = document.getElementById('portal-panel-actions');
      const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT); let n; const bad = [];
      while ((n = walker.nextNode())) {
        const el = n.parentElement;
        if (!el || el.closest('[data-lang-toggle]') || el.tagName === 'SCRIPT' || el.offsetParent === null) continue;
        if (/[\u4e00-\u9fff]/.test(n.textContent)) bad.push(n.textContent.trim().slice(0, 30));
      }
      return bad;
    });
    expect(cjk).toEqual([]);
    await page.locator('[data-lang-toggle]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    await expect(page.locator('#requests h2')).toHaveText('预订请求');
    await expect(page.locator('.portal-request .btn-primary').first()).toHaveText('确认到账');
  } finally {
    const wizCus = (await sql`SELECT id FROM customers WHERE email = ${prefix.toLowerCase() + '-diver@example.com'}`).map(r => r.id);
    const cusIds = [prefix, ...wizCus];
    const allBids = [...bids];
    const extra = await sql`SELECT id FROM bookings WHERE customer_id = ANY(${cusIds})`;
    for (const r of extra) allBids.push(r.id);
    const claimIds = (await sql`SELECT id FROM payment_claims WHERE booking_id = ANY(${allBids})`).map(r => r.id);
    const payIds = (await sql`SELECT id FROM payments WHERE booking_id = ANY(${allBids})`).map(r => r.id);
    const auditIds = [...allBids, ...claimIds, ...payIds, ...cusIds, tripId];
    await sql`DELETE FROM audit_log WHERE entity_id = ANY(${auditIds})`;
    await sql`DELETE FROM points_ledger WHERE booking_id = ANY(${allBids}) OR customer_id = ANY(${cusIds})`;
    await sql`DELETE FROM payments WHERE booking_id = ANY(${allBids})`;
    await sql`DELETE FROM payment_claims WHERE booking_id = ANY(${allBids})`;
    await sql`DELETE FROM invoices WHERE booking_id = ANY(${allBids})`;
    await sql`DELETE FROM bookings WHERE id = ANY(${allBids})`;
    await sql`DELETE FROM customers WHERE id = ANY(${cusIds})`;
    await sql`DELETE FROM signup_names WHERE email LIKE ${prefix.toLowerCase() + '%'}`;
    await sql`DELETE FROM inquiries WHERE email LIKE ${prefix.toLowerCase() + '%'}`;
    await sql`DELETE FROM trips WHERE id = ${tripId}`;
    await sql`DELETE FROM verification_tokens WHERE token = ANY(${tokens})`;
  }
});
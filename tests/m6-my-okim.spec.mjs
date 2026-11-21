import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const actions = {};

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL('**/trips');
  await page.request.get('/api/auth/session');
}

async function call(page, name, fields) {
  await page.goto('/portal');
  const ids = await page.locator('form').evaluateAll(forms => forms.map(f => ({ text: f.textContent, id: [...f.querySelectorAll('input')].find(i => i.name.startsWith('$ACTION_ID_'))?.name.slice(11) })));
  const labels = { recordPayment: 'Record payment', verifyPayment: 'Verify against bank record', refundPayment: 'Record completed external refund', redeemPoints: 'Apply points before payment', completeBooking: 'Record trip completion', reviewEligibility: 'Approve eligibility' };
  const id = ids.find(f => f.text.includes(labels[name]))?.id || actions[name];
  expect(id, `compiled reference for ${name}`).toBeTruthy();
  actions[name] = id;
  return page.request.post('/portal', { headers: { Origin: 'http://localhost:3100' }, multipart: { [`$ACTION_ID_${id}`]: '', ...fields } });
}

async function fixture(page) {
  const prefix = `M6-${randomUUID()}`;
  const email = `${prefix.toLowerCase()}@example.invalid`;
  await login(page, email);
  const [customer] = await sql`SELECT id FROM customers WHERE email = ${email}`;
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  await login(page, instructor);
  const trip = `${prefix}-trip`;
  await sql`INSERT INTO trips (id, slug, title_en, title_zh, status, price_amount, deposit_value, capacity, travel_start, travel_end, sample) VALUES (${trip}, ${trip.toLowerCase()}, 'Fictional transaction test', 'Fictional transaction test', 'open', 100, 30, 1, ${new Date(Date.now()+86400000*10).toISOString()}, ${new Date(Date.now()+86400000*12).toISOString()}, true)`;
  let sequence = 0;
  const booking = async (status = 'awaiting_deposit', customerId = customer.id) => {
    const id = `${prefix}-b${++sequence}`;
    await sql`INSERT INTO bookings (id, customer_id, product_id, status, currency, deposit_amount, balance_amount, declarations) VALUES (${id}, ${customerId}, ${trip}, ${status}, 'MYR', 30, 70, '{}')`;
    await sql`INSERT INTO invoices (id, booking_id, number) VALUES (${id}, ${id}, ${id})`;
    return id;
  };
  const pay = async (id, amount, kind = 'deposit') => {
    await call(page, 'recordPayment', { bookingId: id, amount: String(amount), currency: 'MYR', kind, reference: id, paidOn: '2026-01-01', operationKey: randomUUID() });
    const [claim] = await sql`SELECT id FROM payment_claims WHERE booking_id = ${id} AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1`;
    expect(claim).toBeTruthy();
    await call(page, 'verifyPayment', { claimId: claim.id });
    return `PAY-${claim.id}`;
  };
  const extraEmails = [];
  const cleanup = async () => {
    await sql`DELETE FROM audit_log WHERE entity_id IN (SELECT id FROM payments WHERE booking_id LIKE ${prefix+'%'} UNION SELECT id FROM payment_claims WHERE booking_id LIKE ${prefix+'%'} UNION SELECT id FROM bookings WHERE id LIKE ${prefix+'%'})`;
    await sql`DELETE FROM points_ledger WHERE customer_id = ${customer.id} OR booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM payments WHERE booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM payment_claims WHERE booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM invoices WHERE booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM bookings WHERE id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM trips WHERE id = ${trip}`;
    await sql`DELETE FROM customers WHERE id = ${customer.id} OR id = ${prefix+'-rival'}`;
    for (const e of [email, ...extraEmails]) {
      await sql`DELETE FROM customers WHERE email = ${e}`;
      await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${e})`;
      await sql`DELETE FROM verification_tokens WHERE identifier = ${e}`;
      await sql`DELETE FROM users WHERE email = ${e}`;
    }
  };
  return { prefix, email, customer: customer.id, trip, booking, pay, instructor, extraEmails, cleanup };
}

const openTab = (page, name) => page.getByRole('tab', { name }).click();
const stats = page => page.locator('.my-stat').evaluateAll(els => els.map(e => ({ label: e.querySelector('.my-stat-label').textContent, value: e.querySelector('.my-stat-value').textContent })));

test('M6 My Okim: auth gate, read-only upcoming bookings, invoice/receipt links, no rival data', async ({ page, browser }) => {
  const f = await fixture(page);
  try {
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto('http://localhost:3100/myokim');
    // /myokim redirects to /book (sign-in entry), which forwards to trip selection.
    await expect(anonPage).toHaveURL(/\/trips$/);
    await anon.close();
    const a = await f.booking();
    const rival = `${f.prefix}-rival`;
    const rivalName = `Fictional rival ${f.prefix}`;
    await sql`INSERT INTO customers (id, name, email) VALUES (${rival}, ${rivalName}, ${f.prefix.toLowerCase()+'-rival@example.invalid'})`;
    const b = await f.booking('awaiting_deposit', rival);
    const payment = await f.pay(a, 30);
    await login(page, f.email);
    await page.goto('/myokim');
    await expect(page.locator('main h1')).toHaveText('My Okim');
    // Upcoming is the default tab after login.
    await expect(page.getByRole('tab', { name: /Upcoming trips/ })).toHaveAttribute('aria-selected', 'true');
    const card = page.locator('article').filter({ hasText: a });
    await expect(card).toContainText('Fictional transaction test');
    await expect(card.locator('.status-badge').filter({ hasText: 'Confirmed' })).toBeVisible();
    await expect(card).toContainText('Pay the balance by the due date.');
    await expect(card).toContainText('Sample trip');
    await expect(page.locator('main')).not.toContainText(b);
    await expect(page.locator('main')).not.toContainText(rivalName);
    expect(await page.locator('article form').count()).toBe(0);
    // Read-only: the only buttons are tab navigation and help toggles.
    expect(await page.locator('article button:not(.portal-help-toggle):not(.my-tab):not(.my-show-all)').count()).toBe(0);
    // Equipment sits beside its booking on Upcoming only — never under Past/Points.
    await expect(page.locator('#my-panel-upcoming').getByRole('heading', { name: `${a} · Equipment`, exact: true })).toBeVisible();
    await page.locator('#my-tab-past').click();
    expect(await page.locator('#my-panel-past section.booking-card').count()).toBe(0);
    await page.locator('#my-tab-points').click();
    expect(await page.locator('#my-panel-points section.booking-card').count()).toBe(0);
    // Profile is the fourth tab; deep link opens it.
    await page.locator('#my-tab-profile').click();
    await expect(page.locator('#profile h2')).toHaveText('Diver profile');
    await page.goto('/myokim#profile');
    await expect(page.locator('#my-tab-profile')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#my-tab-upcoming').click();
    await card.locator(`a[href="/invoice/${a}"]`).click();
    await expect(page.locator('.invoice-doc')).toContainText('MYR 30.00');
    await page.goto('/myokim');
    await page.locator(`article a[href="/receipt/${payment}"]`).click();
    await expect(page.locator('.invoice-doc')).toContainText('MYR 30.00');
  } finally { await f.cleanup(); }
});

test('M6 My Okim: ledger-derived balance through earn, completion unlock, redemption, refund reversal, expiry', async ({ page }) => {
  const f = await fixture(page);
  try {
    const a = await f.booking();
    const b = await f.booking();
    const payment = await f.pay(a, 30);
    await login(page, f.email);
    await page.goto('/myokim');
    await openTab(page, /Points/);
    expect(await stats(page)).toEqual([
      { label: 'Total balance', value: '30' },
      { label: 'Available to redeem', value: '0' },
    ]);
    await expect(page.locator('.portal-table')).toContainText('+30');
    await expect(page.locator('.portal-table')).toContainText('RM 30.00');
    await openTab(page, /Upcoming trips/);
    await expect(page.locator('article').filter({ hasText: a })).toContainText('Confirmed');
    // Unlock: eligibility approved + travel ended + completion recorded by Iris.
    await login(page, f.instructor);
    await call(page, 'reviewEligibility', { bookingId: a, decision: 'approved' });
    await sql`UPDATE trips SET travel_end = ${new Date(Date.now()-86400000).toISOString()} WHERE id = ${f.trip}`;
    await call(page, 'completeBooking', { bookingId: a });
    await login(page, f.email);
    await page.goto('/myokim');
    // Completed booking moves to the compact Past trips tab.
    await openTab(page, /Past trips/);
    const pastRow = page.locator('.my-past-row').filter({ hasText: a });
    await expect(pastRow).toContainText('Fictional transaction test');
    await expect(pastRow.locator('.status-badge').filter({ hasText: 'Completed' })).toBeVisible();
    await expect(page.locator('#my-panel-upcoming')).not.toContainText(a);
    await openTab(page, /Points/);
    expect((await stats(page))[1].value).toBe('30');
    // Redemption applied by Iris at invoice time reduces available and total.
    await login(page, f.instructor);
    await call(page, 'redeemPoints', { bookingId: b, points: '20', operationKey: randomUUID() });
    await login(page, f.email);
    await page.goto('/myokim');
    await expect(page.locator('article').filter({ hasText: b })).toContainText('−MYR 1.00');
    await openTab(page, /Points/);
    expect(await stats(page)).toEqual([
      { label: 'Total balance', value: '10' },
      { label: 'Available to redeem', value: '10' },
    ]);
    await expect(page.locator('.portal-table')).toContainText('-20');
    // Refund reverses points proportionally; the refunded booking returns to
    // Upcoming (needs attention) and its lot re-locks.
    await login(page, f.instructor);
    await call(page, 'refundPayment', { paymentId: payment, amount: '10', reason: 'Fictional M6 refund', operationKey: randomUUID() });
    await login(page, f.email);
    await page.goto('/myokim');
    await expect(page.locator('article').filter({ hasText: a })).toContainText('A refund is under review — Iris will contact you.');
    await openTab(page, /Points/);
    expect(await stats(page)).toEqual([
      { label: 'Total balance', value: '0' },
      { label: 'Available to redeem', value: '0' },
    ]);
    await expect(page.locator('.portal-table')).toContainText('Reversed');
    // Expired lots count in the derived total but never in available.
    await sql`INSERT INTO points_ledger (id, customer_id, booking_id, type, points, expires_at) VALUES (${f.prefix+'-expired'}, ${f.customer}, ${a}, 'earned', 100, ${new Date(Date.now()-86400000).toISOString()})`;
    await page.reload();
    await openTab(page, /Points/);
    expect(await stats(page)).toEqual([
      { label: 'Total balance', value: '100' },
      { label: 'Available to redeem', value: '0' },
    ]);
  } finally { await f.cleanup(); }
});

test('M6 My Okim: no Chinese leaks on any EN tab (options and cutoffs included)', async ({ page }) => {
  const f = await fixture(page);
  try {
    const a = await f.booking();
    await login(page, f.instructor);
    await f.pay(a, 30);
    await login(page, f.email);
    await page.goto('/myokim');
    for (const tab of ['upcoming', 'past', 'points', 'profile']) {
      await page.locator('#my-tab-' + tab).click();
      await page.waitForTimeout(200);
      const leaks = await page.evaluate(() => {
        const cjk = /[一-鿿]/; const out = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walk.nextNode())) {
          const t = n.nodeValue || '';
          if (!cjk.test(t)) continue;
          const el = n.parentElement;
          if (el.closest('[data-lang-toggle]') || el.tagName === 'SCRIPT') continue;
          out.push(t.trim().slice(0, 60));
        }
        return out;
      });
      expect(leaks, `CJK leaks on ${tab}`).toEqual([]);
    }
  } finally { await f.cleanup(); }
});

test('M6 My Okim: empty states, past-trip cap, pinned bilingual locale, toggle persistence, design measurements', async ({ page }, testInfo) => {
  const f = await fixture(page);
  try {
    // Fresh customer with no bookings sees empty states and the trips CTA.
    const emptyEmail = `${f.prefix.toLowerCase()}-empty@example.invalid`;
    f.extraEmails.push(emptyEmail);
    await login(page, emptyEmail);
    await page.goto('/myokim');
    await expect(page.locator('#my-panel-upcoming .portal-empty')).toContainText('No upcoming trips');
    await expect(page.locator('#my-panel-upcoming .portal-empty a.btn')).toHaveAttribute('href', '/trips');
    await openTab(page, /Past trips/);
    await expect(page.locator('#my-panel-past .portal-empty')).toContainText('No past trips yet');
    await openTab(page, /Points/);
    await expect(page.locator('#my-panel-points .portal-empty')).toContainText('No points activity yet');
    // Customer with a confirmed booking: pinned EN, then real toggle to CN persists.
    const a = await f.booking();
    await login(page, f.instructor);
    await f.pay(a, 30);
    // Six completed bookings: Past trips shows 5 rows + show-all, keeping it short.
    for (let i = 1; i <= 6; i++) {
      await sql`INSERT INTO bookings (id, customer_id, product_id, status, currency, deposit_amount, balance_amount, declarations, created_at) VALUES (${`${f.prefix}-past${i}`}, ${f.customer}, ${f.trip}, 'completed', 'MYR', 30, 70, '{}', ${new Date(Date.now()-86400000*i).toISOString()})`;
    }
    await login(page, f.email);
    await page.goto('/myokim');
    await expect(page.locator('main h1')).toHaveText('My Okim');
    await expect(page.locator('.nav-link-my')).toHaveText('My Okim');
    await openTab(page, /Past trips/);
    await expect(page.locator('.my-past-row')).toHaveCount(5);
    await page.locator('.my-show-all').click();
    await expect(page.locator('.my-past-row')).toHaveCount(6);
    await expect(page.locator('.my-show-all')).toHaveText('Show fewer');
    await page.locator('.my-show-all').click();
    await expect(page.locator('.my-past-row')).toHaveCount(5);
    await openTab(page, /Upcoming trips/);
    for (const lang of ['en', 'zh']) {
      if (lang === 'zh') {
        await page.locator('[data-lang-toggle]').click();
        await expect.poll(async () => (await sql`SELECT locale FROM customers WHERE id = ${f.customer}`)[0].locale).toBe('zh');
      }
      await expect(page.locator('main h1')).toHaveText(lang === 'en' ? 'My Okim' : '我的 Okim');
      await expect(page.locator('.nav-link-my')).toHaveText(lang === 'en' ? 'My Okim' : '我的 Okim');
      await expect(page.getByRole('tab', { name: lang === 'en' ? /Upcoming trips/ : /即将出行/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: lang === 'en' ? /Past trips/ : /往期行程/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: lang === 'en' ? /^Points/ : /我的积分/ })).toBeVisible();
      await expect(page.locator('#my-panel-upcoming h2')).toHaveText(lang === 'en' ? 'Upcoming trips' : '即将出行');
      await expect(page.locator('article').filter({ hasText: a }).locator('.status-badge').first()).toHaveText(lang === 'en' ? 'Confirmed' : '已确认');
      await openTab(page, lang === 'en' ? /^Points/ : /我的积分/);
      await expect(page.locator('#my-panel-points h2')).toHaveText(lang === 'en' ? 'My Rewards' : '我的积分');
      const help = page.locator('#my-panel-points .portal-help-toggle');
      await help.click();
      await expect(page.locator('#rewards-help')).toBeVisible();
      await expect(page.locator('#rewards-help')).toContainText(lang === 'en' ? '1 point per RM1' : '每 RM1 得 1 分');
      await help.click();
      await expect(page.locator('#rewards-help')).toBeHidden();
      const measurements = await page.evaluate(() => ({
        viewport: innerWidth, scroll: document.documentElement.scrollWidth,
        controls: [...document.querySelectorAll('main button, main .portal-receipts a, main .btn')].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, width: r.width, height: r.height }; }),
        contrast: ['.my-guidance', '.my-stat-label', '.status-badge.tone-ok', '.portal-hint', '.my-tab[aria-selected="true"]'].map(sel => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const s = getComputedStyle(el);
          const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          // Blend translucent badge/stat backgrounds over the surface beneath.
          const parts = s.backgroundColor.match(/[\d.]+/g).map(Number);
          const alpha = parts.length > 3 ? parts[3] : 1;
          const base = s.backgroundColor.includes('rgba') && alpha < 1 ? [255, 255, 255] : parts.slice(0, 3);
          const blended = `rgb(${parts.slice(0, 3).map((v, i) => Math.round(v * alpha + base[i] * (1 - alpha))).join(', ')})`;
          const a = luminance(s.color), b = luminance(alpha < 1 ? blended : s.backgroundColor);
          return { sel, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        }).filter(Boolean),
      }));
      await testInfo.attach(`my-okim-${lang}-measurements`, { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
      console.log('M6 My Okim evidence', JSON.stringify({ project: testInfo.project.name, lang, viewport: measurements.viewport, scroll: measurements.scroll, minControlHeight: Math.min(...measurements.controls.map(c => c.height)), minControlWidth: Math.min(...measurements.controls.map(c => c.width)), contrast: measurements.contrast }));
      expect(measurements.scroll).toBeLessThanOrEqual(measurements.viewport);
      expect(measurements.controls.every(c => c.height >= 44 && c.width >= 44)).toBeTruthy();
      expect(measurements.contrast.every(c => c.ratio >= 4.5)).toBeTruthy();
      await openTab(page, lang === 'en' ? /Upcoming trips/ : /即将出行/);
    }
    // Profile tab: form controls meet touch targets, no overflow.
    await openTab(page, /Profile|个人资料/);
    const profileLayout = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth, viewport: innerWidth,
      small: [...document.querySelectorAll('#profile button, #profile select, #profile input:not([type=hidden]):not([type=checkbox])')].filter(e => e.getBoundingClientRect().width > 0).filter(e => e.getBoundingClientRect().height < 44).length,
    }));
    expect(profileLayout.scroll).toBeLessThanOrEqual(profileLayout.viewport);
    expect(profileLayout.small).toBe(0);
    // Pinned locale survives reload (customer preference, not browser preference).
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('我的 Okim');
    await page.locator('[data-lang-toggle]').click();
    await expect.poll(async () => (await sql`SELECT locale FROM customers WHERE id = ${f.customer}`)[0].locale).toBe('en');
    await expect(page.locator('main h1')).toHaveText('My Okim');
  } finally { await f.cleanup(); }
});
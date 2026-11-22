import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

// M5 financial-invariant regressions, aligned to the 2026-11-22 portal redesign
// (4 tabs + seamless "Received" flow) and points rule v2 (award on individual
// completion, net of refunds/discounts). The journey/UI coverage lives in the
// sibling specs (seamless-flow, portal-tabs, completion-points/critical); THIS
// spec keeps the money/security invariants that are unique to it:
//   1. atomic last-slot race on verifyPayment (+ balance never consumes a slot)
//   2. cumulative refund rounding, over-refund rollback, operation-key replay
//   3. redemption 20% cap, expiry exclusion, replay + key-mismatch rejection
//   4. receipt ownership, role gate, unauthorized action rejection
// recordPayment is no longer UI-rendered (confirmReceived replaced it); its
// idempotency is exercised by seamless-flow. Actions are called through the REAL
// compiled server-action references scraped from the rendered portal forms.
// Self-contained fixtures, FULL cleanup in finally (owner: Neon free tier — zero
// residue). No email sends: token-insert sign-in + verify/refund/redeem actions.
config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const base = process.env.OKIM_TEST_BASE_URL ?? 'http://localhost:3100';
const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
const iso = (d) => d.toISOString();
const days = (n) => new Date(Date.now() + n * 86400000);

async function login(page, email, target = '/portal') {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${iso(days(0.01))})`;
  await page.goto(`${base}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(base + target)}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL(`**${target}`);
  await page.request.get(`${base}/api/auth/session`);
  return token;
}

// Resolve a compiled server-action id from the rendered portal (hidden tab panels
// are still in the DOM). verifyPayment forms only render when pending claims exist.
const actionIds = {};
async function actionId(page, name) {
  if (actionIds[name]) return actionIds[name];
  await page.goto(`${base}/portal`);
  const labels = {
    verifyPayment: 'Verify against bank record',
    refundPayment: 'Record completed external refund',
    redeemPoints: 'Apply points before payment',
  };
  const forms = await page.locator('form').evaluateAll(fs => fs.map(f => ({
    text: f.textContent,
    id: [...f.querySelectorAll('input')].find(i => i.name.startsWith('$ACTION_ID_'))?.name.slice(11),
  })));
  const id = forms.find(f => f.text.includes(labels[name]))?.id;
  expect(id, `compiled reference for ${name}`).toBeTruthy();
  actionIds[name] = id;
  return id;
}
async function call(page, name, fields) {
  const id = await actionId(page, name);
  return page.request.post(`${base}/portal`, { headers: { Origin: base }, multipart: { [`$ACTION_ID_${id}`]: '', ...fields } });
}

async function fixture(page) {
  const prefix = 'M5F-' + randomUUID().slice(0, 8);
  const email = prefix.toLowerCase() + '@example.com';
  const trip = prefix + '-trip';
  const tokens = [];
  await sql`INSERT INTO customers (id, name, email, locale) VALUES (${prefix}, ${prefix + ' Diver'}, ${email}, 'en')`;
  await sql`INSERT INTO trips (id, slug, title_en, title_zh, status, published, price_amount, deposit_value, capacity, travel_start, travel_end, rm_rate, sample, departure_timezone) VALUES (${trip}, ${prefix.toLowerCase()}, 'M5 financial fixture', '财务测试', 'open', true, 100, 30, 1, ${iso(days(10))}, ${iso(days(12))}, 1, true, 'Asia/Kuala_Lumpur')`;
  tokens.push(await login(page, instructor));
  let seq = 0;
  const booking = async (status = 'awaiting_deposit', customerId = prefix) => {
    const id = `${prefix}-b${++seq}`;
    await sql`INSERT INTO bookings (id, customer_id, product_type, product_id, status, eligibility_status, currency, deposit_amount, balance_amount, declarations, equipment, created_at) VALUES (${id}, ${customerId}, 'trip', ${trip}, ${status}, 'approved', 'MYR', 30, 70, '{}', '{}', ${iso(days(-2))})`;
    await sql`INSERT INTO invoices (id, booking_id, number) VALUES (${id}, ${id}, ${id})`;
    return id;
  };
  // A verified payment inserted directly (no capacity side effects), points-v2 style.
  const payment = async (bookingId, amount, kind = 'deposit') => {
    const id = `${prefix}-pay${++seq}`;
    await sql`INSERT INTO payments (id, booking_id, kind, amount, currency, rm_rate, rm_amount, verified_at, receipt_no) VALUES (${id}, ${bookingId}, ${kind}, ${amount}, 'MYR', 1, ${amount}, ${iso(new Date())}, ${'RCT-' + id})`;
    return id;
  };
  const claim = async (bookingId, amount, kind = 'deposit') => {
    const id = `${prefix}-claim${++seq}`;
    await sql`INSERT INTO payment_claims (id, booking_id, amount, currency, paid_on, reference, kind, status, operation_key) VALUES (${id}, ${bookingId}, ${amount}, 'MYR', ${iso(days(-1))}, ${bookingId}, ${kind}, 'pending', ${randomUUID()})`;
    return id;
  };
  const cleanup = async () => {
    const bids = (await sql`SELECT id FROM bookings WHERE customer_id = ${prefix} OR product_id = ${trip}`).map(r => r.id);
    const extra = (await sql`SELECT id FROM customers WHERE email LIKE ${prefix.toLowerCase() + '%'}`).map(r => r.id);
    const cusIds = [prefix, ...extra];
    const allBids = [...new Set([...bids])];
    const claimIds = (await sql`SELECT id FROM payment_claims WHERE booking_id = ANY(${allBids})`).map(r => r.id);
    const payIds = (await sql`SELECT id FROM payments WHERE booking_id = ANY(${allBids})`).map(r => r.id);
    const auditIds = [...allBids, ...claimIds, ...payIds, ...cusIds, trip];
    await sql.transaction([
      sql`DELETE FROM audit_log WHERE entity_id = ANY(${auditIds})`,
      sql`DELETE FROM points_ledger WHERE customer_id = ANY(${cusIds}) OR booking_id = ANY(${allBids})`,
      sql`DELETE FROM payments WHERE booking_id = ANY(${allBids})`,
      sql`DELETE FROM payment_claims WHERE booking_id = ANY(${allBids})`,
      sql`DELETE FROM invoices WHERE booking_id = ANY(${allBids})`,
      sql`DELETE FROM bookings WHERE id = ANY(${allBids})`,
      sql`DELETE FROM signup_names WHERE email LIKE ${prefix.toLowerCase() + '%'}`,
      sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email LIKE ${prefix.toLowerCase() + '%'})`,
      sql`DELETE FROM customers WHERE id = ANY(${cusIds})`,
      sql`DELETE FROM users WHERE email LIKE ${prefix.toLowerCase() + '%'}`,
      sql`DELETE FROM trips WHERE id = ${trip}`,
      sql`DELETE FROM verification_tokens WHERE token = ANY(${tokens})`,
    ]);
    expect((await sql`SELECT count(*)::int n FROM bookings WHERE id LIKE ${prefix + '%'}`)[0].n).toBe(0);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE customer_id = ${prefix}`)[0].n).toBe(0);
    expect((await sql`SELECT count(*)::int n FROM customers WHERE id LIKE ${prefix + '%'}`)[0].n).toBe(0);
  };
  return { prefix, email, trip, tokens, booking, payment, claim, cleanup };
}

test('M5 verifyPayment: atomic last-slot race, balance never consumes a slot', async ({ page, context }) => {
  const f = await fixture(page);
  try {
    const rival = f.prefix + '-rival';
    await sql`INSERT INTO customers (id, name, email) VALUES (${rival}, ${'Rival ' + f.prefix}, ${f.prefix.toLowerCase() + '-rival@example.com'})`;
    const a = await f.booking();
    const b = await f.booking('awaiting_deposit', rival);
    const ca = await f.claim(a, 30);
    const cb = await f.claim(b, 30);
    const other = await context.newPage();
    await Promise.all([call(page, 'verifyPayment', { claimId: ca }), call(other, 'verifyPayment', { claimId: cb })]);
    await other.close();
    const states = await sql`SELECT id, status FROM bookings WHERE id IN (${a}, ${b})`;
    expect(states.map(s => s.status).sort()).toEqual(['confirmed', 'refund_flagged']);
    const winner = states.find(s => s.status === 'confirmed').id;
    // Balance payment on the winner must not consume another slot or change status.
    const bal = await f.claim(winner, 70, 'balance');
    await call(page, 'verifyPayment', { claimId: bal });
    expect((await sql`SELECT status FROM bookings WHERE id = ${winner}`)[0].status).toBe('confirmed');
    expect((await sql`SELECT count(*)::int n FROM bookings WHERE product_id = ${f.trip} AND status IN ('confirmed','completed')`)[0].n).toBe(1);
    expect((await sql`SELECT count(*)::int n FROM payments WHERE booking_id IN (${a}, ${b})`)[0].n).toBe(3);
  } finally { await f.cleanup(); }
});

test('M5 refundPayment: cumulative rounding, over-refund rollback, operation-key replay', async ({ page }) => {
  const f = await fixture(page);
  try {
    const b = await f.booking('confirmed');
    const p = await f.payment(b, 3);
    for (const amount of ['0.50', '0.50', '2.00']) {
      expect((await call(page, 'refundPayment', { paymentId: p, amount, reason: 'M5 fixture refund', operationKey: randomUUID() })).status()).toBe(200);
    }
    const refunds = await sql`SELECT amount FROM payments WHERE source_payment_id = ${p}`;
    expect(refunds.map(r => Number(r.amount)).reduce((s, n) => s + n, 0)).toBe(3);
    // Over-refund beyond the original payment is rejected and rolls back.
    expect((await call(page, 'refundPayment', { paymentId: p, amount: '0.01', reason: 'over', operationKey: randomUUID() })).status()).toBe(500);
    expect((await sql`SELECT count(*)::int n FROM payments WHERE source_payment_id = ${p}`)[0].n).toBe(3);
    // Replayed key with different fields is rejected; identical replay is idempotent.
    const key = randomUUID();
    const b2 = await f.booking('confirmed');
    const p2 = await f.payment(b2, 5);
    expect((await call(page, 'refundPayment', { paymentId: p2, amount: '1', reason: 'replay', operationKey: key })).status()).toBe(200);
    expect((await call(page, 'refundPayment', { paymentId: p2, amount: '2', reason: 'replay', operationKey: key })).status()).toBe(500);
    expect((await call(page, 'refundPayment', { paymentId: p2, amount: '1', reason: 'replay', operationKey: key })).status()).toBe(200);
    expect((await sql`SELECT count(*)::int n FROM payments WHERE operation_key = ${key}`)[0].n).toBe(1);
  } finally { await f.cleanup(); }
});

test('M5 redeemPoints: 20% cap, expiry exclusion, replay and key-mismatch rejection', async ({ page }) => {
  const f = await fixture(page);
  try {
    // A completed source booking with a points-v2 earned lot (500 pts, unexpired).
    const source = await f.booking('completed');
    await sql`UPDATE bookings SET completed_at = ${iso(new Date())} WHERE id = ${source}`;
    const srcPay = await f.payment(source, 500, 'full');
    const lot = 'EARN-COMPLETE-' + source;
    const rules = { awardVersion: 'completion-v1', earnRate: 1, expiryMonths: 12, rounding: 'floor_per_payment', restoration: 'none', allocations: [{ paymentId: srcPay, points: 500, cashCents: 50000, refundedCents: 0 }] };
    await sql`INSERT INTO points_ledger (id, customer_id, booking_id, payment_id, type, points, rm_amount, rate_snapshot, expires_at, rule_snapshot, operation_key) VALUES (${lot}, ${f.prefix}, ${source}, ${srcPay}, 'earned', 500, '500.00', 1, ${iso(days(365))}, ${JSON.stringify(rules)}::json, ${'completion:' + source})`;
    const target = await f.booking();
    // 401 pts → RM20.05 exceeds the 20% cap (RM20.00 on a RM100 trip): rejected.
    expect((await call(page, 'redeemPoints', { bookingId: target, points: '401', operationKey: randomUUID() })).status()).toBe(500);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id = ${target} AND type = 'redeemed'`)[0].n).toBe(0);
    // 400 pts → RM20.00 discount, balance 70 → 50.
    const key = randomUUID();
    expect((await call(page, 'redeemPoints', { bookingId: target, points: '400', operationKey: key })).status()).toBe(200);
    const rows = await sql`SELECT * FROM points_ledger WHERE booking_id = ${target} AND type = 'redeemed'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].points).toBe(-400);
    expect(rows[0].source_lot_id).toBe(lot);
    expect((await sql`SELECT balance_amount, points_discount_amount FROM bookings WHERE id = ${target}`)[0]).toMatchObject({ balance_amount: '50.00', points_discount_amount: '20.00' });
    // Replayed key with different points / different booking is rejected.
    expect((await call(page, 'redeemPoints', { bookingId: target, points: '401', operationKey: key })).status()).toBe(500);
    const next = await f.booking();
    expect((await call(page, 'redeemPoints', { bookingId: next, points: '400', operationKey: key })).status()).toBe(500);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE operation_key = ${key}`)[0].n).toBe(1);
    // Expired lots are excluded (and written off), never spent.
    const expiredSource = await f.booking('completed');
    await sql`UPDATE bookings SET completed_at = ${iso(new Date())} WHERE id = ${expiredSource}`;
    const expiredLot = f.prefix + '-expired-lot';
    await sql`INSERT INTO points_ledger (id, customer_id, booking_id, type, points, expires_at, rule_snapshot) VALUES (${expiredLot}, ${f.prefix}, ${expiredSource}, 'earned', 100, ${iso(days(-1))}, ${JSON.stringify({ awardVersion: 'completion-v1' })}::json)`;
    const target2 = await f.booking();
    // Only 100 pts remain usable (500 - 400); asking 101 must fail, expired lot not spent.
    expect((await call(page, 'redeemPoints', { bookingId: target2, points: '101', operationKey: randomUUID() })).status()).toBe(500);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE source_lot_id = ${expiredLot} AND type = 'redeemed'`)[0].n).toBe(0);
    expect((await call(page, 'redeemPoints', { bookingId: target2, points: '100', operationKey: randomUUID() })).status()).toBe(200);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE source_lot_id = ${expiredLot} AND type = 'expired'`)[0].n).toBe(1);
  } finally { await f.cleanup(); }
});

test('M5 receipt ownership, role gate and unauthorized action rejection', async ({ page, browser }) => {
  const f = await fixture(page);
  try {
    // Provision the owner through a real sign-in (distinct email, stashed name) so
    // the receipt's owning customer is a genuine provisioned account, not a raw
    // SQL row that would clash with the session callback's provisioning.
    const ownerEmail = f.prefix.toLowerCase() + '-owner@example.com';
    await sql`INSERT INTO signup_names (email, name, created_at) VALUES (${ownerEmail}, ${f.prefix + ' Owner'}, ${iso(new Date())})`;
    const ownerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    f.tokens.push(await login(owner, ownerEmail, '/trips'));
    const [ownerCus] = await sql`SELECT id FROM customers WHERE email = ${ownerEmail}`;
    const b = await f.booking('confirmed', ownerCus.id);
    const p = await f.payment(b, 3);
    await owner.goto(`${base}/receipt/${p}`);
    await expect(owner.locator('.invoice-doc')).toContainText('MYR 3.00');
    await ownerCtx.close();
    // Anonymous is redirected away; a different customer gets 404 and no portal.
    const anon = await browser.newContext();
    const outsider = await anon.newPage();
    await outsider.goto(`${base}/receipt/${p}`);
    await expect(outsider).toHaveURL(/\/trips$/);
    const otherEmail = f.prefix.toLowerCase() + '-other@example.com';
    await sql`INSERT INTO signup_names (email, name, created_at) VALUES (${otherEmail}, ${f.prefix + ' Other'}, ${iso(new Date())})`;
    f.tokens.push(await login(outsider, otherEmail, '/trips'));
    expect((await outsider.goto(`${base}/receipt/${p}`)).status()).toBe(404);
    expect((await outsider.goto(`${base}/portal`)).status()).toBe(500);
    const id = await actionId(page, 'refundPayment');
    const denied = await outsider.request.post(`${base}/portal`, { headers: { Origin: base }, multipart: { [`$ACTION_ID_${id}`]: '', paymentId: p, amount: '0.01', reason: 'unauthorized', operationKey: randomUUID() } });
    expect(denied.status()).toBe(500);
    expect((await sql`SELECT count(*)::int n FROM payments WHERE source_payment_id = ${p}`)[0].n).toBe(0);
    await anon.close();
  } finally { await f.cleanup(); }
});
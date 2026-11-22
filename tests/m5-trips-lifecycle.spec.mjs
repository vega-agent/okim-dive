import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const actionIds = {};

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL('**/trips');
  await page.request.get('/api/auth/session');
}

// Playwright's multipart option rejects arrays; build repeated fields manually.
function multipart(fields) {
  const boundary = '----okim' + randomUUID().replace(/-/g, '');
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${v}\r\n`);
    }
  }
  parts.push(`--${boundary}--\r\n`);
  return { data: parts.join(''), headers: { Origin: 'http://localhost:3100', 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

// Resolve the real React server-action reference from a rendered form, then POST it.
async function call(page, path, label, fields, match) {
  await page.goto(path);
  const forms = await page.locator('form').evaluateAll(fs => fs.map(f => ({
    text: f.textContent,
    id: [...f.querySelectorAll('input')].find(i => i.name.startsWith('$ACTION_ID_'))?.name.slice(11),
    hidden: [...f.querySelectorAll('input[type=hidden]')].map(i => ({ name: i.name, value: i.value })),
  })));
  const found = forms.find(f => f.text.includes(label) && (!match || f.hidden.some(h => h.name === match.name && h.value === match.value)));
  // Action references are build-global per exported function, so cache by label:
  // a form may be absent on one page (e.g. delete on a non-draft) but still callable.
  const id = found?.id || actionIds[label];
  expect(id, `compiled reference for ${label} on ${path}`).toBeTruthy();
  actionIds[label] = id;
  return page.request.post(path, multipart({ [`$ACTION_ID_${id}`]: '', ...fields }));
}

const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);

async function fixture(page) {
  const prefix = `M5T-${randomUUID()}`;
  const email = `${prefix.toLowerCase()}@okimdive.com`;
  await login(page, email);
  const [customer] = await sql`SELECT id FROM customers WHERE email = ${email}`;
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  await login(page, instructor);
  const settingsBefore = await sql`SELECT key, value FROM settings WHERE key IN ('points_rules', 'default_rm_rate', 'instructor_emails', 'payment_instructions')`;
  const title = `${prefix} Fictional Reef Trip`;
  await call(page, '/portal/trips/new', 'Create draft', { titleEn: title });
  const [trip] = await sql`SELECT id, slug FROM trips WHERE title_en = ${title}`;
  expect(trip).toBeTruthy();
  const editor = `/portal/trips/${trip.id}`;
  const content = `${editor}/content`;
  let sequence = 0;
  const booking = async (status = 'awaiting_deposit') => {
    const id = `${prefix}-b${++sequence}`;
    await sql`INSERT INTO bookings (id, customer_id, product_id, status, currency, deposit_amount, balance_amount, declarations) VALUES (${id}, ${customer.id}, ${trip.id}, ${status}, 'MYR', 36, 84, '{}')`;
    await sql`INSERT INTO invoices (id, booking_id, number) VALUES (${id}, ${id}, ${id})`;
    return id;
  };
  const cleanup = async () => {
    const tripIds = [trip.id];
    const copies = await sql`SELECT id FROM trips WHERE slug LIKE ${trip.slug + '-copy%'}`;
    tripIds.push(...copies.map(c => c.id));
    await sql`DELETE FROM audit_log WHERE entity_id IN (SELECT id FROM payments WHERE booking_id LIKE ${prefix + '%'} UNION SELECT id FROM payment_claims WHERE booking_id LIKE ${prefix + '%'} UNION SELECT id FROM bookings WHERE id LIKE ${prefix + '%'}) OR entity_id = ANY(${tripIds})`;
    await sql`DELETE FROM audit_log WHERE entity = 'settings' AND entity_id IN ('points_rules', 'default_rm_rate', 'instructor_emails', 'payment_instructions') AND at > NOW() - INTERVAL '30 minutes'`;
    await sql`DELETE FROM points_ledger WHERE customer_id = ${customer.id} OR booking_id LIKE ${prefix + '%'}`;
    await sql`DELETE FROM payments WHERE booking_id LIKE ${prefix + '%'}`;
    await sql`DELETE FROM payment_claims WHERE booking_id LIKE ${prefix + '%'}`;
    await sql`DELETE FROM invoices WHERE booking_id LIKE ${prefix + '%'}`;
    await sql`DELETE FROM bookings WHERE id LIKE ${prefix + '%'}`;
    await sql`DELETE FROM trips WHERE id = ANY(${tripIds})`;
    await sql`DELETE FROM customers WHERE id = ${customer.id}`;
    await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${email})`;
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM users WHERE email = ${email}`;
    for (const key of ['points_rules', 'default_rm_rate', 'instructor_emails', 'payment_instructions']) {
      const before = settingsBefore.find(s => s.key === key);
      if (before) await sql`UPDATE settings SET value = ${JSON.stringify(before.value)} WHERE key = ${key}`;
      else await sql`DELETE FROM settings WHERE key = ${key}`;
    }
  };
  return { prefix, email, customer: customer.id, trip: trip.id, slug: trip.slug, editor, content, booking, cleanup };
}

const EN_CONTENT = {
  title: 'Fictional Reef Trip EN', location: 'Fictional Island', summary: 'A fictional reef trip for automated testing.',
  highlights: ['Fictional highlight one', 'Fictional highlight two'],
  itinerary: ['Day 1: fictional arrival dive', 'Day 2: fictional reef dive'],
  included: ['Fictional accommodation', 'Fictional guided dives'],
};
const ZH_CONTENT = {
  title: '虚构珊瑚礁之旅', location: '虚构岛屿', summary: '用于自动化测试的虚构珊瑚礁行程。',
  highlights: ['虚构亮点一', '虚构亮点二'],
  itinerary: ['第 1 天：虚构抵达潜水', '第 2 天：虚构珊瑚礁潜水'],
  included: ['虚构住宿', '虚构导潜'],
};
const contentFields = (c) => ({
  title: c.title, location: c.location, summary: c.summary,
  highlights: c.highlights, itinerary: c.itinerary, included: c.included,
});

test('M5 trip lifecycle: create, bilingual gate, derive/override, capacity floor, cancel cascade, refund reversal, duplicate, settings', async ({ page }) => {
  const f = await fixture(page);
  try {
    // Draft created; publishing blocked with no facts/content.
    expect((await sql`SELECT status, published FROM trips WHERE id = ${f.trip}`)[0]).toMatchObject({ status: 'draft', published: false });
    await call(page, f.editor, 'Open for booking', { tripId: f.trip, state: 'open' });
    expect((await sql`SELECT status FROM trips WHERE id = ${f.trip}`)[0].status).toBe('draft');

    // Facts → derived display lines in BOTH languages.
    await call(page, f.editor, 'Save settings', {
      tripId: f.trip, slug: f.slug, currency: 'MYR', priceAmount: '100', depositType: 'percent', depositValue: '30',
      balanceDueDays: '30', capacity: '2', minParticipants: '1', rmRate: '1',
      travelStart: iso(10), travelEnd: iso(12), reqCertLevel: 'Open Water', reqMinDives: '5', reqMedical: 'on',
    });
    let row = (await sql`SELECT price_amount, cost_display_en, cost_display_zh, deposit_text_en, deposit_text_zh, travel_dates_en, travel_dates_zh FROM trips WHERE id = ${f.trip}`)[0];
    expect(row.price_amount).toBe('100.00');
    expect(row.cost_display_en).toBe('MYR 100.00');
    expect(row.cost_display_zh).toBe('MYR 100.00');
    expect(row.deposit_text_en).toContain('30%');
    expect(row.deposit_text_zh).toContain('订金 30%');
    expect(row.travel_dates_en).toBeTruthy();
    expect(row.travel_dates_zh).toContain('年');

    // EN content alone is not enough — the bilingual gate holds.
    await call(page, f.content, 'Save content', { tripId: f.trip, locale: 'en', ...contentFields(EN_CONTENT) });
    await call(page, f.editor, 'Open for booking', { tripId: f.trip, state: 'open' });
    expect((await sql`SELECT published FROM trips WHERE id = ${f.trip}`)[0].published).toBe(false);
    await call(page, f.content, 'Save content', { tripId: f.trip, locale: 'zh', ...contentFields(ZH_CONTENT) });
    await call(page, f.editor, 'Open for booking', { tripId: f.trip, state: 'open' });
    expect((await sql`SELECT status, published FROM trips WHERE id = ${f.trip}`)[0]).toMatchObject({ status: 'open', published: true });
    const publicPage = await page.request.get(`/trips/${f.slug}`);
    expect(await publicPage.text()).toContain('Fictional Reef Trip EN');
    // Close immediately: the public assertion is done, and a visible fixture trip
    // must not race public-page specs in any concurrent suite run.
    await call(page, f.editor, 'Close trip', { tripId: f.trip, state: 'closed' });
    expect((await sql`SELECT published, status FROM trips WHERE id = ${f.trip}`)[0]).toMatchObject({ published: false, status: 'open' });

    // Slug locks once launched.
    await call(page, f.editor, 'Save settings', {
      tripId: f.trip, slug: 'hacked-slug', currency: 'MYR', priceAmount: '100', depositType: 'percent', depositValue: '30',
      balanceDueDays: '30', capacity: '2', minParticipants: '1', rmRate: '1', travelStart: iso(10), travelEnd: iso(12), reqMedical: 'on',
    });
    expect((await sql`SELECT slug FROM trips WHERE id = ${f.trip}`)[0].slug).toBe(f.slug);

    // Override survives a price change; the other language re-derives.
    await call(page, f.content, 'Save content', { tripId: f.trip, locale: 'en', ...contentFields(EN_CONTENT), useOverride_costDisplay: 'on', costDisplayOverride: 'MYR 100.00 / diver' });
    await call(page, f.editor, 'Save settings', {
      tripId: f.trip, currency: 'MYR', priceAmount: '120', depositType: 'percent', depositValue: '30',
      balanceDueDays: '30', capacity: '2', minParticipants: '1', rmRate: '1', travelStart: iso(10), travelEnd: iso(12), reqMedical: 'on',
    });
    row = (await sql`SELECT cost_display_en, cost_display_zh, deposit_text_en FROM trips WHERE id = ${f.trip}`)[0];
    expect(row.cost_display_en).toBe('MYR 100.00 / diver');
    expect(row.cost_display_zh).toBe('MYR 120.00');
    expect(row.deposit_text_en).toContain('36.00');

    // Capacity floor: two active holds consume both slots (decision #22).
    const b1 = await f.booking();
    const b2 = await f.booking();
    await call(page, f.editor, 'Save settings', {
      tripId: f.trip, currency: 'MYR', priceAmount: '120', depositType: 'percent', depositValue: '30',
      balanceDueDays: '30', capacity: '1', minParticipants: '1', rmRate: '1', travelStart: iso(10), travelEnd: iso(12), reqMedical: 'on',
    });
    expect((await sql`SELECT capacity FROM trips WHERE id = ${f.trip}`)[0].capacity).toBe(2);

    // One-click Received (seamless flow S1): records + verifies atomically,
    // re-checks capacity, awards no points. Replaces the old record+verify pair.
    await call(page, '/portal', 'Received', { bookingId: b1, amount: '36', kind: 'deposit', paidOn: '2026-01-01', operationKey: randomUUID() });
    expect((await sql`SELECT status FROM bookings WHERE id = ${b1}`)[0].status).toBe('confirmed');
    const earned = await sql`SELECT points FROM points_ledger WHERE booking_id = ${b1} AND type = 'earned'`;
    expect(earned).toEqual([]);
    const reversedBefore = (await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id = ${b1} AND type = 'reversed'`)[0].n;

    // Cancel cascade: paid → refund_flagged, unpaid → cancelled, points UNTOUCHED, diver emailed.
    await call(page, f.editor, 'Cancel this trip', { tripId: f.trip, reason: 'Fictional weather advisory', confirm: 'on' });
    expect((await sql`SELECT status FROM trips WHERE id = ${f.trip}`)[0].status).toBe('cancelled');
    expect((await sql`SELECT status FROM bookings WHERE id = ${b1}`)[0].status).toBe('refund_flagged');
    const b2row = (await sql`SELECT status, cancel_reason FROM bookings WHERE id = ${b2}`)[0];
    expect(b2row.status).toBe('cancelled');
    expect(b2row.cancel_reason).toContain('Fictional weather advisory');
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id = ${b1} AND type = 'reversed'`)[0].n).toBe(reversedBefore);
    const notified = (await sql`SELECT meta FROM audit_log WHERE entity_id = ${f.trip} AND action = 'trip_cancel_notified'`)[0];
    // Delivery itself was verified live in M4; on heavy test days Resend's daily
    // quota can block sends — the audited attempt (sent or failed) is the contract.
    expect(Number(notified.meta.emailsSent) + Number(notified.meta.emailsFailed)).toBeGreaterThanOrEqual(1);

    // Recording the external refund before completion: no earned points exist
    // (#29 completion-only), so nothing reverses — the ledger stays empty.
    const [payment] = await sql`SELECT id FROM payments WHERE booking_id = ${b1} AND kind <> 'refund'`;
    await call(page, '/portal', 'Record completed external refund', { paymentId: payment.id, amount: '36', reason: 'Trip cancelled: fictional weather advisory', operationKey: randomUUID() });
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id = ${b1} AND type = 'reversed'`)[0].n).toBe(reversedBefore);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id = ${b1}`)[0].n).toBe(0);

    // Duplicate → deletable draft; the cancelled original with bookings is not deletable.
    await call(page, '/portal', 'Duplicate', { tripId: f.trip }, { name: 'tripId', value: f.trip });
    const [copy] = await sql`SELECT id, status, published, title_zh FROM trips WHERE slug = ${f.slug + '-copy'}`;
    expect(copy).toMatchObject({ status: 'draft', published: false });
    expect(copy.title_zh).toBe(ZH_CONTENT.title);
    await call(page, `/portal/trips/${copy.id}`, 'Delete this draft', { tripId: copy.id });
    expect((await sql`SELECT count(*)::int n FROM trips WHERE id = ${copy.id}`)[0].n).toBe(0);
    await call(page, f.editor, 'Delete this draft', { tripId: f.trip });
    expect((await sql`SELECT count(*)::int n FROM trips WHERE id = ${f.trip}`)[0].n).toBe(1);

    // Runtime settings: points rules, payment instructions (sample), allowlist — all audited.
    await call(page, '/portal', 'Save points rules', { key: 'points_rules', earnRate: '2', redeemValue: '0.05', expiryMonths: '12', capPct: '20' });
    expect((await sql`SELECT value FROM settings WHERE key = 'points_rules'`)[0].value.earnRate).toBe(2);
    await call(page, '/portal', 'Save payment instructions', { key: 'payment_instructions', instructionsEn: 'Fictional bank details', instructionsZh: '虚构银行资料' });
    expect((await sql`SELECT value FROM settings WHERE key = 'payment_instructions'`)[0].value.sample).toBe(true);
    await call(page, '/portal', 'Save allowlist', { key: 'instructor_emails', emails: process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim() });
    const auditActions = (await sql`SELECT DISTINCT action FROM audit_log WHERE entity_id IN (${f.trip}, ${copy.id}) OR (entity = 'settings' AND at > NOW() - INTERVAL '30 minutes')`).map(r => r.action);
    for (const action of ['trip_created', 'trip_updated', 'trip_content_updated', 'trip_launch_state', 'trip_cancelled', 'trip_duplicated', 'trip_deleted', 'settings_updated']) {
      expect(auditActions, action).toContain(action);
    }
  } finally { await f.cleanup(); }
});


import { test as baseTest, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

// M4 booking flow E2E. Email delivery itself was verified against real Resend
// (test sends to the owner inbox); here the magic-link CALLBACK is exercised by
// inserting a known verification token (Auth.js stores sha256(token+secret))
// and opening the real callback URL — no test backdoors in app code.
config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const SECRET = process.env.AUTH_SECRET;
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100';
const TRIP = 'tioman-reef-weekend';

const test = baseTest.extend({
  tripSlug: async ({}, use) => {
    if (process.env.OKIM_DISABLE_EMAILS !== '1' || process.env.AUTH_URL !== BASE ||
        !['http://localhost:3100','http://127.0.0.1:3100'].includes(BASE)) throw Error('Use the email-suppressed loopback preview')
    const id = 'm4-trip-' + randomUUID()
    try {
      await sql.transaction([
        sql`INSERT INTO trips(id,slug,title_en,title_zh,status,published,sample,price_amount,deposit_type,deposit_value,
          balance_due_date,capacity,travel_start,travel_end)
          VALUES (${id},${id},'Sample booking trip','示例预订行程','open',true,true,1200,'fixed',360,current_date+30,4,current_date+45,current_date+48)`,
        sql`INSERT INTO trip_deposits(id,trip_id,sort,amount,due_date,due_days)
          VALUES (${id+'-d1'},${id},0,360,current_date+10,35)`,
      ])
      await use(id)
    } finally {
      await sql.transaction([sql`DELETE FROM trip_deposits WHERE trip_id=${id}`, sql`DELETE FROM trips WHERE id=${id}`])
    }
  },
})

async function signInViaCallback(page, email, callbackUrl) {
  const raw = randomUUID();
  const hashed = createHash('sha256').update(`${raw}${SECRET}`).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${hashed}, ${new Date(Date.now() + 15 * 60 * 1000)})`;
  try {
    await page.goto(`${BASE}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(callbackUrl)}&token=${raw}&email=${encodeURIComponent(email)}`);
    await page.waitForURL(`**${callbackUrl}`);
  } finally {
    await sql`DELETE FROM verification_tokens WHERE identifier=${email} AND token=${hashed}`
  }
}

async function fillDeclarations(page, { name = 'M4 E2E Diver', zh = false } = {}) {
  await page.fill('#b-name', name);
  await page.selectOption('select[name="cert_agency"]', 'PADI');
  await page.getByRole('button',{name:zh ? '全部自带' : 'Bring all',exact:true}).click();
  await page.selectOption('select[name="cert_level"]', 'Open Water');
  await page.fill('#b-dives', '25');
  await page.check('input[name="insurance"]');
  await page.check('input[name="medical"]');
  await page.fill('#b-emergency-name', 'Emergency Contact');
  await page.fill('#b-emergency-phone', '+60 12 000 0000');
  await page.fill('#b-dob', '1990-05-15');
  await page.locator('.booking-policy summary').click();
  await expect(page.locator('.booking-policy-body').first()).toContainText(zh ? '退款政策' : 'Refunds');
  await page.check('input[name="accept_policy"]');
  await page.check('input[name="accept_deposits"]');
}

// Fallback setup card: only for pending customers who sign in without a stashed
// name (e.g. direct callback, or a lost name race).
async function completeSetup(page, email) {
  await expect(page.locator('#setup-name')).toBeVisible();
  await page.fill('#setup-name', email.split('@')[0]);
  await page.click('.customer-setup button');
  await expect(page.locator('#b-name')).toBeVisible();
}

async function cleanup(email) {
  const bids = (await sql`SELECT b.id FROM bookings b JOIN customers c ON b.customer_id=c.id WHERE c.email=${email}`).map(b=>b.id)
  await sql.transaction([
    sql`DELETE FROM audit_log WHERE entity_id = ANY(${bids}) OR actor_user_id IN (SELECT id FROM users WHERE email=${email})`,
    sql`DELETE FROM booking_stages WHERE booking_id = ANY(${bids})`,
    sql`DELETE FROM invoices WHERE booking_id = ANY(${bids})`,
    sql`DELETE FROM bookings WHERE id = ANY(${bids})`,
    sql`DELETE FROM customers WHERE email=${email}`,
    sql`DELETE FROM verification_tokens WHERE identifier=${email}`,
    sql`DELETE FROM signup_names WHERE email=${email}`,
    sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email=${email})`,
    sql`DELETE FROM users WHERE email=${email}`,
  ])
}

test('trip detail renders from DB with booking CTA, bilingual, 404 for unknown', async ({ page }) => {
  const res = await page.goto(`/trips/${TRIP}`);
  expect(res?.status()).toBe(200);
  await expect(page.locator('.hero-title')).toHaveText('Tioman Reef Weekend');
  await expect(page.locator('.trip-badge')).toHaveText('Sample trip');
  await expect(page.locator('.trip-dialog-footer a.btn')).toHaveAttribute('href', `/book/${TRIP}`);
  await expect(page.locator('.trip-note-sample')).toContainText('SAMPLE CONTENT ONLY');

  await page.evaluate(() => localStorage.setItem('okim-language', 'zh'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
  await expect(page.locator('.hero-title')).toHaveText('刁曼岛珊瑚礁周末');
  await expect(page.locator('.trip-dialog-footer a.btn')).toHaveText('预订此行程');

  const missing = await page.goto('/trips/does-not-exist');
  expect(missing?.status()).toBe(404);
});

test('full booking journey: magic-link sign-in, declarations, reservation and completion-gated invoice', async ({ page, browser, tripSlug }, testInfo) => {
  const email = `m4-e2e-${Date.now()}-${testInfo.project.name}@example.com`;
  try {
    await page.goto(`/book/${tripSlug}`);
    await expect(page.locator('#booking-email')).toBeVisible();
    // Email-budget (owner-approved 2026-11-21): the EN success path + real Resend
    // send is covered by the rl-ok desktop canary (tests/rate-limit.spec.mjs).
    // Here we sign in via the token-insert callback (zero sends) and use the
    // fallback setup card, keeping the suite inside the free-tier daily quota.
    await signInViaCallback(page, email, `/book/${tripSlug}`);
    await completeSetup(page, email);
    await expect(page.locator('#b-name')).toBeVisible();
    const cust = await sql`SELECT * FROM customers WHERE email = ${email}`;
    expect(cust.length).toBe(1);
    expect(cust[0].id).toMatch(/^CUS-\d{3,}$/);

    await fillDeclarations(page);
    await page.click('.booking-card button[type="submit"]');
    await expect(page.locator('.booking-id')).toBeVisible();
    const bookingId = (await page.locator('.booking-id').textContent()).trim();
    expect(bookingId).toMatch(/^BKG-\d{3,}$/);
    await expect(page.locator('.booking-summary')).toContainText('MYR 360.00');
    await expect(page.locator('.booking-summary')).toContainText('MYR 840.00');
    const snapshot = await sql`SELECT due_date::text AS due FROM booking_stages WHERE booking_id=${bookingId} ORDER BY position`;
    expect(snapshot).toHaveLength(2);
    for (const row of snapshot) await expect(page.locator('.booking-summary')).toContainText(row.due);
    await expect(page.locator('.booking-pay-steps')).toContainText('WhatsApp');

    const rows = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('awaiting_deposit');
    expect(rows[0].policy_version_id).toBeTruthy();
    expect(rows[0].accepted_at).toBeTruthy();
    expect(rows[0].declarations.certLevel).toBe('Open Water');
    expect(rows[0].declarations.loggedDives).toBe(25);
    expect(rows[0].declarations.termsVersionId).toBeTruthy();
    const inv = await sql`SELECT * FROM invoices WHERE booking_id = ${bookingId}`;
    expect(inv.length).toBe(1);

    await expect(page.locator('.booking-actions a[href^="/invoice/"]')).toHaveCount(0);
    await page.getByRole('link',{name:'View My Okim'}).click();
    await expect(page.locator('#my-panel-upcoming')).toContainText(bookingId);
    expect((await page.goto(BASE+'/invoice/'+bookingId)).status()).toBe(404);

    // Invoice is auth-gated: a fresh context without a session is redirected
    // (invoice → /book entry → /trips chooser).
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto(`${BASE}/invoice/${bookingId}`);
    await expect(anonPage).toHaveURL(/\/trips$/);
    await anon.close();
  } finally {
    await cleanup(email);
  }
});

test('booking journey works in Chinese and records locale', async ({ page, tripSlug }, testInfo) => {
  const email = `m4-zh-${Date.now()}-${testInfo.project.name}@example.com`;
  try {
    await page.goto(`/book/${tripSlug}`);
    await page.evaluate(() => localStorage.setItem('okim-language', 'zh'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    await expect(page.locator('.booking-card h3')).toHaveText('登录以预订');
    await signInViaCallback(page, email, `/book/${tripSlug}`);
    await completeSetup(page, email);
    // #33: signed-in surfaces follow the BROWSING language — a zh browser lands
    // on the Chinese wizard directly; toggling persists the customer locale.
    await expect(page.locator('label[for="b-name"]')).toHaveText('姓名 *');
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('label[for="b-name"]')).toHaveText('Full name *');
    // setCustomerLocale is a fire-and-forget server action — poll, don't race it.
    await expect.poll(async () => (await sql`SELECT locale FROM customers WHERE email = ${email}`)[0]?.locale).toBe('en');
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('label[for="b-name"]')).toHaveText('姓名 *');
    await expect.poll(async () => (await sql`SELECT locale FROM customers WHERE email = ${email}`)[0]?.locale).toBe('zh');

    await fillDeclarations(page, { name: 'M4 中文测试', zh: true });
    await page.click('.booking-card button[type="submit"]');
    await expect(page.locator('.booking-card h3')).toHaveText('预订已收到');
    const bookingId = (await page.locator('.booking-id').textContent()).trim();
    const rows = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
    expect(rows[0].declarations.locale).toBe('zh');
  } finally {
    await cleanup(email);
  }
});

test('instructor allowlist email gets the instructor role', async ({ page, tripSlug }) => {
  const email = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  try {
    await signInViaCallback(page, email, `/book/${tripSlug}`);
    await expect(page.locator('#b-name, #setup-name').first()).toBeVisible();
    const users = await sql`SELECT role FROM users WHERE email = ${email}`;
    expect(users[0].role).toBe('instructor');
  } finally {
    const session = (await page.context().cookies(BASE)).find(c=>c.name==='authjs.session-token')
    if (session) await sql`DELETE FROM sessions WHERE "sessionToken"=${session.value}`
  }
});

test('booking requires declarations and policy acceptance', async ({ page, tripSlug }, testInfo) => {
  const email = `m4-val-${Date.now()}-${testInfo.project.name}@example.com`;
  try {
    await page.goto(`/book/${tripSlug}`);
    await signInViaCallback(page, email, `/book/${tripSlug}`);
    await completeSetup(page, email);
    await expect(page.locator('#b-name')).toBeVisible();
    // Submit empty: native required validation keeps the form; no booking row.
    await page.click('.booking-card button[type="submit"]');
    await expect(page.locator('#b-name')).toBeVisible();
    const before = await sql`SELECT count(*)::int AS n FROM bookings b JOIN customers c ON b.customer_id = c.id WHERE c.email = ${email}`;
    expect(before[0].n).toBe(0);
  } finally {
    await cleanup(email);
  }
});
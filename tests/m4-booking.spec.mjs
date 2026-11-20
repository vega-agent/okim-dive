import { test, expect } from '@playwright/test';
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
const BASE = 'http://localhost:3100';
const TRIP = 'tioman-reef-weekend';

async function signInViaCallback(page, email, callbackUrl) {
  const raw = randomUUID();
  const hashed = createHash('sha256').update(`${raw}${SECRET}`).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${hashed}, ${new Date(Date.now() + 15 * 60 * 1000)})`;
  await page.goto(`${BASE}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(callbackUrl)}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL(`**${callbackUrl}`);
}

async function fillDeclarations(page, { name = 'M4 E2E Diver', zh = false } = {}) {
  await page.fill('#b-name', name);
  await page.selectOption('#b-cert', 'Open Water');
  await page.fill('#b-dives', '25');
  await page.check('input[name="insurance"]');
  await page.check('input[name="medical"]');
  await page.fill('#b-emergency-name', 'Emergency Contact');
  await page.fill('#b-emergency-phone', '+60 12 000 0000');
  await page.fill('#b-dob', '1990-05-15');
  await page.locator('.booking-policy summary').click();
  await expect(page.locator('.booking-policy-body').first()).toContainText(zh ? '退款政策' : 'Refunds');
  await page.check('input[name="accept_policy"]');
}

async function cleanup(email) {
  const cust = await sql`SELECT id FROM customers WHERE email = ${email}`;
  for (const c of cust) {
    await sql`DELETE FROM invoices WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = ${c.id})`;
    await sql`DELETE FROM bookings WHERE customer_id = ${c.id}`;
    await sql`DELETE FROM customers WHERE id = ${c.id}`;
  }
  await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
  await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${email})`;
  await sql`DELETE FROM users WHERE email = ${email}`;
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

test('full booking journey: email → magic link → declarations → booking + invoice', async ({ page, browser }, testInfo) => {
  const email = `m4-e2e-${Date.now()}-${testInfo.project.name}@okimdive.com`;
  try {
    await page.goto(`/book/${TRIP}`);
    await expect(page.locator('#booking-email')).toBeVisible();
    await page.fill('#booking-email', email);
    await page.click('.booking-card button[type="submit"]');
    await expect(page.locator('.booking-card')).toContainText('Check your email');
    // Resend cooldown: resend button disabled with countdown.
    await expect(page.locator('.booking-card button')).toBeDisabled();
    await expect(page.locator('.booking-card button')).toContainText('Resend available in');
    const tokens = await sql`SELECT * FROM verification_tokens WHERE identifier = ${email}`;
    expect(tokens.length).toBeGreaterThanOrEqual(1);

    await signInViaCallback(page, email, `/book/${TRIP}`);
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
    await expect(page.locator('.booking-summary')).toContainText('2026-11-12');
    await expect(page.locator('.booking-pay-steps')).toContainText('WhatsApp');

    const rows = await sql`SELECT * FROM bookings WHERE id = ${bookingId}`;
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('awaiting_deposit');
    expect(rows[0].policy_version_id).toBe('POL-REFUND-001');
    expect(rows[0].accepted_at).toBeTruthy();
    expect(rows[0].declarations.certLevel).toBe('Open Water');
    expect(rows[0].declarations.loggedDives).toBe(25);
    expect(rows[0].declarations.termsVersionId).toBe('POL-TERMS-001');
    const inv = await sql`SELECT * FROM invoices WHERE booking_id = ${bookingId}`;
    expect(inv.length).toBe(1);

    await page.click('.booking-actions a.btn');
    await page.waitForURL(`**/invoice/${bookingId}`);
    await expect(page.locator('.invoice-doc')).toContainText(inv[0].number);
    await expect(page.locator('.invoice-table tfoot')).toContainText('MYR 1200.00');
    await expect(page.locator('.invoice-notice')).toContainText('confirmed only after');
    await expect(page.locator('.invoice-reference')).toContainText(bookingId);

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

test('booking journey works in Chinese and records locale', async ({ page }, testInfo) => {
  const email = `m4-zh-${Date.now()}-${testInfo.project.name}@okimdive.com`;
  try {
    await page.goto(`/book/${TRIP}`);
    await page.evaluate(() => localStorage.setItem('okim-language', 'zh'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    await expect(page.locator('.booking-card h3')).toHaveText('登录以预订');
    await page.fill('#booking-email', email);
    await page.click('.booking-card button[type="submit"]');
    await expect(page.locator('.booking-card')).toContainText('请查收邮件');

    await signInViaCallback(page, email, `/book/${TRIP}`);
    // Signed-in surfaces use the CUSTOMER locale (default EN), not the browser
    // preference — a zh browser still lands on English after the magic link.
    await expect(page.locator('label[for="b-name"]')).toHaveText('Full name *');
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('label[for="b-name"]')).toHaveText('姓名 *');
    const cust = await sql`SELECT locale FROM customers WHERE email = ${email}`;
    expect(cust[0].locale).toBe('zh');

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

test('instructor allowlist email gets the instructor role', async ({ page }) => {
  const email = 'jeff.mailme@gmail.com';
  await page.goto(`/book/${TRIP}`);
  await signInViaCallback(page, email, `/book/${TRIP}`);
  await expect(page.locator('#b-name')).toBeVisible();
  const users = await sql`SELECT role FROM users WHERE email = ${email}`;
  expect(users[0].role).toBe('instructor');
  const cust = await sql`SELECT id FROM customers WHERE email = ${email}`;
  expect(cust.length).toBe(1);
});

test('booking requires declarations and policy acceptance', async ({ page }, testInfo) => {
  const email = `m4-val-${Date.now()}-${testInfo.project.name}@okimdive.com`;
  try {
    await page.goto(`/book/${TRIP}`);
    await signInViaCallback(page, email, `/book/${TRIP}`);
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
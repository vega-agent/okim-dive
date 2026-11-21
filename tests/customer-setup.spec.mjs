import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const TRIP = 'tioman-reef-weekend';

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent(`http://localhost:3100/book/${TRIP}`)}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL(`**/book/${TRIP}`);
  await page.request.get('/api/auth/session');
}

// Email-step name capture: first submit reveals the name field for new emails.
// The stash row is the source of truth; actual Resend delivery can be quota-
// blocked on heavy test days (delivery itself was verified live in M4).
async function sendLinkWithName(page, email, name) {
  await page.goto(`/book/${TRIP}`);
  await page.fill('#booking-email', email);
  await page.click('.booking-card button[type="submit"]');
  await expect(page.locator('#booking-name')).toBeVisible();
  await page.fill('#booking-name', name);
  await page.click('.booking-card button[type="submit"]');
  await expect.poll(async () => (await sql`SELECT count(*)::int n FROM signup_names WHERE email = ${email}`)[0].n).toBe(1);
}

async function bookWithName(page, name) {
  await page.fill('#b-name', name);
  await page.selectOption('select[name="cert_level"]', 'Open Water');
  await page.fill('#b-dives', '25');
  await page.check('input[name="insurance"]');
  await page.check('input[name="medical"]');
  await page.fill('#b-emergency-name', 'Emergency Contact');
  await page.fill('#b-emergency-phone', '+60 12 000 0000');
  await page.fill('#b-dob', '1990-05-15');
  await page.locator('.booking-policy summary').click();
  await page.check('input[name="accept_policy"]');
  await page.click('.booking-card button[type="submit"]');
  await expect(page.locator('.booking-id')).toBeVisible();
  return (await page.locator('.booking-id').textContent()).trim();
}

async function cleanupCustomer(email) {
  const cust = await sql`SELECT id FROM customers WHERE email = ${email}`;
  for (const c of cust) {
    await sql`DELETE FROM audit_log WHERE entity = 'customer' AND entity_id = ${c.id}`;
    await sql`DELETE FROM audit_log WHERE entity = 'booking' AND entity_id IN (SELECT id FROM bookings WHERE customer_id = ${c.id})`;
    await sql`DELETE FROM invoices WHERE booking_id IN (SELECT id FROM bookings WHERE customer_id = ${c.id})`;
    await sql`DELETE FROM bookings WHERE customer_id = ${c.id}`;
    await sql`DELETE FROM customers WHERE id = ${c.id}`;
  }
  await sql`DELETE FROM signup_names WHERE email = ${email}`;
  await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
  await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${email})`;
  await sql`DELETE FROM users WHERE email = ${email}`;
}

test('name captured at the email step: creation applies it, collisions block the link, pending existing detected, fallback card', async ({ page, browser }) => {
  const prefix = `setup-${randomUUID()}`;
  const emailA = `${prefix}-a@okimdive.com`;
  const emailB = `${prefix}-b@okimdive.com`;
  const emailC = `${prefix}-c@okimdive.com`;
  const emailD = `${prefix}-d@okimdive.com`;
  const nameA = `${prefix} Diver A`;
  const nameB = `${prefix} Diver B`;
  const nameC = `${prefix} Diver C`;
  const nameD = `${prefix} Diver D`;
  try {
    // B: brand-new email → name field at the email step → link sent → after the
    // magic link the wizard appears DIRECTLY (no separate setup page) with the
    // name applied at diver creation; the stash is consumed.
    const anonB = await browser.newContext();
    const anonBPage = await anonB.newPage();
    await sendLinkWithName(anonBPage, emailB, nameB);
    await anonB.close();
    expect((await sql`SELECT name FROM signup_names WHERE email = ${emailB}`)[0].name).toBe(nameB);
    await login(page, emailB);
    await expect(page.locator('#b-name')).toBeVisible();
    expect(await page.locator('#setup-name').count()).toBe(0);
    await expect(page.locator('#b-name')).toHaveValue(nameB);
    expect((await sql`SELECT name FROM customers WHERE email = ${emailB}`)[0].name).toBe(nameB);
    expect((await sql`SELECT count(*)::int n FROM signup_names WHERE email = ${emailB}`)[0].n).toBe(0);

    // A: typing B's name (lowercased) blocks the link with the collision message.
    const anonA = await browser.newContext();
    const anonAPage = await anonA.newPage();
    await anonAPage.goto(`/book/${TRIP}`);
    await anonAPage.fill('#booking-email', emailA);
    await anonAPage.click('.booking-card button[type="submit"]');
    await expect(anonAPage.locator('#booking-name')).toBeVisible();
    await anonAPage.fill('#booking-name', nameB.toLowerCase());
    await anonAPage.click('.booking-card button[type="submit"]');
    await expect(anonAPage.locator('.booking-card [role="alert"]')).toContainText('already used');
    expect((await sql`SELECT count(*)::int n FROM verification_tokens WHERE identifier = ${emailA}`)[0].n).toBe(0);
    expect((await sql`SELECT count(*)::int n FROM signup_names WHERE email = ${emailA}`)[0].n).toBe(0);
    // A free name goes through.
    await anonAPage.fill('#booking-name', nameA);
    await anonAPage.click('.booking-card button[type="submit"]');
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM signup_names WHERE email = ${emailA}`)[0].n).toBe(1);
    await anonA.close();
    await login(page, emailA);
    await expect(page.locator('#b-name')).toHaveValue(nameA);

    // Booking rename guard: B books typing A's name — booking succeeds, B's
    // unique setup name is not overwritten.
    await login(page, emailB);
    await page.goto(`/book/${TRIP}`);
    const bookingId = await bookWithName(page, nameA);
    expect((await sql`SELECT status FROM bookings WHERE id = ${bookingId}`)[0].status).toBe('awaiting_deposit');
    expect((await sql`SELECT name FROM customers WHERE email = ${emailB}`)[0].name).toBe(nameB);

    // C: existing customer with a PENDING name is detected at the email step too;
    // the stashed name is applied to the existing row at next sign-in.
    await login(page, emailC);
    expect((await sql`SELECT name FROM customers WHERE email = ${emailC}`)[0].name).toBe('');
    const anonC = await browser.newContext();
    const anonCPage = await anonC.newPage();
    await sendLinkWithName(anonCPage, emailC, nameC);
    await anonC.close();
    await login(page, emailC);
    await expect(page.locator('#b-name')).toHaveValue(nameC);
    expect((await sql`SELECT name FROM customers WHERE email = ${emailC}`)[0].name).toBe(nameC);

    // D: pending customer signing in WITHOUT a stashed name (lost race / other
    // entry point) gets the fallback setup card — the only remaining use of it.
    await login(page, emailD);
    await page.goto(`/book/${TRIP}`);
    await expect(page.locator('#setup-name')).toBeVisible();
    await page.fill('#setup-name', nameD);
    await page.click('.customer-setup button');
    await expect(page.locator('#b-name')).toHaveValue(nameD);
    expect((await sql`SELECT count(*)::int n FROM audit_log WHERE entity = 'customer' AND action = 'customer_name_set' AND entity_id = (SELECT id FROM customers WHERE email = ${emailD})`)[0].n).toBe(1);
  } finally {
    for (const e of [emailA, emailB, emailC, emailD]) await cleanupCustomer(e);
  }
});

test('email-step name field and fallback card render bilingual with overflow and touch-target checks', async ({ page }) => {
  const email = `setup-render-${randomUUID()}@okimdive.com`;
  try {
    // Anonymous email step in CN (browser preference): name field labels in CN.
    await page.goto(`/book/${TRIP}`);
    await page.evaluate(() => localStorage.setItem('okim-language', 'zh'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    await page.fill('#booking-email', email);
    await page.click('.booking-card button[type="submit"]');
    await expect(page.locator('label[for="booking-name"]')).toHaveText('你的称呼 *');
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      small: [...document.querySelectorAll('.booking-card button, .booking-card input')]
        .filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44).length,
    }));
    expect(metrics.overflow).toBe(false);
    expect(metrics.small).toBe(0);

    // Fallback card: pending customer, EN then CN via the stored customer locale.
    await login(page, email);
    await page.goto(`/book/${TRIP}`);
    await expect(page.locator('.customer-setup h2')).toHaveText('Welcome to Okim Dive');
    await sql`UPDATE customers SET locale = 'zh' WHERE email = ${email}`;
    await page.reload();
    await expect(page.locator('.customer-setup h2')).toHaveText('欢迎来到 Okim Dive');
    const cnOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(cnOverflow).toBe(false);
  } finally {
    await cleanupCustomer(email);
  }
});
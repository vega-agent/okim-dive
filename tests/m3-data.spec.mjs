import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

// M3: trips render from Postgres (server-side, no client JSON fetch) and the
// contact form lands in the inquiries table. DB assertions use the same
// .env.local the app runs with; test rows are removed afterwards.
config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

test('trips cards are server-rendered from the DB with no /data/trips fetch', async ({ page }) => {
  const dataRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/data/trips/')) dataRequests.push(request.url());
  });

  const response = await page.goto('/trips');
  expect(response?.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('trip-card'); // cards present in the initial HTML (SSR)
  expect(html).toContain('Tioman Island Diving');

  await expect(page.locator('.trip-card')).toHaveCount(3);
  await expect(page.locator('.trip-card').first()).toHaveClass(/featured/);
  await expect(page.locator('.trip-card .trip-badge')).toHaveText(['On request', 'Sample trip', 'Sample trip']);
  expect(dataRequests).toEqual([]);

  // Dialog still works from DB-backed data.
  await page.locator('.trip-details-trigger').first().click();
  await expect(page.locator('.trip-dialog[open]')).toBeVisible();
  await expect(page.locator('#trip-dialog-title')).toHaveText('Tioman Island Diving');
  await expect(page.locator('.trip-dialog-footer a')).toHaveText('Plan a Tioman dive');
});

test('contact form submits to inquiries (EN)', async ({ page }, testInfo) => {
  const marker = `m3-en-${Date.now()}-${testInfo.project.name}@example.com`;
  await page.goto('/contact');
  await page.fill('#name', 'M3 Test Diver');
  await page.fill('#email', marker);
  await page.fill('#whatsapp', '+60 12 000 0000');
  await page.selectOption('#interest', 'trip-tioman-island');
  await page.fill('#dates', '12–16 October 2027');
  await page.fill('#group-size', '2');
  await page.fill('#certification', 'Open Water Diver');
  await page.fill('#message', 'M3 automated enquiry — please ignore.');
  await page.check('input[name="consent"]');
  await page.click('.contact-form button[type="submit"]');

  await expect(page.locator('.form-success')).toBeVisible();
  await expect(page.locator('.form-success p')).toContainText('Your enquiry has been received');

  const rows = await sql`SELECT * FROM inquiries WHERE email = ${marker}`;
  expect(rows.length).toBe(1);
  const row = rows[0];
  expect(row.name).toBe('M3 Test Diver');
  expect(row.interest).toBe('trip');
  expect(row.interest_detail).toBe('trip-tioman-island');
  expect(row.trip_id).toBe('TRP-001');
  expect(row.whatsapp).toBe('+60 12 000 0000');
  expect(row.preferred_dates).toBe('12–16 October 2027');
  expect(row.group_size).toBe(2);
  expect(row.certification).toBe('Open Water Diver');
  expect(row.locale).toBe('en');
  expect(row.status).toBe('new');
  expect(row.consent_at).toBeTruthy();
  await sql`DELETE FROM inquiries WHERE id = ${row.id}`;
});

test('contact form records the CN locale and shows CN confirmation', async ({ page }, testInfo) => {
  const marker = `m3-zh-${Date.now()}-${testInfo.project.name}@example.com`;
  await page.goto('/contact');
  await page.evaluate(() => localStorage.setItem('okim-language', 'zh'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');

  await page.fill('#name', '测试潜水员');
  await page.fill('#email', marker);
  await page.selectOption('#interest', 'course-open-water');
  await page.fill('#message', 'M3 自动化测试咨询——请忽略。');
  await page.check('input[name="consent"]');
  await page.click('.contact-form button[type="submit"]');

  await expect(page.locator('.form-success')).toBeVisible();
  await expect(page.locator('.form-success p')).toContainText('我们已收到你的信息');

  const rows = await sql`SELECT * FROM inquiries WHERE email = ${marker}`;
  expect(rows.length).toBe(1);
  expect(rows[0].locale).toBe('zh');
  expect(rows[0].interest).toBe('course');
  expect(rows[0].interest_detail).toBe('course-open-water');
  expect(rows[0].trip_id).toBeNull();
  await sql`DELETE FROM inquiries WHERE id = ${rows[0].id}`;
});

test('contact form blocks submission without consent', async ({ page }) => {
  await page.goto('/contact');
  await page.fill('#name', 'No Consent');
  await page.fill('#email', 'no-consent@example.com');
  await page.selectOption('#interest', 'general-question');
  await page.fill('#message', 'Should not be sent.');
  await page.click('.contact-form button[type="submit"]');
  // Native required validation keeps the form visible; nothing is submitted.
  await expect(page.locator('.contact-form')).toBeVisible();
  await expect(page.locator('.form-success')).toHaveCount(0);
  const rows = await sql`SELECT * FROM inquiries WHERE email = 'no-consent@example.com'`;
  expect(rows.length).toBe(0);
});

test('contact form shows the error state when the action request fails', async ({ page }) => {
  await page.goto('/contact');
  // Server actions POST to the page URL with a Next-Action header.
  await page.route('**/contact', (route) => {
    if (route.request().method() === 'POST') return route.abort();
    return route.continue();
  });
  await page.fill('#name', 'Error Path');
  await page.fill('#email', 'error-path@example.com');
  await page.selectOption('#interest', 'general-question');
  await page.fill('#message', 'M3 error-path check.');
  await page.check('input[name="consent"]');
  await page.click('.contact-form button[type="submit"]');
  await expect(page.locator('.form-status-error')).toBeVisible();
  await expect(page.locator('.form-status-error')).toContainText('could not be sent');
  await expect(page.locator('.contact-form button[type="submit"]')).toBeEnabled();
  await expect(page.locator('.contact-form button[type="submit"]')).toHaveText('Send Enquiry');
});
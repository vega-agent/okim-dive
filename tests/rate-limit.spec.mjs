import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

// M5 dry-run regression: the in-memory cooldown/hourly cap proved DEAD in the
// production runtime (6 rapid requests → 6 emails). These tests drive the REAL
// wizard form and assert server-side enforcement via the DB-backed send ledger
// (verification_tokens windows). Simulated prior sends are token rows with
// expires = sentAt + 15min; the current request's row is excluded by expires.
config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const BASE = process.env.OKIM_TEST_BASE_URL ?? 'http://localhost:3100';
const TRIP = 'tioman-reef-weekend';
const TTL = 15 * 60 * 1000;

async function requestViaUi(page, email) {
  await page.goto(`${BASE}/book/${TRIP}`);
  await page.fill('#booking-email', email);
  await page.locator('form button[type="submit"]').click();
  await expect(page.locator('#booking-name')).toBeVisible();
  await page.fill('#booking-name', email.split('@')[0]);
  await page.locator('form button[type="submit"]').click();
}

test('magic-link cooldown enforced server-side and survives reload', async ({ page }) => {
  const email = `rl-cooldown-${randomUUID()}@okimdive.com`;
  try {
    // A link "sent" 10 seconds ago. Insert the ISO string (not a Date): raw neon
    // serializes Dates as local wall time, while the app's drizzle layer writes
    // UTC ISO strings into this timestamp-without-tz column — match the app.
    await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${'sim-' + randomUUID()}, ${new Date(Date.now() + TTL - 10_000).toISOString()})`;
    await requestViaUi(page, email);
    await expect(page.locator('.form-status-error')).toContainText('Please wait a moment before requesting another link.', { timeout: 20_000 });
    // Reload bypasses the client countdown — the server must still block.
    await requestViaUi(page, email);
    await expect(page.locator('.form-status-error')).toContainText('Please wait a moment before requesting another link.', { timeout: 20_000 });
  } finally {
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM signup_names WHERE email = ${email}`;
  }
});

test('magic-link hourly cap enforced server-side', async ({ page }) => {
  const email = `rl-cap-${randomUUID()}@okimdive.com`;
  try {
    // Five sends 10–50 minutes ago: inside the hour, outside the cooldown.
    for (let i = 1; i <= 5; i++) {
      await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${'sim-' + randomUUID()}, ${new Date(Date.now() + TTL - i * 10 * 60_000).toISOString()})`;
    }
    await requestViaUi(page, email);
    await expect(page.locator('.form-status-error')).toContainText('Too many links requested. Try again later or contact us.', { timeout: 20_000 });
  } finally {
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM signup_names WHERE email = ${email}`;
  }
});

test('fresh address still receives a magic link (real Resend send)', async ({ page }, testInfo) => {
  // Email-budget (owner-approved 2026-11-21): one EN real-send canary per suite,
  // desktop only. Mobile projects skip it; the CN canary lives in m4-booking.
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Real-send canary runs on desktop only (daily email budget).');
  const email = `rl-ok-${randomUUID()}@okimdive.com`;
  try {
    await requestViaUi(page, email);
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({ timeout: 20_000 });
    const rows = await sql`SELECT count(*)::int AS n FROM verification_tokens WHERE identifier = ${email}`;
    expect(rows[0].n).toBe(1);
  } finally {
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM signup_names WHERE email = ${email}`;
  }
});
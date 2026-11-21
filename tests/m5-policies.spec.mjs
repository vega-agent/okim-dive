import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL('**/trips');
  await page.request.get('/api/auth/session');
}

test('M5 policy editor rendered: portal section, language switch, history, help, overflow and targets', async ({ page }) => {
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  await login(page, instructor);

  await page.goto('/portal');
  await expect(page.locator('#policies')).toBeVisible();
  await expect(page.locator('#policies')).toContainText('Refund policy');
  await expect(page.locator('#policies')).toContainText('v1');
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('#policies h2')).toHaveText('政策版本');
  await expect(page.locator('#policies')).toContainText('退款政策');
  await page.locator('[data-lang-toggle]').click();

  await page.goto('/portal/policies/refund');
  await expect(page.locator('h1')).toHaveText('Refund policy');
  const en = page.locator('#policy-body-en');
  const zh = page.locator('#policy-body-zh');
  await expect(en).toBeVisible();
  await expect(zh).toBeHidden();
  expect((await en.inputValue()).length).toBeGreaterThan(50);
  await page.locator('.content-lang-pill', { hasText: '中文' }).click();
  await expect(zh).toBeVisible();
  await expect(en).toBeHidden();
  expect((await zh.inputValue()).length).toBeGreaterThan(20);

  // History is read-only and shows the current version.
  const history = page.locator('.policy-history details');
  expect(await history.count()).toBeGreaterThanOrEqual(1);
  await history.first().locator('summary').click();
  await expect(history.first().locator('.policy-history-body')).toBeVisible();
  await expect(history.first().locator('summary')).toContainText('v1');

  const help = page.locator('#policy-edit-help');
  await page.locator('.portal-help-toggle[aria-controls="policy-edit-help"]').click();
  await expect(help).toBeVisible();
  await page.locator('.portal-help-toggle[aria-controls="policy-edit-help"]').click();
  await expect(help).toBeHidden();

  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    small: [...document.querySelectorAll('main button, main input:not([type=hidden]):not([type=radio]), main select, main textarea')]
      .filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44)
      .map(el => el.tagName + '.' + el.className),
  }));
  expect(metrics.overflow).toBe(false);
  expect(metrics.small).toEqual([]);

  const missing = await page.goto('/portal/policies/unknown-kind');
  expect(missing?.status()).toBe(404);
});
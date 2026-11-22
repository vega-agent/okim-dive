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

test('M5 trip editors rendered: bilingual chrome, language switch, help, overflow and touch targets', async ({ page }) => {
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  await login(page, instructor);
  const [demoTrip] = await sql`SELECT id, title_en, title_zh FROM trips WHERE slug = 'tioman-reef-weekend'`;
  expect(demoTrip).toBeTruthy();

  await page.goto('/portal');
  await page.locator('#portal-tab-manage').click();
  await expect(page.locator('#trips')).toBeVisible();
  await expect(page.locator('#settings')).toBeVisible();
  await expect(page.locator('#trips')).toContainText('Tioman');
  const zhToggle = page.locator('[data-lang-toggle]');
  await zhToggle.click();
  await expect(page.locator('#trips h2')).toHaveText('行程管理');
  await expect(page.locator('#settings h2')).toHaveText('设置');
  await zhToggle.click();

  // Settings editor: overflow + touch targets at the current viewport.
  await page.goto(`/portal/trips/${demoTrip.id}`);
  await expect(page.locator('h1')).toContainText(demoTrip.title_en);
  const metrics = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > window.innerWidth;
    const small = [...document.querySelectorAll('main button, main a.btn, main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main select')]
      .filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44)
      .map(el => el.tagName + '.' + el.className);
    return { overflow, small };
  });
  expect(metrics.overflow).toBe(false);
  expect(metrics.small).toEqual([]);

  // Content editor: one language at a time; switching swaps field values.
  await page.goto(`/portal/trips/${demoTrip.id}/content`);
  const titleInput = page.locator('input[name="title"]');
  await expect(titleInput).toHaveValue(demoTrip.title_en);
  await expect(page.locator('input[name="useOverride_travelDates"]')).toBeVisible();
  await page.locator('.content-lang-pill', { hasText: '中文' }).click();
  await expect(titleInput).toHaveValue(demoTrip.title_zh || demoTrip.title_en);
  await expect(page.locator('.completion-badge').first()).toBeVisible();
  const help = page.locator('#content-help');
  await page.locator('.portal-help-toggle[aria-controls="content-help"]').click();
  await expect(help).toBeVisible();
  await page.locator('.portal-help-toggle[aria-controls="content-help"]').click();
  await expect(help).toBeHidden();
  const contentMetrics = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(contentMetrics).toBe(false);

  // New-trip page renders for the instructor.
  await page.goto('/portal/trips/new');
  await expect(page.locator('input[name="titleEn"]')).toBeVisible();
});
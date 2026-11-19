import { test, expect } from '@playwright/test';

// M2: smoke targets the migrated Next.js routes (were pages/*.html).
const routes = ['/', '/about', '/courses', '/trips', '/gallery', '/contact'];

for (const route of routes) {
  test(`${route} loads without overflow or console errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
    // Trips cards render client-side from JSON; give them a moment before overflow check.
    if (route === '/trips') await page.locator('.trip-card').first().waitFor({ state: 'attached', timeout: 10_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
    expect(errors).toEqual([]);
  });
}

test('mobile navigation opens and closes with Escape', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile navigation is only visible in the mobile viewport.');
  await page.goto('/');
  const toggle = page.locator('.nav-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.nav-menu')).toBeVisible();
  await page.waitForTimeout(400);
  const menuBox = await page.locator('.nav-menu').boundingBox();
  expect(menuBox?.x).toBeGreaterThanOrEqual(0);
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
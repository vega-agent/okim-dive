import { test, expect } from '@playwright/test';

const routes = ['', 'about.html', 'courses.html', 'trips.html', 'gallery.html', 'contact.html'];

for (const route of routes) {
  test(`${route || 'index.html'} loads without overflow or console errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('body')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
    expect(errors).toEqual([]);
  });
}

test('mobile navigation opens and closes with Escape', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-mobile', 'Mobile navigation is only visible in the mobile viewport.');
  await page.goto('');
  const toggle = page.locator('.nav-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

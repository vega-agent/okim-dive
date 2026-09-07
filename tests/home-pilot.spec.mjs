import { test, expect } from '@playwright/test';

test('Home offers three parallel actionable diving paths', async ({ page }) => {
  await page.goto('/pages/index.html');
  const chooser = page.getByRole('region', { name: 'Find your next dive' });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('link')).toHaveCount(3);
  for (const [name, destination] of [['Learn', 'courses.html'], ['Return', 'courses.html'], ['Explore', 'trips.html']]) {
    await chooser.getByRole('link', { name: new RegExp(`^${name}`) }).click();
    await expect(page).toHaveURL(new RegExp(`/pages/${destination}$`));
    await page.goBack();
  }
});


test('the complete Home invitation remains usable without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080/pages/index.html');
  await expect(page.getByRole('heading', { name: 'Learn with care. Explore with wonder.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tioman Island' })).toContainText('On request');

  const hero = page.locator('.pilot-hero');
  for (const name of ['Explore Courses', 'View Trips']) {
    const action = hero.getByRole('link', { name });
    await expect(action).toBeInViewport();
  }
  for (const [name, destination] of [['Learn', 'courses.html'], ['Return', 'courses.html'], ['Explore', 'trips.html']]) {
    await expect(page.locator('.pilot-chooser').getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('href', destination);
  }
  await page.getByRole('link', { name: 'Talk to us about your next dive' }).click();
  await expect(page).toHaveURL(/contact.html$/);
  await context.close();
});

test('Home copy survives bilingual round trips', async ({ page }) => {
  await page.goto('/pages/index.html');
  await page.locator('[data-lang-toggle]').click();
  await expect(page.getByRole('heading', { name: '用心学习，带着好奇探索。' })).toBeVisible();
  await expect(page.getByRole('region', { name: '找到你的下一次潜水' }).getByRole('link')).toHaveCount(3);
  await page.locator('[data-lang-toggle]').click();
  await page.locator('[data-lang-toggle]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
});

test('crossing the painted waterline is a one-shot enhancement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/pages/index.html');
  const waterline = page.locator('.pilot-waterline');
  await waterline.scrollIntoViewIfNeeded();
  await expect(waterline).toHaveAttribute('data-crossed', 'true');
  await expect.poll(() => waterline.evaluate(el => el.getAnimations().filter(a => a.playState === 'finished').length)).toBe(1);
  await page.evaluate(() => scrollTo(0, 0));
  await waterline.scrollIntoViewIfNeeded();
  await expect.poll(() => waterline.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
});

test('Home keeps text still while the waterline enhancement is bounded', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/pages/index.html');
  await page.evaluate(() => document.fonts.ready);
  const heading = page.locator('#pilot-title');
  const before = await heading.boundingBox();
  await page.waitForTimeout(350);
  expect(await heading.boundingBox()).toEqual(before);
  await page.locator('.pilot-waterline').scrollIntoViewIfNeeded();
  await expect(page.locator('.pilot-waterline')).toHaveAttribute('data-crossed', 'true');
});

test('storage and observer failure leave visible, static, bilingual content', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    delete window.IntersectionObserver;
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/pages/index.html');
  await expect(page.locator('.pilot-path')).toHaveCount(3);
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('#pilot-chooser-title')).toHaveText('找到你的下一次潜水');
  expect(errors).toEqual([]);
});

test('Home fits narrow screens with immediate actions and no failed local resources', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith('http://127.0.0.1:8080/') && response.status() >= 400) errors.push(response.url()); });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/pages/index.html');
    await page.evaluate(() => document.fonts.ready);
    for (const language of ['en', 'zh']) {
      await page.evaluate(lang => window.okimApplyLanguage(lang), language);
      await expect(page.locator('.pilot-actions a').first()).toBeInViewport();
      await expect(page.locator('.pilot-actions a').last()).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.pilot-chooser')).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});



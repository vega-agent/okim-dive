import { test, expect } from '@playwright/test';

// Home pilot (UI-Refactor port, approved 2026-11-19) — adapted from Vega's
// tests/home-pilot.spec.mjs to the Next.js routes. CN assertions use the
// approved site dictionary wording.

async function setLang(page, lang) {
  await page.evaluate((l) => localStorage.setItem('okim-language', l), lang);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction((l) => document.documentElement.lang === l, lang === 'zh' ? 'zh-CN' : 'en');
  await page.waitForTimeout(300);
}

test('Home offers three parallel actionable diving paths', async ({ page }) => {
  await page.goto('/');
  const chooser = page.getByRole('region', { name: 'Find your next dive' });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole('link')).toHaveCount(3);
  for (const [name, destination] of [['Learn', '/courses'], ['Return', '/courses'], ['Explore', '/trips']]) {
    await chooser.getByRole('link', { name: new RegExp(`^${name}`) }).click();
    await expect(page).toHaveURL(new RegExp(`${destination}$`));
    await page.goBack();
  }
});

test('the complete Home invitation remains usable without JavaScript', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: testInfo.project.use.viewport });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Learn with care. Explore with wonder.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Tioman Island' })).toContainText('On request');

  const hero = page.locator('.pilot-hero');
  for (const name of ['Explore Courses', 'View Trips']) {
    await expect(hero.getByRole('link', { name })).toBeInViewport();
  }
  for (const [name, destination] of [['Learn', '/courses'], ['Return', '/courses'], ['Explore', '/trips']]) {
    await expect(page.locator('.pilot-chooser').getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('href', destination);
  }
  await page.getByRole('link', { name: 'Talk to us about your next dive' }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await context.close();
});

test('Home copy survives bilingual round trips', async ({ page }) => {
  await page.goto('/');
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
  await page.goto('/');
  const waterline = page.locator('.pilot-waterline');
  await waterline.scrollIntoViewIfNeeded();
  await expect(waterline).toHaveAttribute('data-crossed', 'true');
  await expect.poll(() => waterline.evaluate((el) => el.getAnimations().filter((a) => a.playState === 'finished').length)).toBe(1);
  await page.evaluate(() => scrollTo(0, 0));
  await waterline.scrollIntoViewIfNeeded();
  await expect.poll(() => waterline.evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
});

test('Home keeps text still once the entrance settles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1300); // entrance: 700ms + 240ms stagger, then still
  const heading = page.locator('#pilot-title');
  const before = await heading.boundingBox();
  await page.waitForTimeout(350);
  expect(await heading.boundingBox()).toEqual(before);
  await page.locator('.pilot-waterline').scrollIntoViewIfNeeded();
  await expect(page.locator('.pilot-waterline')).toHaveAttribute('data-crossed', 'true');
});

test('Home motion is bounded: entrance settles, reveals fire, hover responds', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.waitForTimeout(1300);
  const hero = await page.locator('#pilot-title').evaluate((el) => {
    const cs = getComputedStyle(el);
    return { opacity: cs.opacity, transform: cs.transform, animations: el.getAnimations().filter((a) => a.playState === 'running').length };
  });
  expect(hero.opacity).toBe('1');
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(hero.transform); // settled (fill-mode keeps identity matrix)
  expect(hero.animations).toBe(0); // one-shot entrance finished, nothing loops

  await page.locator('.pilot-chooser').scrollIntoViewIfNeeded();
  await expect(page.locator('.pilot-path').first()).toHaveClass(/is-visible/);

  await page.locator('.pilot-actions .pilot-button').first().hover();
  await page.waitForTimeout(250);
  const lift = await page.locator('.pilot-actions .pilot-button').first().evaluate((el) => getComputedStyle(el).transform);
  expect(lift).toBe('matrix(1, 0, 0, 1, 0, -2)');

  const arrow = page.locator('.pilot-path > span').first();
  await page.locator('.pilot-path').first().hover();
  await page.waitForTimeout(600); // let smooth scrolling settle under the cursor
  await page.locator('.pilot-path').first().hover();
  await page.waitForTimeout(250);
  expect(await arrow.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
});

test('reduced motion leaves the home fully visible with no animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForTimeout(300);
  const state = await page.evaluate(() => ({
    heroAnimations: document.querySelector('.pilot-hero-copy').getAnimations({ subtree: true }).length,
    artAnimations: document.querySelector('.pilot-hero-art').getAnimations().length,
    heroOpacity: getComputedStyle(document.querySelector('#pilot-title')).opacity,
    pathsVisible: [...document.querySelectorAll('.pilot-path')].every((el) => el.classList.contains('is-visible')),
  }));
  expect(state.heroAnimations).toBe(0);
  expect(state.artAnimations).toBe(0);
  expect(state.heroOpacity).toBe('1');
  expect(state.pathsVisible).toBe(true);
});

test('storage and observer failure leave visible, static, bilingual content', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    delete window.IntersectionObserver;
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage denied'); } });
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('.pilot-path')).toHaveCount(3);
  await page.locator('[data-lang-toggle]').click();
  await expect(page.locator('#pilot-chooser-title')).toHaveText('找到你的下一次潜水');
  expect(errors).toEqual([]);
});

test('mobile uses a viewport-fixed ocean layer; desktop keeps the section painting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const mobile = await page.evaluate(() => {
    const layer = document.querySelector('.pilot-ocean-bg');
    const cs = getComputedStyle(layer);
    const section = getComputedStyle(document.querySelector('.pilot-ocean'));
    return { display: cs.display, position: cs.position, hasImage: cs.backgroundImage.includes('url'), sectionImage: section.backgroundImage };
  });
  expect(mobile.display).toBe('block');
  expect(mobile.position).toBe('fixed');
  expect(mobile.hasImage).toBe(true);
  expect(mobile.sectionImage).toBe('none');

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
  const desktop = await page.evaluate(() => ({
    layer: getComputedStyle(document.querySelector('.pilot-ocean-bg')).display,
    section: getComputedStyle(document.querySelector('.pilot-ocean')).backgroundImage.includes('url'),
  }));
  expect(desktop.layer).toBe('none');
  expect(desktop.section).toBe(true);
});

test('Home fits narrow screens with immediate actions and no failed local resources', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => { if (response.url().startsWith('http://localhost:3100/') && response.status() >= 400) errors.push(response.url()); });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    for (const language of ['en', 'zh']) {
      await setLang(page, language);
      await expect(page.locator('.pilot-actions a').first()).toBeInViewport();
      await expect(page.locator('.pilot-actions a').last()).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.locator('.pilot-chooser')).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});
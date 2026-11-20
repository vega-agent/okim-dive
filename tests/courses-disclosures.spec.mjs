import { test, expect } from '@playwright/test';

// Courses FAQ disclosures (UI-Refactor port, approved 2026-11-19) — adapted from
// Vega's tests/courses.spec.mjs; CN assertions use the approved M2 audit wording.

for (const viewport of ['desktop', 'mobile']) {
  test.describe(`Courses page ${viewport}`, () => {
    test.use({
      viewport: viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });

    test('keeps the three course choices and package information visible', async ({ page }) => {
      await page.goto('/courses');
      await expect(page.locator('.course-card')).toHaveCount(3);
      await expect(page.locator('.course-card h3')).toHaveText([
        'Open Water Diver',
        'Advanced Open Water',
        'Scuba Refresher',
      ]);
      await expect(page.locator('.course-card').nth(0).locator('.course-pricing')).toContainText('From RM 1,400');
      await expect(page.locator('.course-card').nth(1).locator('.course-pricing')).toContainText('From RM 1,250');
      await expect(page.locator('.course-card').nth(2).locator('.course-pricing')).toContainText('Pricing on request');
      await expect(page.locator('.course-card details')).toHaveCount(3);
    });

    test('FAQ is eleven disclosures, closed by default, openable', async ({ page }) => {
      await page.goto('/courses');
      const faqs = page.locator('.faq-grid details.faq-item');
      await expect(faqs).toHaveCount(11);
      for (const faq of await faqs.all()) await expect(faq).not.toHaveAttribute('open', '');
      const first = faqs.first();
      await first.locator('summary').click();
      await expect(first).toHaveAttribute('open', '');
      await expect(first.locator('p')).toBeVisible();
      await first.locator('summary').click();
      await expect(first).not.toHaveAttribute('open', '');
    });

    test('keeps FAQ disclosures bilingual after switching languages', async ({ page }) => {
      await page.goto('/courses');
      await page.locator('[data-lang-toggle]').click();
      await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');

      const firstFaq = page.locator('.faq-grid details').first();
      await expect(firstFaq.locator('summary')).toHaveText('如果我不擅长游泳，也可以学习潜水吗？');
      await firstFaq.locator('summary').click();
      await expect(firstFaq.locator('p')).toContainText('先和我们聊聊你的经验。');

      await page.locator('[data-lang-toggle]').click();
      await expect(firstFaq.locator('summary')).toHaveText('Can I learn to dive if I’m not a strong swimmer?');
      await expect(firstFaq.locator('p')).toContainText('Talk to us about your experience first.');
    });
  });
}
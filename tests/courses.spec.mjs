import { test, expect } from '@playwright/test';

for (const viewport of ['desktop', 'mobile']) {
  test.describe(`Courses page ${viewport}`, () => {
    test.use({
      viewport: viewport === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 },
      reducedMotion: 'reduce',
    });

    test('keeps the three course choices and package information visible', async ({ page }) => {
      await page.goto('pages/courses.html');

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

    test('keeps FAQ disclosures bilingual after switching languages', async ({ page }) => {
      await page.goto('pages/courses.html');
      await page.locator('[data-lang-toggle]').click();

      const firstFaq = page.locator('.faq-grid details').first();
      await expect(firstFaq.locator('summary')).toHaveText('如果我不擅长游泳，也可以学习潜水吗？');
      await firstFaq.locator('summary').click();
      await expect(firstFaq.locator('p')).toContainText('请先告诉我们您的经验。');

      await page.locator('[data-lang-toggle]').click();
      await expect(firstFaq.locator('summary')).toHaveText('Can I learn to dive if I’m not a strong swimmer?');
      await expect(firstFaq.locator('p')).toContainText('Talk to us about your experience first.');
    });

    test('keeps course card content bilingual after switching languages', async ({ page }) => {
      await page.goto('pages/courses.html');
      await page.locator('[data-lang-toggle]').click();

      await expect(page.locator('.course-card').nth(0).locator('h3')).toHaveText('开放水域潜水员');
      await expect(page.locator('.course-card').nth(0)).toContainText('循序渐进地学习基础知识');
      await expect(page.locator('.course-card').nth(2)).toContainText('价格请咨询');
      await expect(page.locator('.course-card').nth(2)).toContainText('准备重返潜水的持证潜水员');
    });

    test('uses native FAQ disclosures that preserve hidden answers until opened', async ({ page }) => {
      await page.goto('pages/courses.html');

      const faqs = page.locator('.faq-grid details');
      await expect(faqs).toHaveCount(11);
      await expect(faqs.locator('summary')).toHaveCount(11);
      await expect(faqs.first()).not.toHaveAttribute('open', '');
      await expect(faqs.first().locator('p')).not.toBeVisible();

      await faqs.first().locator('summary').click();
      await expect(faqs.first()).toHaveAttribute('open', '');
      await expect(faqs.first().locator('p')).toBeVisible();
    });
  });
}

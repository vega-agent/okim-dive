import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

// M6 public policy pages: versioned DB content, bilingual, footer-only links
// (owner decision 2026-11-21: never in the navbar). Read-only — no mutations,
// no email sends; safe in the public-page projects.
const PAGES = [
  ['/refund-policy', 'Refund Policy', '退款政策', 'How refunds work', '退款如何运作'],
  ['/privacy', 'Privacy Policy', '隐私政策', 'What we collect in the app', '我们在应用内收集的信息'],
  ['/terms', 'Terms of Booking', '预订条款', 'Booking and slot confirmation', '预订与名额确认'],
];

for (const [path, en, zh, headEn, headZh] of PAGES) {
  test(`policy page ${path} renders versioned bilingual content with footer-only links`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('.policy-doc h1')).toHaveText(en);
    await expect(page.locator('.policy-meta')).toContainText(/Version \d+/);
    await expect(page.locator('.policy-notice')).toBeVisible();
    // Readable structure: section headings and real lists, not flat paragraphs.
    await expect(page.locator('.policy-body h2').filter({ hasText: headEn })).toBeVisible();
    // No Chinese leaks on the EN page (document + navbar; the 中文 toggle is the switcher).
    expect(await page.locator('.policy-doc').textContent()).not.toMatch(/[一-鿿]/);
    expect(await page.locator('.nav-menu').textContent()).not.toMatch(/[一-鿿]/);
    // Footer links exist; the navbar must NOT carry policy links.
    await expect(page.locator(`.footer a[href="${path}"]`)).toBeVisible();
    expect(await page.locator(`.navbar a[href="${path}"]`).count()).toBe(0);
    const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.viewport);

    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('.policy-doc h1')).toHaveText(zh);
    await expect(page.locator('.policy-meta')).toContainText(/版本 \d+/);
    await expect(page.locator('.policy-body h2').filter({ hasText: headZh })).toBeVisible();
    await expect(page.locator(`.footer a[href="${path}"]`)).toHaveText(zh);
    const cnOverflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(cnOverflow.scroll).toBeLessThanOrEqual(cnOverflow.viewport);
  });
}

test('refund policy renders its numbered situations as an ordered list', async ({ page }) => {
  await page.goto('/refund-policy');
  await expect(page.locator('.policy-body ol li')).toHaveCount(5);
});

test('signed-in navbar leaks no Chinese on EN pages (Profile link included)', async ({ page }) => {
  const email = `m6p-${randomUUID()}@okimdive.com`;
  try {
    const raw = randomUUID();
    const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
    await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
    await page.goto(`http://localhost:3100/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/refund-policy')}&token=${raw}&email=${encodeURIComponent(email)}`);
    await page.waitForURL('**/refund-policy');
    // Profile lives inside My Okim as a tab — one navbar entry, no anchor link.
    expect(await page.locator('.nav-menu a[href="/myokim#profile"]').count()).toBe(0);
    await expect(page.locator('.nav-menu a[href="/myokim"]')).toHaveText('My Okim');
    expect(await page.locator('.nav-menu').textContent()).not.toMatch(/[一-鿿]/);
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('.nav-menu a[href="/myokim"]')).toHaveText('我的 Okim');
  } finally {
    await sql`DELETE FROM customers WHERE email = ${email}`;
    await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${email})`;
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM users WHERE email = ${email}`;
  }
});

test('portal EN surfaces contain no Chinese (diver updates included)', async ({ page }) => {
  const email = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  try {
    await page.goto(`http://localhost:3100/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/portal')}&token=${raw}&email=${encodeURIComponent(email)}`);
    await page.waitForURL('**/portal');
    await page.waitForTimeout(400);
    const leaks = await page.evaluate(() => {
      const cjk = /[一-鿿]/; const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = n.nodeValue || '';
        if (!cjk.test(t)) continue;
        const el = n.parentElement;
        if (el.closest('[data-lang-toggle]') || el.tagName === 'SCRIPT') continue;
        // User-entered content (customer names, inquiry messages) displays as
        // submitted in any locale — scan UI chrome, not data containers.
        if (el.closest('.portal-booking, .portal-table, .portal-inquiry, .portal-row-sub, select')) continue;
        out.push(t.trim().slice(0, 60));
      }
      return out;
    });
    expect(leaks).toEqual([]);
  } finally {
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email} AND token = ${token}`;
  }
});

test('home footer links all three policy pages bilingually', async ({ page }) => {
  await page.goto('/');
  for (const [path] of PAGES) {
    await expect(page.locator(`.footer a[href="${path}"]`)).toBeVisible();
  }
  await page.locator('[data-lang-toggle]').click();
  for (const [path, , zh] of PAGES) {
    await expect(page.locator(`.footer a[href="${path}"]`)).toHaveText(zh);
  }
});
import { test, expect } from '@playwright/test';

// Post-migration consistency suite (design audit 2026-11-19).
// Replaces tests/parity.spec.mjs: M2 pixel/text parity against the frozen static
// original was verified and recorded (see M2-PARITY-REPORT). The site now carries
// approved improvements (unified footer, honest gallery empty state, full CN
// coverage incl. attributes), so this suite guards the NEW invariants instead:
//   1. Identical footer on every page, EN and CN.
//   2. CN mode leaves no untranslated English copy (text, placeholders, optgroups).
//   3. The trip dialog is fully translated in CN.
//   4. Toggling back to English restores the original copy.

const routes = ['/', '/about', '/courses', '/trips', '/gallery', '/contact'];

// Brand/proper nouns that legitimately stay Latin in CN mode.
const ALLOW = [
  'Okim Dive', 'OKIM Dive', 'OKIM', 'PADI', 'SSI', 'NAUI', 'CMAS', 'CPR', 'BCD',
  'WhatsApp', 'Instagram', 'Facebook', 'XiaoHongShu', '@okim_dive', 'English',
  'RM', 'USD', 'MYR', 'SGD', 'DM', 'Iris',
];
function latinLeftover(s) {
  let t = s;
  for (const a of ALLOW) t = t.split(a).join(' ');
  t = t.replace(/[0-9\s.,:;·—–\-+*/()（）【】《》、。！？""''%#@&©→✓×]/g, '');
  return /[A-Za-z]/.test(t);
}

async function setLang(page, lang) {
  await page.evaluate((l) => localStorage.setItem('okim-language', l), lang);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction((l) => document.documentElement.lang === l, lang === 'zh' ? 'zh-CN' : 'en');
  await page.waitForTimeout(400);
}

async function visibleTexts(page) {
  return page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const p = node.parentElement;
        return p && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(p.tagName)
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      const v = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (v) out.push(v);
    }
    return out;
  });
}

test('footer is identical on every page (EN and CN)', async ({ page }) => {
  const footers = { en: new Set(), zh: new Set() };
  for (const route of routes) {
    await page.goto(route);
    await page.locator('.footer').waitFor({ state: 'attached' });
    footers.en.add((await page.locator('.footer').innerText()).replace(/\s+/g, ' ').trim());
    await setLang(page, 'zh');
    footers.zh.add((await page.locator('.footer').innerText()).replace(/\s+/g, ' ').trim());
    await setLang(page, 'en');
  }
  expect(footers.en.size, 'EN footers differ across pages').toBe(1);
  expect(footers.zh.size, 'CN footers differ across pages').toBe(1);
  expect([...footers.en][0]).toContain('© 2026 Okim Dive');
  expect([...footers.zh][0]).toContain('© 2026 奥金潜水');
});

for (const route of routes) {
  test(`CN mode has no untranslated copy: ${route}`, async ({ page }) => {
    await page.goto(route);
    await setLang(page, 'zh');
    if (route === '/trips') await page.locator('.trip-card').first().waitFor({ state: 'attached', timeout: 15_000 });

    const texts = await visibleTexts(page);
    const leftover = [...new Set(texts.filter(latinLeftover))];
    expect(leftover, `untranslated text on ${route}`).toEqual([]);

    const attrs = await page.evaluate(() => ({
      placeholders: [...document.querySelectorAll('[placeholder]')].map((el) => el.getAttribute('placeholder')),
      optgroups: [...document.querySelectorAll('optgroup')].map((el) => el.getAttribute('label')),
    }));
    expect(attrs.placeholders.filter(latinLeftover), `untranslated placeholders on ${route}`).toEqual([]);
    expect(attrs.optgroups.filter(latinLeftover), `untranslated optgroups on ${route}`).toEqual([]);

    if (route === '/trips') {
      await page.locator('.trip-details-trigger').first().click();
      await page.locator('.trip-dialog[open]').waitFor({ state: 'visible' });
      await page.waitForTimeout(400); // MutationObserver translates the fresh dialog
      const dialogTexts = await page.evaluate(() =>
        [...document.querySelectorAll('.trip-dialog h2, .trip-dialog h3, .trip-dialog dt, .trip-dialog dd, .trip-dialog li, .trip-dialog p, .trip-dialog a')]
          .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
      expect([...new Set(dialogTexts.filter(latinLeftover))], 'untranslated trip dialog').toEqual([]);
      const closeLabel = await page.locator('.trip-dialog-close').first().getAttribute('aria-label');
      expect(closeLabel).toBe('关闭行程详情');
      await page.locator('.trip-dialog-close').first().click();
    }

    // Round-trip: back to English restores the original copy.
    await setLang(page, 'en');
    const enTexts = await visibleTexts(page);
    expect(enTexts.some((t) => t.includes('Quick Links')), 'EN restore failed').toBe(true);
  });
}
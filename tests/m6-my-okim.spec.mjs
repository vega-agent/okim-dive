import { stagedBookingRows, deleteStagedBookingRows } from './support/staged-booking.mjs'
import { withReviewSession } from './support/review-session.mjs'
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

async function fixture(page) {
  const prefix = `M6-${randomUUID()}`;
  const email = `${prefix.toLowerCase()}@example.com`;
  await login(page, email);
  const [customer] = await sql`SELECT id FROM customers WHERE email = ${email}`;

  const trip = `${prefix}-trip`;
  await sql`INSERT INTO trips (id, slug, title_en, title_zh, status, price_amount, deposit_value, capacity, travel_start, travel_end, sample) VALUES (${trip}, ${trip.toLowerCase()}, 'Fictional transaction test', 'Fictional transaction test', 'open', 100, 30, 1, ${new Date(Date.now()+86400000*10).toISOString()}, ${new Date(Date.now()+86400000*12).toISOString()}, true)`;
  let sequence = 0;
  const booking = async (status = 'awaiting_deposit', customerId = customer.id) => {
    const id = `${prefix}-b${++sequence}`;
    await sql.transaction(stagedBookingRows(sql,{id,customerId,tripId:trip,status}))
    return id
  };
  const extraEmails = [];
  const cleanup = async () => {
    const ids=(await sql`SELECT id FROM bookings WHERE product_id=${trip}`).map(row=>row.id)
    await sql.transaction(deleteStagedBookingRows(sql,ids))
    await sql`DELETE FROM trips WHERE id = ${trip}`;
    await sql`DELETE FROM customers WHERE id = ${customer.id} OR id = ${prefix+'-rival'}`;
    for (const e of [email, ...extraEmails]) {
      await sql`DELETE FROM customers WHERE email = ${e}`;
      await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${e})`;
      await sql`DELETE FROM verification_tokens WHERE identifier = ${e}`;
      await sql`DELETE FROM users WHERE email = ${e}`;
    }
  };
  return { prefix, email, customer: customer.id, trip, booking, extraEmails, cleanup };
}

const openTab = (page, name) => page.getByRole('tab', { name }).click();
const stats = page => page.locator('.my-stat').evaluateAll(els => els.map(e => ({ label: e.querySelector('.my-stat-label').textContent, value: e.querySelector('.my-stat-value').textContent })));

test('M6 My Okim: auth gate, read-only upcoming bookings, invoice/receipt links, no rival data', async ({ page, browser }) => {
  const f = await fixture(page);
  try {
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    await anonPage.goto('http://localhost:3100/myokim');
    await expect(anonPage.getByRole('heading', { name: 'Sign in to My Okim' })).toBeVisible();
    await anon.close();
    const a = await f.booking('confirmed');
    const rival = `${f.prefix}-rival`;
    const rivalName = `Fictional rival ${f.prefix}`;
    await sql`INSERT INTO customers (id, name, email) VALUES (${rival}, ${rivalName}, ${f.prefix.toLowerCase()+'-rival@example.com'})`;
    const b = await f.booking('awaiting_deposit', rival);
    const payment = 'PAY-' + a;
    await login(page, f.email);
    await page.goto('/myokim');
    await expect(page.locator('main h1')).toHaveText('My Okim');
    // Upcoming is the default tab after login; tabs and card heads carry the
    // diving icon set as wayfinding.
    await expect(page.getByRole('tab', { name: /Upcoming trips/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.my-tab .my-tab-icon')).toHaveCount(4);
    await expect(page.locator('#my-panel-upcoming .my-subcard-head h3 img').first()).toBeVisible();
    const card = page.locator('.my-subcard').filter({ hasText: a });
    await expect(card).toContainText('Fictional transaction test');
    await expect(card.locator('.status-badge').filter({ hasText: 'Confirmed' })).toBeVisible();
    await expect(card).toContainText('Final payment');
    await expect(card).toContainText('MYR 70.00');
    await expect(card).toContainText('Sample trip');
    await expect(page.locator('main')).not.toContainText(b);
    await expect(page.locator('main')).not.toContainText(rivalName);
    // Bookings/points stay read-only: no forms in those panels.
    await expect(card.getByRole('button',{name:'Record payment'})).toHaveCount(0);
    // Three sub-cards per booking + small disclaimer; reference explained once.
    await expect(card).toBeVisible();
    await expect(page.locator(`#equipment-${a}`)).toBeVisible();
    await expect(page.locator(`#sizes-${a}`)).toBeVisible();
    await expect(page.locator('#my-panel-upcoming .my-disclaimer')).toContainText('self-declared');
    await expect(page.locator('#my-panel-upcoming')).toContainText(/transfer reference/i);
    await page.locator('#my-tab-past').click();
    expect(await page.locator('#my-panel-past .my-subcard').count()).toBe(0);
    await page.locator('#my-tab-points').click();
    expect(await page.locator('#my-panel-points .my-subcard').count()).toBe(0);
    // Profile is the fourth tab; deep link opens it.
    await page.locator('#my-tab-profile').click();
    await expect(page.locator('#profile h2')).toHaveText('Diver profile');
    await page.goto('/myokim#profile');
    await expect(page.locator('#my-tab-profile')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#my-tab-upcoming').click();
    await expect(card.locator(`a[href="/invoice/${a}"]`)).toHaveCount(0);
    expect((await page.goto('/invoice/'+a)).status()).toBe(404);
    await page.goto('/myokim');
    await page.locator(`#my-panel-upcoming a[href="/receipt/${payment}"]`).click();
    await expect(page.locator('.invoice-doc')).toContainText('MYR 30.00');
  } finally { await f.cleanup(); }
});

test('My Okim shows the completed award, redemption and adjusted final from the review data', async ({page}) => {
  await withReviewSession(page, async () => {
    await page.goto('/myokim')
    const discounted = page.locator('#my-panel-upcoming .my-subcard').filter({hasText:'BKG-REVIEW-POINTS'})
    await expect(discounted).toContainText('MYR 790.00')
    await expect(discounted).toContainText('MYR 590.00')
    await openTab(page,/Past trips/)
    await expect(page.locator('.my-past-row').filter({hasText:'BKG-REVIEW-HISTORY'})).toContainText('Completed')
    await openTab(page,/Points/)
    expect((await stats(page)).map(stat=>stat.value.replaceAll(',',''))).toEqual(['2000','2000'])
    await expect(page.locator('#my-panel-points')).toContainText('Redeemed')
  })
})

test('M6 My Okim: no Chinese leaks on any EN tab (options and cutoffs included)', async ({ page }) => {
  const f = await fixture(page);
  try {
    const a = await f.booking('confirmed');
    await login(page, f.email);
    await page.goto('/myokim');
    for (const tab of ['upcoming', 'past', 'points', 'profile']) {
      await page.locator('#my-tab-' + tab).click();
      await page.waitForTimeout(200);
      const leaks = await page.evaluate(() => {
        const cjk = /[一-鿿]/; const out = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walk.nextNode())) {
          const t = n.nodeValue || '';
          if (!cjk.test(t)) continue;
          const el = n.parentElement;
          if (el.closest('[data-lang-toggle]') || el.tagName === 'SCRIPT') continue;
          out.push(t.trim().slice(0, 60));
        }
        return out;
      });
      expect(leaks, `CJK leaks on ${tab}`).toEqual([]);
    }
  } finally { await f.cleanup(); }
});

test('M6 equipment board: three columns auto-fill from profile, tap-move, drag, save', async ({ page }) => {
  const f = await fixture(page);
  try {
    const a = await f.booking();
    await sql`UPDATE customers SET diver_profile = ${JSON.stringify({ equipment: { choices: { mask: 'own', other: 'own' } } })}::json WHERE id = ${f.customer}`;
    await login(page, f.email);
    await page.goto('/myokim');
    const board = page.locator(`#equipment-${a}`);
    await expect(board.locator('.eq-col')).toHaveCount(3);
    // Auto-fill: profile own items land in Bring, everything else in Rent.
    await expect(board.locator('.eq-count')).toHaveText(['2', '10', '0']);
    await expect(board.locator('.eq-col').nth(0).locator('.eq-pill')).toHaveCount(2);
    // Bulk actions are icon buttons in column headers with hover explanations;
    // Reset sits at the Equipment head right.
    await expect(board.getByRole('button', { name: 'Bring all', exact: true })).toHaveAttribute('data-tip', 'Move every item to Bring');
    await expect(board.getByRole('button', { name: 'Rent all', exact: true })).toHaveAttribute('data-tip', 'Move every item to Rent');
    await expect(board.getByRole('button', { name: 'Remove all', exact: true })).toHaveAttribute('data-tip', 'Mark every item not needed');
    await expect(board.getByRole('button', { name: 'Reset from profile', exact: true })).toBeVisible();
    // Sizes: four cells, Other note below, Save right-aligned at the end.
    const sizesCard = page.locator(`#sizes-${a}`);
    await expect(sizesCard.locator('.eq-size-cell')).toHaveCount(3);
    await expect(sizesCard.locator('textarea')).toHaveCount(2);
    const rightGap = await sizesCard.evaluate(el => { const btn = el.querySelector('.my-save-row button'); return Math.round(el.getBoundingClientRect().right - btn.getBoundingClientRect().right); });
    expect(rightGap).toBeLessThanOrEqual(24);
    // Tap a pill -> destination menu -> move to No need.
    await board.locator(`#${a}-pill-mask`).click();
    await expect(board.locator('.eq-menu')).toBeVisible();
    await board.locator('.eq-menu button', { hasText: 'No need' }).click();
    await expect(board.locator('.eq-count')).toHaveText(['1', '10', '1']);
    expect(JSON.parse(await board.locator('input[name=equipment]').inputValue()).choices.mask).toBe('none');
    // Drag a pill from Rent to Bring (desktop HTML5 drag). Settle layout and
    // scroll first: dragAndDrop measures boxes before scrolling, which can
    // otherwise start the drag on the wrong pill.
    await board.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.dragAndDrop(`#${a}-pill-snorkel`, `#equipment-${a} .eq-col >> nth=0`);
    await expect(board.locator('.eq-count')).toHaveText(['2', '9', '1']);
    // Save persists the board state.
    const sizes = page.locator(`#sizes-${a}`);
    await sizes.getByRole('button', { name: 'Save booking equipment', exact: true }).click();
    await expect(sizes.getByRole('status')).toContainText('Saved');
    await expect.poll(async () => (await sql`SELECT equipment FROM bookings WHERE id = ${a}`)[0].equipment.choices.snorkel).toBe('own');
    // CN headers + menu.
    await page.locator('[data-lang-toggle]').click();
    await expect(board.locator('.eq-col h4').first()).toContainText('自带');
    await board.locator(`#${a}-pill-mask`).click();
    await expect(board.locator('.eq-menu button').first()).toHaveText('自带');
  } finally { await f.cleanup(); }
});

test('M6 My Okim: empty states, past-trip cap, browsing-language locale, toggle persistence, design measurements', async ({ page }, testInfo) => {
  const f = await fixture(page);
  try {
    // Fresh customer with no bookings sees empty states and the trips CTA.
    const emptyEmail = `${f.prefix.toLowerCase()}-empty@example.com`;
    f.extraEmails.push(emptyEmail);
    await login(page, emptyEmail);
    await page.goto('/myokim');
    await expect(page.locator('#my-panel-upcoming .portal-empty')).toContainText('No upcoming trips');
    await expect(page.locator('#my-panel-upcoming .portal-empty a.btn')).toHaveAttribute('href', '/trips');
    await openTab(page, /Past trips/);
    await expect(page.locator('#my-panel-past .portal-empty')).toContainText('No past trips yet');
    await openTab(page, /Points/);
    await expect(page.locator('#my-panel-points .portal-empty')).toContainText('No points activity yet');
    // Customer with a confirmed booking: browsing EN, then real toggle to CN persists.
    const a = await f.booking('confirmed');
    // Six completed bookings: Past trips shows 5 rows + show-all, keeping it short.
    for (let i = 1; i <= 6; i++) {
      await sql.transaction(stagedBookingRows(sql,{id:f.prefix+'-past'+i,customerId:f.customer,tripId:f.trip,
        status:'completed',createdAt:new Date(Date.now()-86400000*i).toISOString()}))
    }
    await login(page, f.email);
    await page.goto('/myokim');
    await expect(page.locator('main h1')).toHaveText('My Okim');
    await expect(page.locator('.nav-link-my')).toHaveText('My Okim');
    await openTab(page, /Past trips/);
    await expect(page.locator('.my-past-row')).toHaveCount(5);
    await page.locator('.my-show-all').click();
    await expect(page.locator('.my-past-row')).toHaveCount(6);
    await expect(page.locator('.my-show-all')).toHaveText('Show fewer');
    await page.locator('.my-show-all').click();
    await expect(page.locator('.my-past-row')).toHaveCount(5);
    await openTab(page, /Upcoming trips/);
    for (const lang of ['en', 'zh']) {
      if (lang === 'zh') {
        await page.locator('[data-lang-toggle]').click();
        await expect.poll(async () => (await sql`SELECT locale FROM customers WHERE id = ${f.customer}`)[0].locale).toBe('zh');
      }
      await expect(page.locator('main h1')).toHaveText(lang === 'en' ? 'My Okim' : '我的 Okim');
      await expect(page.locator('.nav-link-my')).toHaveText(lang === 'en' ? 'My Okim' : '我的 Okim');
      await expect(page.getByRole('tab', { name: lang === 'en' ? /Upcoming trips/ : /即将出行/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: lang === 'en' ? /Past trips/ : /往期行程/ })).toBeVisible();
      await expect(page.getByRole('tab', { name: lang === 'en' ? /^Points/ : /我的积分/ })).toBeVisible();
      await expect(page.locator('#my-panel-upcoming h2')).toHaveText(lang === 'en' ? 'Upcoming trips' : '即将出行');
      await expect(page.locator('.my-subcard').filter({ hasText: a }).locator('.status-badge').first()).toHaveText(lang === 'en' ? 'Confirmed' : '已确认');
      await openTab(page, lang === 'en' ? /^Points/ : /我的积分/);
      await expect(page.locator('#my-panel-points h2')).toHaveText(lang === 'en' ? 'My Rewards' : '我的积分');
      const help = page.locator('#my-panel-points .portal-help-toggle');
      await help.click();
      await expect(page.locator('#rewards-help')).toBeVisible();
      await expect(page.locator('#rewards-help')).toContainText(lang === 'en' ? '1 point per RM1' : '每 RM1 得 1 分');
      await help.click();
      await expect(page.locator('#rewards-help')).toBeHidden();
      const measurements = await page.evaluate(() => ({
        viewport: innerWidth, scroll: document.documentElement.scrollWidth,
        controls: [...document.querySelectorAll('main button, main .portal-receipts a, main .btn')].filter(e => e.getBoundingClientRect().width > 0).map(e => { const r = e.getBoundingClientRect(); return { tag: e.tagName, width: r.width, height: r.height }; }),
        contrast: ['.my-guidance', '.my-stat-label', '.status-badge.tone-ok', '.portal-hint', '.my-tab[aria-selected="true"]'].map(sel => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const s = getComputedStyle(el);
          const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          // Blend translucent badge/stat backgrounds over the surface beneath.
          const parts = s.backgroundColor.match(/[\d.]+/g).map(Number);
          const alpha = parts.length > 3 ? parts[3] : 1;
          const base = s.backgroundColor.includes('rgba') && alpha < 1 ? [255, 255, 255] : parts.slice(0, 3);
          const blended = `rgb(${parts.slice(0, 3).map((v, i) => Math.round(v * alpha + base[i] * (1 - alpha))).join(', ')})`;
          const a = luminance(s.color), b = luminance(alpha < 1 ? blended : s.backgroundColor);
          return { sel, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
        }).filter(Boolean),
      }));
      await testInfo.attach(`my-okim-${lang}-measurements`, { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
      console.log('M6 My Okim evidence', JSON.stringify({ project: testInfo.project.name, lang, viewport: measurements.viewport, scroll: measurements.scroll, minControlHeight: Math.min(...measurements.controls.map(c => c.height)), minControlWidth: Math.min(...measurements.controls.map(c => c.width)), contrast: measurements.contrast }));
      expect(measurements.scroll).toBeLessThanOrEqual(measurements.viewport);
      expect(measurements.controls.every(c => c.height >= 44 && c.width >= 44)).toBeTruthy();
      expect(measurements.contrast.every(c => c.ratio >= 4.5)).toBeTruthy();
      await openTab(page, lang === 'en' ? /Upcoming trips/ : /即将出行/);
    }
    // Profile tab: form controls meet touch targets, no overflow.
    await openTab(page, /Profile|个人资料/);
    const profileLayout = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth, viewport: innerWidth,
      small: [...document.querySelectorAll('#profile button, #profile select, #profile input:not([type=hidden]):not([type=checkbox])')].filter(e => e.getBoundingClientRect().width > 0).filter(e => e.getBoundingClientRect().height < 44).length,
    }));
    expect(profileLayout.scroll).toBeLessThanOrEqual(profileLayout.viewport);
    expect(profileLayout.small).toBe(0);
    // Profile spans the same width as the tab bar (owner: widths must match).
    const widths = await page.evaluate(() => ({ profile: document.querySelector('#profile form').getBoundingClientRect().width, subcard: document.querySelector('#profile .my-subcard').getBoundingClientRect().width, tabs: document.querySelector('.my-tabs').getBoundingClientRect().width, h2: parseFloat(getComputedStyle(document.querySelector('#profile h2')).fontSize) }));
    expect(Math.abs(widths.profile - widths.tabs)).toBeLessThanOrEqual(2);
    expect(Math.abs(widths.subcard - widths.tabs)).toBeLessThanOrEqual(2);
    expect(widths.h2).toBeLessThanOrEqual(26);
    await expect(page.locator('#profile .my-subcard')).toHaveCount(3);
    // #33: display follows the browsing language, not the stored customer locale.
    await sql`UPDATE customers SET locale = 'zh' WHERE id = ${f.customer}`;
    await page.evaluate(() => localStorage.setItem('okim-language', 'en'));
    await page.reload();
    await expect(page.locator('main h1')).toHaveText('My Okim');
    // Toggling persists the choice to the customer profile (email language).
    await page.locator('[data-lang-toggle]').click();
    await expect.poll(async () => (await sql`SELECT locale FROM customers WHERE id = ${f.customer}`)[0].locale).toBe('zh');
    await expect(page.locator('main h1')).toHaveText('我的 Okim');
    await page.locator('[data-lang-toggle]').click();
    await expect.poll(async () => (await sql`SELECT locale FROM customers WHERE id = ${f.customer}`)[0].locale).toBe('en');
    await expect(page.locator('main h1')).toHaveText('My Okim');
  } finally { await f.cleanup(); }
});
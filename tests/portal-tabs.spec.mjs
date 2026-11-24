import { test, expect } from '@playwright/test'
import { withReviewSession } from './support/review-session.mjs'

const UUID_RE = /[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/i

test('Portal tabs, contextual payment and cancellation dialogs, booking filters and bilingual navigation', async ({ page }) => {
  await withReviewSession(page, async () => {
    await page.goto('/portal')
    await expect(page.locator('#portal-tab-actions')).toHaveAttribute('aria-selected','true')
    const request = page.locator('.portal-request').filter({hasText:'BKG-REVIEW-PARTIAL'})
    await expect(request).toContainText('MYR 250.00')
    const record = request.getByRole('button',{name:'Record payment',exact:true})
    await record.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.locator('input[name=amount]')).toHaveValue('250.00')
    await expect(dialog.locator('input[name=paidOn]')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/)
    await dialog.locator('input[name=amount]').fill('350')
    await expect(dialog).toContainText('Deposit 2')
    await expect(dialog).toContainText('MYR 100.00')
    await page.keyboard.press('Escape')
    await expect(record).toBeFocused()

    await page.locator('#portal-tab-trips').click()
    const trip = page.locator('#trip-TRP-004')
    await expect(trip.locator('a[href="/portal/trips/TRP-004/messages"]')).toBeVisible()
    await trip.locator('.portal-trip-manifest > summary').click()
    await expect(trip.locator('.portal-booking-compact').filter({hasText:'BKG-REVIEW-POINTS'})).toBeVisible()
    await page.locator('#bookings > summary').click()
    expect(await page.locator('#bookings .portal-booking-compact').count()).toBeLessThanOrEqual(10)
    await page.locator('#bookings select').selectOption('TRP-REVIEW-TWO')
    await page.getByRole('radio',{name:'Past',exact:true}).check()
    await expect(page.locator('#booking-BKG-REVIEW-REFUND')).toBeVisible()
    await expect(page.locator('#booking-BKG-REVIEW-PARTIAL')).toHaveCount(0)
    await page.getByRole('radio',{name:'All',exact:true}).check()
    const partial = page.locator('#booking-BKG-REVIEW-PARTIAL')
    await partial.getByRole('button',{name:'Info',exact:true}).click()
    await expect(dialog).toContainText('Emergency contact')
    await expect(dialog).not.toContainText('certAgency')
    await page.keyboard.press('Escape')
    await partial.getByRole('button',{name:'Cancel booking'}).click()
    await expect(dialog).toContainText('Deposits retained')
    await expect(dialog).toContainText('MYR 250.00')
    await page.keyboard.press('Escape')

    await page.locator('#portal-tab-money').click()
    await page.locator('#receipts > summary').click()
    await expect(page.locator('#receipts a').first()).toBeVisible()
    expect(await page.locator('#receipts').innerText()).not.toMatch(UUID_RE)
    await page.locator('#points > summary').click()
    await expect(page.locator('#points tbody tr').first()).toBeVisible()
    // Settings sections reachable.
    await page.locator('#portal-tab-settings').click();
    await expect(page.locator('#policies')).toBeVisible();
    await expect(page.locator('#settings')).toBeVisible();

    // Keyboard navigation + deep link.
    await page.locator('#portal-tab-actions').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#portal-tab-trips')).toHaveAttribute('aria-selected', 'true');
    await page.goto('/contact');
    await page.goto('/portal#points');
    await expect(page.locator('#portal-tab-money')).toHaveAttribute('aria-selected', 'true');

    // EN purity + layout across tabs; then CN.
    for (const tab of ['actions', 'trips', 'money', 'settings']) {
      await page.locator(`#portal-tab-${tab}`).click();
      const m = await page.evaluate((tabId) => {
        const panel = document.getElementById(`portal-panel-${tabId}`);
        const hiddenByDetails = el => { let cur = el; while (cur && cur !== panel) { if (cur.tagName === 'DETAILS' && !cur.open) { const s = cur.querySelector(':scope > summary'); if (!s || !s.contains(el)) return true; } cur = cur.parentElement; } return false; };
        const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT); let n; const cjk = [];
        while ((n = walker.nextNode())) {
          const el = n.parentElement;
          if (!el || el.closest('[data-lang-toggle]') || el.tagName === 'SCRIPT' || el.offsetParent === null || hiddenByDetails(el)) continue;
          if (/[\u4e00-\u9fff]/.test(n.textContent)) cjk.push(n.textContent.trim().slice(0, 30));
        }
        const controls = [...panel.querySelectorAll('button, a.btn, select, input:not([type=hidden])')].filter(el => el.getBoundingClientRect().height > 0);
        const small = controls.filter(el => el.getBoundingClientRect().height < 44 || el.getBoundingClientRect().width < 44).length;
        return { cjk, small, overflow: document.documentElement.scrollWidth > window.innerWidth };
      }, tab);
      expect(m.cjk, `CJK leak in ${tab}`).toEqual([]);
      expect(m.small, `small targets in ${tab}`).toBe(0);
      expect(m.overflow, `overflow in ${tab}`).toBe(false);
    }
    await page.locator('[data-lang-toggle]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    await page.locator('#portal-tab-actions').click();
    await expect(page.locator('#portal-tab-actions')).toContainText('待办事项');
    await expect(page.locator('#requests h2')).toHaveText('待收款项');
    await expect(page.locator('main.portal h1')).toHaveText('教练工作台');
    await page.locator('#portal-tab-trips').click();
    await expect(page.locator('#portal-tab-trips')).toContainText('行程');
  })
})

test('Trip editor has no Inquiries-only launch; Tioman stays On request', async ({ page }) => {
  await withReviewSession(page, async () => {
    await page.goto('/portal/trips/TRP-001');
    const nav = page.locator('.trip-editor-nav');
    await expect(nav.locator('button[name="state"][value="open"]')).toBeVisible();
    await expect(nav.locator('button[name="state"][value="inquiries"]')).toHaveCount(0);
    await expect(nav.getByRole('button', { name: /Inquiries only/ })).toHaveCount(0);
    await expect(page.locator('.trip-editor-title .status-badge')).toHaveText('On request');
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('.trip-editor-title .status-badge')).toHaveText('按需安排');
    await page.locator('[data-lang-toggle]').click();

    await page.goto('/trips/tioman-on-request');
    await expect(page.locator('.trip-badge')).toHaveText('On request');
    await expect(page.getByRole('link', { name: 'Ask about this trip', exact: true })).toHaveAttribute('href', '/contact');
    await expect(page.getByRole('link', { name: 'Book this trip', exact: true })).toHaveCount(0);
  })
})

for (const surface of ['/myokim', '/portal']) {
  test(`Logging out from ${surface} ends the shared Okim session`, async ({ page }) => {
    await withReviewSession(page, async () => {
      await page.goto(surface)
      await page.getByRole('button', { name: 'Log out', exact: true }).click()
      await expect(page).toHaveURL(new URL('/', process.env.PLAYWRIGHT_BASE_URL).href)
      expect(await (await page.request.get('/api/auth/session')).json()).toBeNull()
      await page.goto('/portal')
      await expect(page).toHaveURL(/\/portal\/sign-in$/)
      await page.goto('/myokim')
      await expect(page.getByRole('heading', { name: 'Sign in to My Okim' })).toBeVisible()
    })
  })
}

test('signed-out visitors reach both sign-in forms from the homepage', async ({ page }) => {
  await page.goto('/')
  for (const [linkName, heading] of [
    ['My Okim', 'Sign in to My Okim'],
    ['Portal', 'Instructor sign-in'],
  ]) {
    const menu = page.locator('.nav-toggle')
    if (await menu.isVisible()) await menu.click()
    await page.locator('#primary-navigation').getByRole('link', { name: linkName, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.getByRole('textbox')).toBeVisible()
    await page.goto('/')
  }
})

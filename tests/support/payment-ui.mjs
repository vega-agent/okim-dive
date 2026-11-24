import { expect, test } from '@playwright/test'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { readFile, mkdir } from 'node:fs/promises'
const require = createRequire(import.meta.url)
const { summarizeBooking } = require('../../src/lib/payment-schedule.ts')

test.describe('ui · isolated payment components', () => {
  let script, css
  test.beforeAll(async () => {
    const bundle = await build({
      entryPoints: ['tests/support/payment-ui-fixture.jsx'], write: false, bundle: true, jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'local-payment-response', setup(build) {
        build.onResolve({ filter: /^@\/lib\/payment-actions$/ }, () => ({ path: 'action', namespace: 'stub' }))
        build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const recordBookingPayment = form => window.respond(form)' }))
      } }],
    })
    script = bundle.outputFiles[0].text
    css = (await Promise.all(['styles/styles.css', 'styles/redesign.css', 'styles/portal-tabs.css'].map(path => readFile(path,'utf8')))).join('\n')
    await mkdir('/tmp/okim-task6-ui',{recursive:true})
  })
  const booking = { bookingId:'BKG-100', revision:2, currency:'MYR', originalPriceMinor:300000, discountMinor:15000, today:'2027-02-02',
    refundBaselineMinor:0, refundEntitlementMinor:0, cancellationKind:null,
    stages:[
      {id:'d1',position:1,kind:'deposit',amountMinor:50000,dueDate:'2027-01-01'},
      {id:'d2',position:2,kind:'deposit',amountMinor:70000,dueDate:'2027-02-01'},
      {id:'final',position:3,kind:'final',amountMinor:180000,dueDate:'2027-03-01'},
    ], allocations:[{paymentId:'a',stageId:'d1',amountMinor:50000,direction:'received'},{paymentId:'b',stageId:'d2',amountMinor:40000,direction:'received'}] }
  async function mount(page, locale, width, summary = summarizeBooking(booking), completed = false, wizard = false) {
    await page.setViewportSize({width,height:800})
    // Fulfill every request inside this browser context. No app, provider, or network transport is contacted.
    await page.route('**/*', route => route.request().resourceType() === 'document'
      ? route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="'+(locale==='zh'?'zh-CN':'en')+'"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>'}) : route.abort())
    await page.goto('http://localhost:3100/__isolated_payment_test')
    await page.addStyleTag({content:css})
    await page.evaluate(data => { window.fixture=data }, {summary,locale,completed,wizard})
    await page.addScriptTag({content:script})
    await expect(page.locator(wizard ? '.booking-summary' : 'table')).toBeVisible()
  }

  test('booking wizard keeps narrow stage labels and dates on individual lines in both languages', async ({page}) => {
    for (const locale of ['en','zh']) for (const width of [320,390]) {
      await mount(page, locale, width, summarizeBooking(booking), false, true)
      const rows = page.locator('.trip-payment-row')
      await expect(rows.first().locator('dt')).toHaveText(locale === 'zh' ? '订金 1' : 'Deposit 1')
      const fits = await rows.evaluateAll(elements => elements.every(row => {
        const term = row.querySelector('dt')
        const label = document.createRange()
        label.selectNodeContents(term)
        return label.getClientRects().length === 1 && row.querySelector('time').getClientRects().length === 1 &&
          term.getBoundingClientRect().bottom <= row.querySelector('dd').getBoundingClientRect().top &&
          row.scrollWidth <= row.clientWidth
      }))
      expect(fits).toBe(true)
    }
  })

  for (const width of [1280,390,320]) for (const locale of ['en','zh']) {
    test(locale + ' ' + width + 'px schedule fits each cell and shows the whole final adjustment', async ({page}) => {
      await mount(page,locale,width)
      expect(await page.locator('tbody tr').count()).toBe(3)
      await expect(page.locator('tbody tr').last()).toContainText('MYR 1,800.00')
      await expect(page.locator('tbody tr').last()).toContainText('MYR 150.00')
      const clipped = await page.locator('table,td,td > span').evaluateAll(els => els.filter(el => {
        const r = el.getBoundingClientRect()
        return r.right > innerWidth + 1 || r.left < -1 || el.scrollWidth > el.clientWidth + 1
      }).map(el => el.textContent))
      expect(clipped).toEqual([])
      if (width === 320) {
        const touching = await page.locator('tbody td').evaluateAll(cells => cells.filter(cell => {
          const label = cell.querySelector('.payment-cell-label')?.getBoundingClientRect()
          const value = cell.querySelector('.payment-cell-value')?.getBoundingClientRect()
          return !label || !value || (value.left - label.right < 6 && value.top - label.bottom < 3)
        }).map(cell => cell.textContent))
        expect(touching).toEqual([])
        const splitMoney = await page.locator('.payment-money').evaluateAll(values => values.some(value => value.getClientRects().length !== 1))
        expect(splitMoney).toBe(false)
      }
      if(locale==='en') expect(await page.locator('main').innerText()).not.toMatch(/[\u3400-\u9fff]/)
      await page.screenshot({path:'/tmp/okim-task6-ui/schedule-'+locale+'-'+width+'.png',fullPage:false})
    })
  }

  for (const width of [1280, 390, 320]) for (const locale of ['en', 'zh']) {
    test(locale + ' ' + width + 'px one-deposit, zero-final and refund history', async ({ page }) => {
      const one = { ...booking, originalPriceMinor: 50000, discountMinor: 0,
        stages: [booking.stages[0], { ...booking.stages[2], amountMinor: 0, dueDate: null }],
        allocations: [booking.allocations[0]],
      }
      const refund = { ...one, cancellationKind: 'operator_cancelled', refundEntitlementMinor: 50000,
        allocations: [...one.allocations, { paymentId: 'refund', stageId: 'd1', amountMinor: 15000, direction: 'refunded' }],
      }
      await mount(page, locale, width, summarizeBooking(refund))
      const schedule = page.locator('.booking-payment-schedule')
      await expect(schedule.locator('tbody tr')).toHaveCount(2)
      await expect(schedule.locator('tbody tr').last().locator('time')).toHaveCount(0)
      await expect(schedule).not.toContainText(locale === 'en' ? 'Deposit 2' : '订金 2')
      await expect(schedule).toContainText((locale === 'en' ? 'Still to refund' : '尚需退款') + ' MYR 350.00')
      await page.screenshot({ path: '/tmp/okim-task6-ui/refund-' + locale + '-' + width + '.png' })
      await mount(page, locale, width, summarizeBooking({ ...refund, cancellationKind: null, refundEntitlementMinor: 0 }), true)
      await expect(schedule).toContainText((locale === 'en' ? 'Refunded' : '已退') + ' MYR 150.00')
      await expect(schedule).not.toContainText(locale === 'en' ? 'Overdue' : '已逾期')
      await expect(schedule).not.toContainText(locale === 'en' ? 'Outstanding' : '待付')
    })
  }

  test('a failed retry keeps its key, pending blocks dismissal, stale preserves the bank amount and save links to its receipt', async ({page}) => {
    await mount(page,'en',390)
    const stale = summarizeBooking({...booking,revision:3,allocations:[...booking.allocations,{paymentId:'c',stageId:'d2',direction:'received',amountMinor:20000}]})
    await page.evaluate(stale => {
      window.calls=[]
      window.respond=form=>{
        window.calls.push(Object.fromEntries(form))
        if(window.calls.length===1) return Promise.resolve({status:'error',messageKey:'unavailable'})
        if(window.calls.length===2) return new Promise(resolve => { window.finish=()=>resolve({status:'stale',summary:stale}) })
        return Promise.resolve({status:'saved',receiptUrl:'/receipt/PAY-saved',paymentId:'PAY-saved',summary:stale})
      }
    },stale)
    const trigger=page.getByRole('button',{name:'Record payment'})
    await trigger.focus(); await page.keyboard.press('Enter')
    const dialog=page.getByRole('dialog')
    expect(await dialog.locator('button,input:not([type=hidden])').evaluateAll(controls =>
      controls.filter(el => el.getBoundingClientRect().height < 44).map(el => el.getAttribute('name') || el.textContent)
    )).toEqual([])
    await expect(dialog.locator('input[name=amount]')).toHaveValue('300.00')
    await expect(dialog.locator('input[name=paidOn]')).toHaveValue('2027-02-02')
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
    await trigger.click()
    await dialog.locator('input[name=amount]').fill('500')
    await dialog.locator('input[name=paidOn]').fill('2027-02-01')
    await dialog.getByRole('button',{name:'Confirm payment'}).click()
    await expect(dialog.getByRole('alert')).toContainText('could not be saved')
    await dialog.getByRole('button',{name:'Confirm payment'}).click()
    await expect(dialog.getByRole('button',{name:'Close'})).toBeDisabled()
    await page.keyboard.press('Escape')
    await page.mouse.click(0,0)
    await expect(dialog).toBeVisible()
    await page.evaluate(()=>window.finish())
    await expect(dialog.getByRole('alert')).toContainText('booking changed')
    await expect(dialog.locator('input[name=amount]')).toHaveValue('500')
    await expect(dialog.locator('input[name=paidOn]')).toHaveValue('2027-02-01')
    await expect(dialog).toContainText('MYR 100.00')
    await expect(dialog).toContainText('MYR 400.00')
    await dialog.getByRole('button',{name:'Confirm payment'}).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole('link',{name:'View receipt'})).toHaveAttribute('href','/receipt/PAY-saved')
    const calls=await page.evaluate(()=>window.calls)
    expect(calls[0].operationKey).toBe(calls[1].operationKey)
    expect(calls[1].operationKey).not.toBe(calls[2].operationKey)
    expect(calls[2]).toMatchObject({amount:'500',paidOn:'2027-02-01',expectedRevision:'3'})
  })
})

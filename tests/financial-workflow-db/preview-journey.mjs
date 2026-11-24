// One owner-coordinated browser run. Use only the explicitly approved 3100 preview.
// Requires PLAYWRIGHT_BASE_URL, matching AUTH_URL, OKIM_DISABLE_EMAILS=1,
// OKIM_PREVIEW_PID, OKIM_PREVIEW_CWD, and OKIM_RUN_HOSTED_PAYMENT_JOURNEY=1.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, realpathSync, rmdirSync } from 'node:fs'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { chromium, expect } from '@playwright/test'
import { parse } from 'dotenv'
import WebSocket from 'ws'

const base = process.env.PLAYWRIGHT_BASE_URL
const readsOnly = process.env.OKIM_PAYMENT_JOURNEY_READS_ONLY === '1'
const host = 'ep-purple-paper-ao84nvvx.c-2.ap-southeast-1.aws.neon.tech'
const reviewedFixtures = 'd0e294cd3bbc044a953fe529c56bf2ea7ea5e971e7fd36b597cb46c1b0c5df57'
const lock = '/tmp/okim-hosted-payment-journey.lock'
const runId = randomUUID()
const tripId = 'TRP-E2E-' + runId
const slug = tripId.toLowerCase()
const userId = 'USR-E2E-' + runId
const customerId = 'CUS-E2E-' + runId
const email = 'okim-journey-' + runId + '@example.com'
const name = 'Sample Diver ' + runId.slice(0, 8)
const ownerSession = randomUUID()
const rawToken = randomUUID()
const day = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10)
const partialPaidOn = day(-2)
const combinedPaidOn = day(-1)
const scope = [tripId, customerId, userId, email, ownerSession]
const bookPath = '/book/' + slug
let stage = 'validate preview'
let bookingId
let combinedReceiptPath
let firstReceiptPath

function requireOwnerPreview() {
  assert.ok(['http://localhost:3100', 'http://127.0.0.1:3100'].includes(base) &&
    process.env.AUTH_URL === base && process.env.OKIM_DISABLE_EMAILS === '1' &&
    process.env.OKIM_RUN_HOSTED_PAYMENT_JOURNEY === '1', 'Use the explicitly approved, email-suppressed 3100 preview.')
  const { OKIM_PREVIEW_PID: pid, OKIM_PREVIEW_CWD: cwd } = process.env
  assert.ok(/^\d+$/.test(pid ?? '') && cwd, 'Supply the approved preview PID and build directory.')
  const local = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const listeners = local('/usr/sbin/lsof', ['-nP', '-iTCP:3100', '-sTCP:LISTEN', '-t']).trim().split(/\s+/)
  assert.ok(new Set(listeners).size === 1 && listeners[0] === pid, 'Port 3100 listener changed.')
  const opened = local('/usr/sbin/lsof', ['-p', pid, '-a', '-d', 'cwd', '-Fn']).split('\n')
  assert.ok(opened.some(entry => entry === 'n' + realpathSync(cwd)), 'Port 3100 working directory does not match the approved build.')
  // The coordinator verifies server-side email suppression when launching this PID.
  return realpathSync(cwd)
}

function exactTarget(value) {
  const url = new URL(value)
  assert.ok(['postgresql:', 'postgres:'].includes(url.protocol) && url.hostname === host &&
    (!url.port || url.port === '5432') && url.pathname === '/neondb', 'Unexpected hosted database target.')
  return value
}

async function transaction(pool, mutate) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL statement_timeout = '15s'")
    await client.query("SET LOCAL lock_timeout = '5s'")
    await client.query('SET LOCAL search_path = pg_catalog,public')
    const result = await mutate(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

async function seed(pool, secret, targetVerified) {
  await transaction(pool, async db => {
    const { rows: [target] } = await db.query(`
      SELECT current_database() AS database,
        (SELECT meta::jsonb->>'approval' FROM audit_log WHERE id='payment-review-20261123' AND action='review_fixtures_replaced') AS approval,
        EXISTS(SELECT 1 FROM audit_log WHERE id='payment-schedule-20261123' AND action='payment_schedule_migrated') AS migrated,
        (SELECT u.id FROM customers c JOIN users u ON u.id=c.user_id WHERE c.id='CUS-001' AND u.role='instructor') AS instructor,
        (SELECT count(DISTINCT kind)::int FROM policy_versions WHERE kind IN ('refund','terms')) AS policies
    `)
    assert.ok(target.database === 'neondb' && target.approval === reviewedFixtures && target.migrated &&
      target.instructor && target.policies === 2, 'Expected migrated review database, owner, and two policy kinds.')
    targetVerified()
    await db.query("INSERT INTO users(id,email,name,role) VALUES ($1,$2,$3,'customer')", [userId, email, name])
    await db.query("INSERT INTO customers(id,user_id,email,name) VALUES ($1,$2,$3,$4)", [customerId, userId, email, name])
    const hashedToken = createHash('sha256').update(rawToken + secret).digest('hex')
    await db.query("INSERT INTO verification_tokens(identifier,token,expires) VALUES ($1,$2,now()+interval '10 minutes')", [email, hashedToken])
    await db.query(`INSERT INTO sessions("sessionToken","userId",expires) VALUES ($1,$2,now()+interval '30 minutes')`,
      [ownerSession, target.instructor])
    if (readsOnly) return
    await db.query(`
      INSERT INTO trips(id,slug,title_en,title_zh,status,published,sample,price_amount,currency,deposit_type,deposit_value,
        capacity,travel_start,travel_end,balance_due_date,balance_due_days,location_en,location_zh,departure_timezone)
      VALUES ($1,$2,$3,$4,'open',true,true,1000,'MYR','fixed',200,1,$5::date,$6::date,$7::date,15,'Tioman Island','刁曼岛','Asia/Kuala_Lumpur')
    `, [tripId, slug, 'Sample payment journey ' + runId.slice(0, 8), '示例付款行程 ' + runId.slice(0, 8), day(60), day(62), day(45)])
    await db.query(`
      INSERT INTO trip_deposits(id,trip_id,sort,amount,due_date,due_days)
      VALUES ($1,$2,0,200,$3::date,50),($4,$2,1,300,$5::date,30)
    `, [tripId + '-D1', tripId, day(10), tripId + '-D2', day(30)])
  })
}

async function cleanup(pool) {
  return transaction(pool, async db => {
    // Verify the exact temporary identity before selecting anything for deletion.
    const { rows: [guard] } = await db.query(`
      SELECT NOT EXISTS(SELECT 1 FROM bookings WHERE product_id=$1 AND customer_id<>$2) AS sole,
        NOT EXISTS(SELECT 1 FROM customers WHERE (id=$2 OR user_id=$3 OR email=$4)
          AND (id<>$2 OR user_id IS DISTINCT FROM $3 OR email<>$4)) AS exact
    `, scope.slice(0, 4))
    assert.ok(guard.sole && guard.exact, 'Unexpected identity in fixture scope. Review the run ID before manual cleanup.')
    await db.query(`
      CREATE TEMP TABLE owned_journey_bookings ON COMMIT DROP AS SELECT id FROM bookings
      WHERE product_id = ${"'" + tripId + "'"} AND customer_id = ${"'" + customerId + "'"}
    `)
    const { rows: [evidence] } = await db.query(`
      SELECT count(*)::int AS bookings, max(b.status) AS status, max(b.cancellation_kind) AS cancellation,
        to_char(max(b.refund_entitlement_amount),'FM999999990.00') AS entitlement,
        (SELECT count(*)::int FROM booking_stages WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) AS stages,
        (SELECT count(*)::int FROM points_ledger WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) AS points,
        (SELECT count(*)::int FROM invoices WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) AS invoices,
        (SELECT count(*)::int FROM payment_claims WHERE booking_id IN (SELECT id FROM owned_journey_bookings) AND status='verified') AS claims,
        (SELECT count(*)::int FROM payments WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) AS receipts,
        (SELECT count(*)::int FROM payment_allocations a JOIN payments p ON a.payment_id=p.id
          WHERE p.booking_id IN (SELECT id FROM owned_journey_bookings)) AS allocations,
        (SELECT sum(p.amount)::int FROM payments p WHERE p.kind='refund' AND p.source_payment_id IS NOT NULL AND
          p.booking_id IN (SELECT id FROM owned_journey_bookings)) AS source_linked_refunds,
        (SELECT count(*)::int FROM audit_log WHERE action='booking_policy_accepted' AND entity_id IN (SELECT id FROM owned_journey_bookings)
          AND nullif(meta::jsonb->>'refundVersionId','') IS NOT NULL AND nullif(meta::jsonb->>'termsVersionId','') IS NOT NULL AND
          meta::jsonb->>'depositsNonRefundableAcknowledged'='true') AS accepted
      FROM bookings b JOIN owned_journey_bookings owned ON b.id=owned.id
    `)
    await db.query('CREATE TEMP TABLE owned_journey_payments ON COMMIT DROP AS SELECT id,claim_id FROM payments WHERE booking_id IN (SELECT id FROM owned_journey_bookings)')
    await db.query(`
      CREATE TEMP TABLE owned_journey_audits ON COMMIT DROP AS SELECT id FROM audit_log
      WHERE entity_id IN (SELECT id FROM owned_journey_bookings UNION SELECT id FROM owned_journey_payments
        UNION SELECT claim_id FROM owned_journey_payments WHERE claim_id IS NOT NULL)
      OR actor_user_id = ${"'" + userId + "'"} OR entity_id IN (${"'" + tripId + "','" + customerId + "','" + userId + "'"})
    `)
    const deletions = [
      ['audit_log', 'id IN (SELECT id FROM owned_journey_audits)'],
      ['points_ledger', 'customer_id=$1', [customerId]],
      ['payment_allocations', 'payment_id IN (SELECT id FROM owned_journey_payments)'],
      ['payments', 'id IN (SELECT id FROM owned_journey_payments)'],
      ['payment_claims', 'booking_id IN (SELECT id FROM owned_journey_bookings)'],
      ['invoices', 'booking_id IN (SELECT id FROM owned_journey_bookings)'],
      ['booking_stages', 'booking_id IN (SELECT id FROM owned_journey_bookings)'],
      ['bookings', 'id IN (SELECT id FROM owned_journey_bookings)'],
      ['trip_deposits', 'trip_id=$1', [tripId]],
      ['trips', 'id=$1', [tripId]],
      ['verification_tokens', 'identifier=$1', [email]],
      ['signup_names', 'email=$1', [email]],
      ['sessions', '"userId"=$1 OR "sessionToken"=$2', [userId, ownerSession]],
      ['accounts', '"userId"=$1', [userId]],
      ['customers', 'id=$1 AND user_id=$2 AND email=$3', [customerId, userId, email]],
      ['users', 'id=$1 AND email=$2', [userId, email]],
    ]
    for (const [table, where, params] of deletions) await db.query(`DELETE FROM ${table} WHERE ${where}`, params)
    // The same exact predicates are audited together while the fixture IDs still exist.
    const residue = await db.query(`
      SELECT (SELECT count(*) FROM trips WHERE id=$1) +
        (SELECT count(*) FROM trip_deposits WHERE trip_id=$1) +
        (SELECT count(*) FROM bookings WHERE product_id=$1 OR customer_id=$2) +
        (SELECT count(*) FROM booking_stages WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) +
        (SELECT count(*) FROM invoices WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) +
        (SELECT count(*) FROM payment_claims WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) +
        (SELECT count(*) FROM payments WHERE booking_id IN (SELECT id FROM owned_journey_bookings)) +
        (SELECT count(*) FROM payment_allocations WHERE payment_id IN (SELECT id FROM owned_journey_payments)) +
        (SELECT count(*) FROM audit_log WHERE id IN (SELECT id FROM owned_journey_audits)) +
        (SELECT count(*) FROM points_ledger WHERE customer_id=$2) +
        (SELECT count(*) FROM customers WHERE id=$2 OR user_id=$3 OR email=$4) +
        (SELECT count(*) FROM users WHERE id=$3 OR email=$4) +
        (SELECT count(*) FROM accounts WHERE "userId"=$3) +
        (SELECT count(*) FROM sessions WHERE "userId"=$3 OR "sessionToken"=$5) +
        (SELECT count(*) FROM verification_tokens WHERE identifier=$4) +
        (SELECT count(*) FROM signup_names WHERE email=$4) AS remaining
    `, scope)
    assert.equal(Number(residue.rows[0].remaining), 0, 'Fixture cleanup left records behind.')
    return evidence
  })
}

async function browserContext(browser, viewport = { width: 1440, height: 920 }) {
  const context = await browser.newContext({ baseURL: base, viewport, serviceWorkers: 'block', reducedMotion: 'reduce' })
  context.setDefaultTimeout(12_000)
  context.setDefaultNavigationTimeout(18_000)
  await context.route('**/*', route => {
    const origin = new URL(route.request().url()).origin
    return origin === base ? route.continue() : route.abort()
  })
  return context
}

async function signInDiver(page, path) {
  const callback = new URL('/api/auth/callback/resend', base)
  callback.searchParams.set('callbackUrl', base + path)
  callback.searchParams.set('token', rawToken)
  callback.searchParams.set('email', email)
  await page.goto(callback.href)
  await page.waitForURL(base + path)
}

async function bookTrip(page) {
  await signInDiver(page, bookPath)
  await expect(page.locator('#b-name')).toHaveValue(name)
  await page.locator('select[name="cert_agency"]').selectOption('PADI')
  await page.locator('select[name="cert_level"]').selectOption('Open Water')
  await page.locator('#b-dives').fill('12')
  for (const field of ['insurance', 'medical']) await page.locator('input[name="' + field + '"]').check()
  await page.locator('#b-emergency-name').fill('Sample Contact')
  await page.locator('#b-emergency-phone').fill('+1 202 555 0123')
  await page.locator('#b-dob').fill('1990-05-15')
  const schedule = page.locator('form .booking-summary')
  for (const amount of ['200.00', '300.00', '500.00']) await expect(schedule).toContainText(amount)
  await page.locator('.booking-policy summary').click()
  await expect(page.locator('.booking-policy')).toHaveAttribute('open', '')
  await expect(page.getByRole('heading', { name: /Refund policy.*Version/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Terms of booking.*Version/ })).toBeVisible()
  await page.locator('input[name="accept_policy"]').check()
  await page.locator('input[name="accept_deposits"]').check()
  await page.getByRole('button', { name: 'Bring all', exact: true }).click()
  await expect(page.locator('form input[name="equipment"]')).toHaveValue(/"mask":"own"/)
  for (const field of ['insurance', 'medical', 'accept_policy', 'accept_deposits']) {
    await expect(page.locator('input[name="' + field + '"]')).toBeChecked()
  }
  await expect(page.locator('select[name="cert_level"]')).toHaveValue('Open Water')
  const result = page.locator('.booking-id')
  const error = page.locator('.booking-card .form-status-error')
  const action = page.waitForResponse(response =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === bookPath)
  await page.getByRole('button', { name: 'Create booking', exact: true }).click()
  const response = await action
  assert.ok(response.ok(), 'Booking action returned HTTP ' + response.status())
  await expect(result.or(error)).toBeVisible({ timeout: 12_000 })
  if (await error.isVisible()) throw Error('Booking validation: ' + (await error.innerText()).trim())
  await expect(result).toHaveText(/^BKG-[a-zA-Z0-9-]+$/)
  bookingId = (await result.innerText()).trim()
  await expect(page.locator('.booking-actions').getByRole('link', { name: /Invoice/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'View My Okim', exact: true }).click()
  await expect(page).toHaveURL('/myokim')
}

function panel(page, id, className) {
  return page.locator(className).filter({ hasText: id })
}

async function showStage(scope, stage, amounts) {
  const row = scope.getByRole('row', { name: new RegExp(stage) })
  await expect(row).toBeVisible()
  const cells = await row.locator('.payment-cell-value').allTextContents()
  assert.deepEqual(cells.slice(1).map(c => c.trim()), amounts.map(amount => 'MYR ' + amount))
}

async function showPaymentSchedule(scope, received, owing) {
  await expect(scope.locator('.payment-totals')).toHaveText('Received MYR ' + received + ' · Outstanding MYR ' + owing)
}

async function readReceipt(page, card, amount) {
  const receiptLink = card.getByRole('link', { name: new RegExp('^Receipt .*MYR ' + amount.replace('.', '\\.') + '$') })
  await expect(receiptLink).toBeVisible()
  const next = await receiptLink.getAttribute('href')
  assert.ok(next?.startsWith('/receipt/'))
  await receiptLink.click()
  await expect(page).toHaveURL(next)
  await expect(page.locator('.invoice-doc').getByRole('heading', { name: /^Receipt/ })).toBeVisible()
  return next
}

async function recordPayment(page, card, amount, bankDate, preview) {
  await card.getByRole('button', { name: 'Record payment', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Record payment', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.locator('input[name="amount"]').fill(amount)
  await dialog.locator('input[name="paidOn"]').fill(bankDate)
  for (const value of preview) await expect(dialog).toContainText(value)
  await dialog.getByRole('button', { name: 'Confirm payment', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 12_000 })
}

async function recordRefund(page, card, defaultAmount, amount) {
  await card.getByRole('button', { name: /Record refund/ }).click()
  const dialog = page.getByRole('dialog', { name: /refund/i })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('input[name="amount"]')).toHaveValue(defaultAmount)
  await dialog.locator('input[name="amount"]').fill(amount)
  await dialog.locator('input[name="paidOn"]').fill(day(-1))
  await dialog.getByRole('button', { name: 'Record refund', exact: true }).click()
  await expect(dialog).toBeHidden({ timeout: 12_000 })
}

async function checkDocumentPrivacy(diver, portal) {
  const ownInvoice = '/invoice/' + bookingId
  await diver.goto(ownInvoice)
  await expect(diver.locator('.invoice-doc')).toHaveCount(0)
  await diver.goto('/receipt/PAY-REVIEW-HISTORY-1')
  await expect(diver.locator('.invoice-doc')).toHaveCount(0)
  await portal.goto(ownInvoice)
  await expect(portal.locator('.invoice-doc').getByRole('heading', { name: /^Invoice/ })).toBeVisible()
}

async function inspectRetainedBookings(portal) {
  await portal.goto('/myokim')
  const points = panel(portal, 'BKG-REVIEW-POINTS', '#my-panel-upcoming .my-subcard')
  await expect(points).toContainText('points discount')
  await expect(points).toContainText('MYR 790.00')
  await portal.locator('#my-tab-past').click()
  const history = panel(portal, 'BKG-REVIEW-HISTORY', '#my-panel-past .my-past-row')
  await history.getByRole('link', { name: /^Invoice/ }).click()
  const invoice = portal.locator('.invoice-doc')
  await expect(invoice.getByRole('row', { name: /^Trip price.*MYR 3000\.00/ })).toBeVisible()
  await expect(invoice.locator('.payment-totals')).toHaveText('Received MYR 3,000.00')
  await portal.goto('/portal')
  await portal.locator('#portal-tab-trips').click()
  await portal.locator('#bookings > summary').click()
  await portal.locator('#bookings select').selectOption('TRP-REVIEW-ZERO')
  const zero = portal.locator('#booking-BKG-REVIEW-ZERO')
  await zero.locator('.portal-payment-history > summary').click()
  await showStage(zero, 'Final payment', ['0.00', '0.00', '0.00'])
  await expect(zero.getByRole('row', { name: /Final payment/ }).locator('time')).toHaveCount(0)
}

async function retainedReads(browser) {
  const divers = await browserContext(browser)
  const staff = await browserContext(browser)
  const outsider = await divers.newPage()
  const portal = await staff.newPage()
  await staff.addCookies([{ name: 'authjs.session-token', value: ownerSession, url: base, httpOnly: true, sameSite: 'Lax' }])
  const historicalReceipt = '/receipt/PAY-REVIEW-HISTORY-1'
  const failures = []
  async function check(label, read) {
    try {
      await read()
      console.log('Passed browser check: ' + label)
    } catch (error) {
      const summary = String(error.message).split('\n').filter(Boolean).slice(0, 2).join(' ')
      failures.push(label + ' — ' + summary)
    }
  }
  stage = 'retained browser assertions'
  await check('anonymous and unrelated customer document/portal denial', async () => {
    await outsider.goto(historicalReceipt)
    await expect(outsider).toHaveURL('/trips')
    await signInDiver(outsider, '/myokim')
    await expect(outsider.locator('#my-panel-upcoming')).toBeVisible()
    for (const path of [historicalReceipt, '/invoice/BKG-REVIEW-HISTORY']) {
      const response = await outsider.goto(path)
      assert.equal(response.status(), 404)
      await expect(outsider.locator('.invoice-doc')).toHaveCount(0)
    }
    const denied = await outsider.goto('/portal')
    assert.ok(denied.status() >= 400, 'An outsider must be denied the instructor portal.')
    await expect(outsider.locator('#portal-panel-actions')).toHaveCount(0)
  })
  await check('retained points discount, completed invoice and zero final', () => inspectRetainedBookings(portal))
  await check('retained receipt and Chinese mobile refund history', async () => {
    await portal.goto('/myokim')
    const combined = panel(portal, 'BKG-REVIEW-COMBINED', '#my-panel-upcoming .my-subcard')
    const href = await readReceipt(portal, combined, '950.00')
    const document = portal.locator('.invoice-doc')
    const expectedDate = '2026-11-19'
    for (const text of [expectedDate, 'Deposit 2', 'Final payment', '700.00', '250.00', '1550.00']) {
      await expect(document).toContainText(text)
    }
    const snapshotText = await document.innerText()
    await portal.reload()
    await expect(document).toHaveText(snapshotText, { useInnerText: true })
    await portal.setViewportSize({ width: 390, height: 844 })
    // Receipt locale is a browser preference. Toggle here to avoid a profile mutation.
    await portal.goto(href)
    await portal.locator('[data-lang-toggle]').click()
    await expect(portal.locator('html')).toHaveAttribute('lang', 'zh-CN')
    for (const text of [expectedDate, '订金 2', '尾款', '700.00', '250.00', '1550.00']) {
      await expect(document).toContainText(text)
    }
    await portal.goto('/myokim')
    await portal.locator('#my-tab-past').click()
    const refund = panel(portal, 'BKG-REVIEW-REFUND', '#my-panel-past .my-past-row')
    await expect(refund).toContainText('尚需退款 MYR 200.00')
    await expect(refund.getByRole('link', { name: /^退款记录 .*MYR 100\.00$/ })).toBeVisible()
    assert.ok(await portal.evaluate(() => window.document.documentElement.scrollWidth <= window.innerWidth), 'Chinese mobile page overflows.')
  })
  if (failures.length) throw Error(failures.join('\n'))
}

async function runJourney(browser) {
  const divers = await browserContext(browser)
  const staff = await browserContext(browser)
  await staff.addCookies([{ name: 'authjs.session-token', value: ownerSession, url: base, httpOnly: true, sameSite: 'Lax' }])
  const diver = await divers.newPage()
  const portal = await staff.newPage()
  const myTrip = () => panel(diver, bookingId, '#my-panel-upcoming .my-subcard')
  const action = () => panel(portal, bookingId, '#requests article')
  const refunds = () => panel(portal, bookingId, '#refunds article')
  stage = 'book and accept terms'
  await bookTrip(diver)
  await showPaymentSchedule(myTrip(), '0.00', '1,000.00')
  await showStage(myTrip(), 'Deposit 1', ['200.00', '0.00', '200.00'])

  stage = 'record partial first deposit'
  await portal.goto('/portal')
  await expect(action()).toBeVisible()
  await recordPayment(portal, action(), '75.00', partialPaidOn, ['Deposit 1 · MYR 75.00', 'Remaining after payment · MYR 925.00'])
  await showPaymentSchedule(action(), '75.00', '925.00')
  await showStage(action(), 'Deposit 1', ['200.00', '75.00', '125.00'])
  await diver.reload()
  await showPaymentSchedule(myTrip(), '75.00', '925.00')
  firstReceiptPath = await readReceipt(diver, myTrip(), '75.00')
  const firstDocument = diver.locator('.invoice-doc')
  await expect(firstDocument).toContainText('75.00')
  await expect(firstDocument.getByText(partialPaidOn, { exact: true })).toBeVisible()
  const firstSnapshotText = (await firstDocument.innerText()).replace(/\s+/g, ' ')

  stage = 'record a payment covering both deposits and final'
  await recordPayment(portal, action(), '575.00', combinedPaidOn, [
    'Deposit 1 · MYR 125.00', 'Deposit 2 · MYR 300.00', 'Final payment · MYR 150.00', 'Remaining after payment · MYR 350.00',
  ])
  await showPaymentSchedule(action(), '650.00', '350.00')
  await showStage(action(), 'Deposit 1', ['200.00', '200.00', '0.00'])
  await showStage(action(), 'Deposit 2', ['300.00', '300.00', '0.00'])
  await showStage(action(), 'Final payment', ['500.00', '150.00', '350.00'])
  await expect(action().locator('.status-badge')).toContainText(['Confirmed', 'Sample'])
  await diver.goto('/myokim')
  await showPaymentSchedule(myTrip(), '650.00', '350.00')
  await showStage(myTrip(), 'Final payment', ['500.00', '150.00', '350.00'])
  await expect(myTrip().getByRole('link', { name: /^Invoice/ })).toHaveCount(0)
  combinedReceiptPath = await readReceipt(diver, myTrip(), '575.00')
  const combined = diver.locator('.invoice-doc')
  await expect(combined.getByText(combinedPaidOn, { exact: true })).toBeVisible()
  for (const value of ['Deposit 1', 'Deposit 2', 'Final payment', '125.00', '300.00', '150.00', '350.00']) {
    await expect(combined).toContainText(value)
  }

  stage = 'cancel booking with refundable final payment'
  await action().getByRole('button', { name: 'Cancel booking', exact: true }).click()
  const cancellation = portal.getByRole('dialog', { name: 'Cancel booking', exact: true })
  await cancellation.locator('select[name="cancellationKind"]').selectOption('diver_withdrawal')
  await expect(cancellation).toContainText(/Deposits retained\s+MYR 500\.00/)
  await expect(cancellation).toContainText(/Refund due\s+MYR 150\.00/)
  await cancellation.locator('input[name="reason"]').fill('Synthetic diver withdrawal')
  await cancellation.getByRole('button', { name: 'Cancel booking', exact: true }).click()
  await expect(cancellation).toBeHidden()
  await expect(action()).toHaveCount(0)
  await expect(refunds()).toContainText(/Still to refund\s+MYR 150\.00/)

  stage = 'record partial and full refunds'
  await recordRefund(portal, refunds(), '150.00', '60.00')
  await expect(refunds()).toContainText(/Still to refund\s+MYR 90\.00/)
  await diver.goto('/myokim')
  await diver.locator('#my-tab-past').click()
  const past = panel(diver, bookingId, '#my-panel-past .my-past-row')
  await expect(past).toContainText('90.00')
  await expect(past.getByRole('link', { name: /^Refund record .*60\.00$/ })).toBeVisible()
  await recordRefund(portal, refunds(), '90.00', '90.00')
  await expect(refunds()).toHaveCount(0)
  await diver.reload()
  await diver.locator('#my-tab-past').click()
  await expect(past.getByRole('link', { name: /^Refund record .*90\.00$/ })).toBeVisible()
  await expect(past.getByRole('link', { name: /^Refund record/ })).toHaveCount(2)
  await past.locator('a[href="' + firstReceiptPath + '"]').click()
  await expect(diver).toHaveURL(firstReceiptPath)
  await expect(firstDocument).toContainText('75.00')
  assert.equal((await firstDocument.innerText()).replace(/\s+/g, ' '), firstSnapshotText)

  stage = 'check document authorization and retained history'
  await checkDocumentPrivacy(diver, portal)
  await inspectRetainedBookings(portal)

  stage = 'check Chinese mobile surfaces'
  await diver.setViewportSize({ width: 390, height: 844 })
  await diver.goto(combinedReceiptPath)
  const languageToggle = diver.locator('[data-lang-toggle]').filter({ visible: true })
  await languageToggle.click()
  await expect(diver.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(diver.locator('.invoice-doc')).toContainText('尾款')
  await expect(diver.locator('.invoice-doc')).toContainText('150.00')
  await diver.goto('/myokim')
  await diver.locator('#my-tab-past').click()
  await expect(past).toContainText('已取消')
  await expect(past.getByRole('link', { name: /^退款记录 .*60\.00$/ })).toBeVisible()
  assert.ok(await diver.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Chinese mobile page overflows.')
  await divers.close()
  await staff.close()
}

async function main() {
  const preview = requireOwnerPreview()
  const credentials = parse(readFileSync('.env.local'))
  const previewCredentials = parse(readFileSync(preview + '/.env.local'))
  const target = exactTarget(credentials.DATABASE_URL_UNPOOLED)
  exactTarget(previewCredentials.DATABASE_URL_UNPOOLED)
  assert.ok(credentials.AUTH_SECRET && credentials.AUTH_SECRET === previewCredentials.AUTH_SECRET,
    'The local fixture and approved preview must use the same Auth.js secret.')
  mkdirSync(lock, { mode: 0o700 })
  let browser
  let pool
  let mayHaveFixtures = false
  let routineError
  let evidence
  try {
    browser = await chromium.launch()
    neonConfig.webSocketConstructor = WebSocket
    pool = new Pool({ connectionString: target, max: 1, connectionTimeoutMillis: 5000 })
    stage = 'seed temporary hosted records'
    await seed(pool, credentials.AUTH_SECRET, () => { mayHaveFixtures = true })
    console.log('Opened one fixture scope ' + runId)
    if (readsOnly) await retainedReads(browser)
    else await runJourney(browser)
  } catch (error) {
    routineError = new Error('Journey failed at ' + stage, { cause: error })
  } finally {
    try {
      await browser?.close()
    } finally {
      try {
        if (mayHaveFixtures) {
          evidence = await cleanup(pool)
          console.log('Cleanup verified zero fixture rows across 16 tables for ' + runId)
          console.log('Before cleanup: ' + JSON.stringify(evidence))
        }
      } catch (error) {
        throw new Error('Fixture cleanup failed for run ' + runId, { cause: error })
      } finally {
        try {
          await pool?.end()
        } finally {
          rmdirSync(lock)
        }
      }
    }
  }
  if (routineError) throw routineError
  if (readsOnly) {
    assert.deepEqual(evidence, {
      bookings: 0, status: null, cancellation: null, entitlement: null, stages: 0, points: 0, invoices: 0,
      claims: 0, receipts: 0, allocations: 0, source_linked_refunds: null, accepted: 0,
    })
    console.log('Retained browser checks passed. Only temporary authentication records were created.')
    return
  }
  assert.deepEqual(evidence, {
    bookings: 1, status: 'cancelled', cancellation: 'diver_withdrawal', entitlement: '150.00',
    stages: 3, points: 0, invoices: 1, claims: 2, receipts: 4, allocations: 6, source_linked_refunds: 150, accepted: 1,
  })
  console.log('Browser journey passed. Two payments, two source-linked refunds, one policy acceptance, and no awarded points.')
}

try {
  await main()
} catch (error) {
  const redacted = value => String(value ?? '')
    .replaceAll(rawToken, '[redacted]')
    .replaceAll(ownerSession, '[redacted]')
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, '[redacted database URL]')
    .replace(/[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gi, '[redacted email]')
  console.error(redacted(error.message))
  if (error.cause) console.error(redacted(error.cause.message).split('\n').filter(Boolean).slice(0, readsOnly ? 2 : 8).join('\n'))
  process.exitCode = 1
}

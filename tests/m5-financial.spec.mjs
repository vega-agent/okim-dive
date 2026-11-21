import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const actions = {};

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000)})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL('**/trips');
  await page.request.get('/api/auth/session');
}

async function call(page, name, fields) {
  // Resolve the real React server-action reference from the rendered form.
  await page.goto('/portal');
  const ids = await page.locator('form').evaluateAll(forms => forms.map(f => ({ text: f.textContent, id: [...f.querySelectorAll('input')].find(i => i.name.startsWith('$ACTION_ID_'))?.name.slice(11) })));
  const labels = { recordPayment: 'Record payment', verifyPayment: 'Verify against bank record', refundPayment: 'Record completed external refund', redeemPoints: 'Apply points before payment', completeBooking: 'Record trip completion', reviewEligibility: 'Approve eligibility' };
  const id = ids.find(f => f.text.includes(labels[name]))?.id || actions[name];
  expect(id, `compiled reference for ${name}`).toBeTruthy();
  actions[name] = id;
  return page.request.post('/portal', { headers: { Origin: 'http://localhost:3100' }, multipart: { [`$ACTION_ID_${id}`]: '', ...fields } });
}

async function fixture(page) {
  const prefix = `M5-${randomUUID()}`;
  const email = `${prefix.toLowerCase()}@example.invalid`;
  await login(page, email);
  const [customer] = await sql`SELECT id FROM customers WHERE email = ${email}`;
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  await login(page, instructor);
  const trip = `${prefix}-trip`;
  await sql`INSERT INTO trips (id, slug, title_en, title_zh, status, price_amount, deposit_value, capacity, travel_start, travel_end, sample) VALUES (${trip}, ${trip.toLowerCase()}, 'Fictional transaction test', 'Fictional transaction test', 'open', 100, 30, 1, ${new Date(Date.now()+86400000*10)}, ${new Date(Date.now()+86400000*12)}, true)`;
  let sequence = 0;
  const booking = async (status = 'awaiting_deposit', customerId = customer.id) => {
    const id = `${prefix}-b${++sequence}`;
    await sql`INSERT INTO bookings (id, customer_id, product_id, status, currency, deposit_amount, balance_amount, declarations) VALUES (${id}, ${customerId}, ${trip}, ${status}, 'MYR', 30, 70, '{}')`;
    await sql`INSERT INTO invoices (id, booking_id, number) VALUES (${id}, ${id}, ${id})`;
    return id;
  };
  const pay = async (id, amount, kind = 'deposit') => {
    await call(page, 'recordPayment', { bookingId: id, amount: String(amount), currency: 'MYR', kind, reference: id, paidOn: '2026-01-01', operationKey: randomUUID() });
    const [claim] = await sql`SELECT id FROM payment_claims WHERE booking_id = ${id} AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1`;
    expect(claim).toBeTruthy();
    await call(page, 'verifyPayment', { claimId: claim.id });
    return `PAY-${claim.id}`;
  };
  const cleanup = async () => {
    await sql`DELETE FROM audit_log WHERE entity_id IN (SELECT id FROM payments WHERE booking_id LIKE ${prefix+'%'} UNION SELECT id FROM payment_claims WHERE booking_id LIKE ${prefix+'%'} UNION SELECT id FROM bookings WHERE id LIKE ${prefix+'%'})`;
    await sql`DELETE FROM points_ledger WHERE customer_id = ${customer.id} OR booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM payments WHERE booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM payment_claims WHERE booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM invoices WHERE booking_id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM bookings WHERE id LIKE ${prefix+'%'}`;
    await sql`DELETE FROM trips WHERE id = ${trip}`;
    await sql`DELETE FROM customers WHERE id = ${customer.id} OR id = ${prefix+'-rival'}`;
    await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${email})`;
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM users WHERE email = ${email}`;
  };
  return { prefix, email, customer: customer.id, trip, booking, pay, cleanup };
}

test('M5 real actions: partial threshold, duplicate verification, balance and concurrent last slot', async ({ page, context }) => {
  const f = await fixture(page);
  try {
    const a = await f.booking();
    const rival = `${f.prefix}-rival`;
    await sql`INSERT INTO customers (id, name, email) VALUES (${rival}, ${'Fictional rival '+f.prefix}, ${f.prefix.toLowerCase()+'-rival@example.invalid'})`;
    const b = await f.booking('awaiting_deposit', rival);
    const payment = await f.pay(a, 10);
    expect((await sql`SELECT status FROM bookings WHERE id = ${a}`)[0].status).toBe('awaiting_deposit');
    await call(page, 'verifyPayment', { claimId: payment.slice(4) });
    expect((await sql`SELECT count(*)::int n FROM payments WHERE id = ${payment}`)[0].n).toBe(1);
    for (const id of [a,b]) await call(page, 'recordPayment', { bookingId: id, amount: '30', currency: 'MYR', kind: 'deposit', reference: id, paidOn: '2026-01-01', operationKey: randomUUID() });
    const claims = await sql`SELECT id FROM payment_claims WHERE booking_id IN (${a}, ${b}) AND status = 'pending'`;
    const other = await context.newPage();
    await Promise.all(claims.map((c,i) => call(i ? other : page, 'verifyPayment', { claimId: c.id })));
    await other.close();
    const states = await sql`SELECT id, status FROM bookings WHERE id IN (${a}, ${b})`;
    expect(states.map(s=>s.status).sort()).toEqual(['confirmed','refund_flagged']);
    const winner = states.find(s=>s.status==='confirmed').id;
    await f.pay(winner, 70, 'balance');
    expect((await sql`SELECT status FROM bookings WHERE id = ${winner}`)[0].status).toBe('confirmed');
    expect((await sql`SELECT count(*)::int n FROM payments WHERE booking_id IN (${a}, ${b})`)[0].n).toBe(4);
  } finally { await f.cleanup(); }
});

test('M5 authenticated rendered portal and receipt bilingual interactions and design measurements', async ({ page }, testInfo) => {
  const f = await fixture(page);
  try {
    const b = await f.booking();
    await page.goto('/portal');
    const form = page.locator('form').filter({has:page.locator('input[name="kind"]')});
    await form.locator('input[name="kind"][value="deposit"]').check();
    await form.locator('select[name="bookingId"]').selectOption(b);
    for (const [name,value] of Object.entries({amount:'30',reference:'Fictional browser payment',paidOn:'2026-01-01'})) await form.locator(`[name="${name}"]`).fill(value);
    await form.getByRole('button', {name:'Record payment',exact:true}).click();
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM payment_claims WHERE booking_id=${b}`)[0].n).toBe(1);
    await page.reload();
    const [claim] = await sql`SELECT id FROM payment_claims WHERE booking_id=${b}`;
    const verify = page.locator('form').filter({has:page.locator(`input[value="${claim.id}"]`)});
    await verify.getByRole('button').click();
    await expect.poll(async () => (await sql`SELECT status FROM bookings WHERE id=${b}`)[0].status).toBe('confirmed');
    await page.reload();
    for (const lang of ['en','zh']) {
      if (lang==='zh') await page.locator('[data-lang-toggle]').click();
      await expect(page.locator('main h1')).toHaveText(lang==='en'?'Instructor portal':'教练工作台');
      const help = page.locator('#record .portal-help-toggle');
      await help.click();
      await expect(page.locator('#record-help')).toBeVisible();
      await expect(page.locator('#record-help')).toContainText(lang==='en'?'Choose the booking':'选择预订');
      await help.click();
      await expect(page.locator('#record-help')).toBeHidden();
      const details = page.locator('article').filter({hasText:b}).locator('details');
      await details.locator('summary').click();
      await expect(details).toHaveAttribute('open','');
      await details.locator('summary').click();
      const measurements = await page.evaluate(() => ({
        viewport:innerWidth, scroll:document.documentElement.scrollWidth,
        controls:[...document.querySelectorAll('main button, main input:not([type="hidden"]):not([type="radio"]), main select, main .kind-pill')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,width:r.width,height:r.height,color:s.color,background:s.backgroundColor};}),
        headingFont:getComputedStyle(document.querySelector('main h1')).fontFamily
      }));
      await testInfo.attach(`portal-${lang}-measurements`,{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
      expect(measurements.scroll).toBeLessThanOrEqual(measurements.viewport);
      expect(measurements.controls.every(c=>c.height>=44 && c.width>=44)).toBeTruthy();
      const contrast = await page.locator('main .btn-primary').first().evaluate(e=>{
        const s=getComputedStyle(e);
        const luminance=color=>color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        const a=luminance(s.color),b=luminance(s.backgroundColor);
        return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      });
      await testInfo.attach(`portal-${lang}-primary-contrast`,{body:String(contrast),contentType:'text/plain'});
      console.log('M5 portal evidence', JSON.stringify({project:testInfo.project.name,lang,viewport:measurements.viewport,scroll:measurements.scroll,headingFont:measurements.headingFont,minControlWidth:Math.min(...measurements.controls.map(c=>c.width)),minControlHeight:Math.min(...measurements.controls.map(c=>c.height)),primaryContrast:contrast}));
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    await page.locator(`a[href="/receipt/PAY-${claim.id}"]`).click();
    // Receipt starts with customer locale, then responds to the real global toggle.
    await expect(page.locator('.invoice-doc')).toContainText('MYR 30.00');
    for (const lang of ['en','zh']) {
      if ((await page.locator('html').getAttribute('lang')) !== (lang==='en'?'en':'zh-CN')) await page.locator('[data-lang-toggle]').click();
      // The toggle emits even when the customer locale differs from stored browser locale.
      if (!(await page.locator('.invoice-doc h1').textContent()).includes(lang==='en'?'Receipt':'收据')) {
        await page.locator('[data-lang-toggle]').click();
        await page.locator('[data-lang-toggle]').click();
      }
      await expect(page.locator('.invoice-doc h1')).toContainText(lang==='en'?'Receipt':'收据');
      const dimensions = await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(document.querySelector('.invoice-meta')).gridTemplateColumns}));
      await testInfo.attach(`receipt-${lang}-layout`,{body:JSON.stringify(dimensions),contentType:'application/json'});
      console.log('M5 receipt evidence', JSON.stringify({project:testInfo.project.name,lang,...dimensions}));
      expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
    }
    await page.evaluate(()=>{window.__printed=false;window.print=()=>{window.__printed=true;};});
    await page.locator('.invoice-head button').click();
    expect(await page.evaluate(()=>window.__printed)).toBe(true);
    await page.emulateMedia({media:'print'});
    await expect(page.locator('.invoice-head button')).toBeHidden();
    await expect(page.locator('.navbar')).toBeHidden();
    expect(await page.locator('.invoice-doc').evaluate(e=>getComputedStyle(e).boxShadow)).toBe('none');
  } finally { await f.cleanup(); }
});

test('M5 operation-key mismatch rejects payment, refund and redemption without mutations', async ({ page }) => {
  const f = await fixture(page);
  try {
    const source = await f.booking('completed');
    const target = await f.booking();
    const key = randomUUID();
    const fields = {bookingId:source, amount:'100', currency:'MYR', kind:'deposit', reference:'Fictional reference', paidOn:'2026-01-01', operationKey:key};
    expect((await call(page,'recordPayment',fields)).status()).toBe(200);
    for (const change of [{amount:'101'}, {bookingId:target}, {kind:'full'}, {reference:'Different reference'}]) {
      expect((await call(page,'recordPayment',{...fields,...change})).status()).toBe(500);
    }
    expect(await sql`SELECT id FROM payment_claims WHERE operation_key=${key}`).toHaveLength(1);
    const [claim] = await sql`SELECT id FROM payment_claims WHERE operation_key=${key}`;
    await call(page,'verifyPayment',{claimId:claim.id});
    const payment = `PAY-${claim.id}`;
    const refundKey = randomUUID();
    const refund = {paymentId:payment,amount:'1',reason:'Fictional refund',operationKey:refundKey};
    await call(page,'refundPayment',refund);
    expect((await call(page,'refundPayment',{...refund,amount:'2'})).status()).toBe(500);
    expect(await sql`SELECT id FROM payments WHERE operation_key=${refundKey}`).toHaveLength(1);
    await sql`UPDATE bookings SET status='completed' WHERE id=${source}`;
    const redemptionKey = randomUUID();
    await call(page,'redeemPoints',{bookingId:target,points:'40',operationKey:redemptionKey});
    const next = await f.booking();
    for (const fields of [{bookingId:target,points:'41'}, {bookingId:next,points:'40'}]) {
      expect((await call(page,'redeemPoints',{...fields,operationKey:redemptionKey})).status()).toBe(500);
    }
    expect(await sql`SELECT id FROM points_ledger WHERE operation_key=${redemptionKey}`).toHaveLength(1);
    expect((await sql`SELECT balance_amount FROM bookings WHERE id=${target}`)[0].balance_amount).toBe('68.00');
    expect((await sql`SELECT balance_amount FROM bookings WHERE id=${next}`)[0].balance_amount).toBe('70.00');
  } finally { await f.cleanup(); }
});

test('M5 real actions: cumulative refund rounding, over-refund rollback and receipt ownership', async ({ page, browser }) => {
  const f = await fixture(page);
  try {
    const b = await f.booking();
    const p = await f.pay(b, 3);
    for (const amount of ['0.50','0.50','2.00','0.01']) await call(page, 'refundPayment', { paymentId:p, amount, reason:'Fictional test refund', operationKey:randomUUID() });
    const refunds = await sql`SELECT amount FROM payments WHERE source_payment_id = ${p}`;
    expect(refunds.map(r=>Number(r.amount)).reduce((s,n)=>s+n,0)).toBe(3);
    const reversals = await sql`SELECT points FROM points_ledger WHERE source_lot_id = ${'EARN-'+p}`;
    expect(reversals.reduce((s,r)=>s+r.points,0)).toBe(-3);
    await login(page, f.email);
    await page.goto(`/receipt/${p}`);
    await expect(page.locator('.invoice-doc')).toContainText('MYR 3.00');
    const anon = await browser.newContext();
    const outsider = await anon.newPage();
    await outsider.goto(`http://localhost:3100/receipt/${p}`);
    await expect(outsider).toHaveURL(/\/trips$/);
    await login(outsider, `${f.prefix.toLowerCase()}-other@example.invalid`);
    expect((await outsider.goto(`/receipt/${p}`)).status()).toBe(404);
    expect((await outsider.goto('/portal')).status()).toBe(500);
    const denied = await outsider.request.post('/portal', { multipart: { [`$ACTION_ID_${actions.refundPayment}`]: '', paymentId:p, amount:'0.01', reason:'Unauthorized fictional test', operationKey:randomUUID() } });
    expect(denied.status()).toBe(500);
    expect((await sql`SELECT count(*)::int n FROM payments WHERE source_payment_id=${p}`)[0].n).toBe(3);
    await anon.close();
    const otherEmail = `${f.prefix.toLowerCase()}-other@example.invalid`;
    await sql`DELETE FROM customers WHERE email = ${otherEmail}`;
    await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${otherEmail})`;
    await sql`DELETE FROM users WHERE email = ${otherEmail}`;
  } finally { await f.cleanup(); }
});

test('M5 real actions: completion gating, expiry, 20% cap, single redemption replay and original-expiry restoration', async ({ page }) => {
  const f = await fixture(page);
  try {
    const source = await f.booking();
    const target = await f.booking();
    const p = await f.pay(source, 500);
    await call(page,'completeBooking',{ bookingId:source });
    expect((await sql`SELECT status FROM bookings WHERE id = ${source}`)[0].status).toBe('confirmed');
    await call(page,'reviewEligibility',{ bookingId:source, decision:'approved' });
    await call(page,'completeBooking',{ bookingId:source });
    expect((await sql`SELECT status FROM bookings WHERE id = ${source}`)[0].status).toBe('confirmed');
    const key = randomUUID();
    await call(page,'redeemPoints',{ bookingId:target, points:'100', operationKey:key });
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE type='redeemed' AND booking_id=${target}`)[0].n).toBe(0);
    await sql`UPDATE trips SET travel_end = ${new Date(Date.now()-86400000)} WHERE id = ${f.trip}`;
    await call(page,'completeBooking',{ bookingId:source });
    expect((await sql`SELECT status FROM bookings WHERE id = ${source}`)[0].status).toBe('completed');
    await sql`UPDATE trips SET travel_end = ${new Date(Date.now()+86400000*12)} WHERE id = ${f.trip}`;
    await call(page,'redeemPoints',{ bookingId:target, points:'401', operationKey:randomUUID() });
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE type='redeemed' AND booking_id=${target}`)[0].n).toBe(0);
    const expired = `${f.prefix}-expired`;
    await sql`INSERT INTO points_ledger (id, customer_id, booking_id, type, points, expires_at) VALUES (${expired}, ${f.customer}, ${source}, 'earned', 100, ${new Date(Date.now()-86400000)})`;
    await call(page,'redeemPoints',{ bookingId:target, points:'400', operationKey:key });
    await call(page,'redeemPoints',{ bookingId:target, points:'400', operationKey:key });
    await call(page,'redeemPoints',{ bookingId:target, points:'100', operationKey:randomUUID() });
    const rows = await sql`SELECT * FROM points_ledger WHERE booking_id=${target} AND type='redeemed'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].points).toBe(-400);
    expect(rows[0].source_lot_id).toBe('EARN-'+p);
    expect((await sql`SELECT * FROM points_ledger WHERE source_lot_id=${expired} AND type='expired'`)).toHaveLength(1);
    expect((await sql`SELECT balance_amount, points_discount_amount FROM bookings WHERE id=${target}`)[0]).toMatchObject({ balance_amount:'50.00', points_discount_amount:'20.00' });
    const targetPayment = await f.pay(target, 30);
    for (let i=0;i<2;i++) await call(page,'refundPayment',{ paymentId:targetPayment, amount:'1', reason:'Fictional restoration', operationKey:randomUUID() });
    const restores = await sql`SELECT * FROM points_ledger WHERE note=${'restore:'+rows[0].id}`;
    expect(restores).toHaveLength(1);
    expect(restores[0].points).toBe(400);
    expect(new Date(restores[0].expires_at).getTime()).toBe(new Date(rows[0].expires_at).getTime());
    // Simulate the original lot aging out after restoration, without renewing it.
    await sql`UPDATE points_ledger SET expires_at = ${new Date(Date.now()-86400000)} WHERE id=${'EARN-'+p} OR source_lot_id=${'EARN-'+p}`;
    const next = await f.booking();
    const denied = await call(page,'redeemPoints',{ bookingId:next, points:'400', operationKey:randomUUID() });
    expect(denied.status()).toBe(500);
    expect(await sql`SELECT id FROM points_ledger WHERE booking_id=${next} AND type='redeemed'`).toHaveLength(0);
    expect((await sql`SELECT balance_amount, points_discount_amount FROM bookings WHERE id=${next}`)[0]).toMatchObject({balance_amount:'70.00',points_discount_amount:null});
    expect(await sql`SELECT id FROM points_ledger WHERE note=${'restore:'+rows[0].id}`).toHaveLength(1);
  } finally { await f.cleanup(); }
});

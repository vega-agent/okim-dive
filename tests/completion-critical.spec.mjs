import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { randomUUID, createHash } from 'node:crypto';
if (process.env.OKIM_DISABLE_EMAILS !== '1') throw new Error('Completion audit requires OKIM_DISABLE_EMAILS=1 in both test and local server environments');
config({path:'.env.local'});
const sql=neon(process.env.DATABASE_URL);
const base=process.env.COMPLETION_TEST_URL ?? 'http://localhost:3100';
test('real concurrent actions, customer forgery, guards, payments, redemption and current-version acceptance',async({page,browser})=>{
 test.setTimeout(120000);
 const p='CC-'+randomUUID(), email=p.toLowerCase()+'@example.com', tokens=[], ownedSessions=[];
 let uid;
 const login=async(page,email,target)=>{
  const raw=randomUUID(), token=createHash('sha256').update(raw+process.env.AUTH_SECRET).digest('hex'); tokens.push(token);
  await sql`INSERT INTO verification_tokens(identifier,token,expires) VALUES (${email},${token},${new Date(Date.now()+900000).toISOString()})`;
  try {
   await page.goto(`${base}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(base+target)}&token=${raw}&email=${encodeURIComponent(email)}`);
   await page.waitForURL('**'+target);
  } finally {
   ownedSessions.push(...(await page.context().cookies(base)).filter(c => /^(?:__Secure-)?authjs\.session-token$/.test(c.name)).map(c => c.value));
  }
 };
 const post=async(request,action,fields)=>request.post(base+'/portal',{multipart:{['$ACTION_ID_'+action]:'',...fields}});
 const zero=async(id)=>expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id=${id}`)[0].n).toBe(0);
 try{
  await sql`INSERT INTO users(id,email,role) VALUES (${p},${email},'customer')`; uid=p;
  await sql`INSERT INTO customers(id,user_id,name,email) VALUES (${p},${p},${p},${email})`;
  for(const suffix of ['past','future','wizard']) await sql`INSERT INTO trips(id,slug,title_en,title_zh,status,published,sample,price_amount,deposit_value,capacity,travel_start,travel_end,rm_rate) VALUES (${p+'-'+suffix},${(p+'-'+suffix).toLowerCase()},'Critical fixture','关键测试','open',true,true,200,20,100,${new Date(Date.now()+(suffix==='past'?-10:30)*86400000).toISOString()},${new Date(Date.now()+(suffix==='past'?-2:35)*86400000).toISOString()},1)`;
  for(const suffix of ['race','cancel','declined','noshow','future','received','verify','redeem']) await sql`INSERT INTO bookings(id,customer_id,product_id,status,eligibility_status,currency,deposit_amount,balance_amount,declarations,cancel_reason) VALUES (${p+'-'+suffix},${p},${p+(['race','cancel','declined','noshow'].includes(suffix)?'-past':'-future')},${['received','verify','redeem'].includes(suffix)?'awaiting_deposit':suffix==='cancel'?'cancelled':'confirmed'},${suffix==='declined'?'declined':'approved'},'MYR',40,160,'{}',${suffix==='noshow'?'No-show':null})`;
  await sql`INSERT INTO payments(id,booking_id,kind,amount,currency,rm_rate,rm_amount,verified_at) VALUES (${p+'-cash'},${p+'-race'},'full',200,'MYR',1,200,NOW())`;
  await sql`INSERT INTO payment_claims(id,booking_id,amount,currency,paid_on,reference,kind,status) VALUES (${p+'-claim'},${p+'-verify'},40,'MYR',NOW(),${p+'-verify'},'deposit','pending')`;
  await login(page,process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim(),'/portal');
  const html=await (await page.request.get(base+'/portal')).text();
  const forms=[...html.matchAll(/<form\b[\s\S]*?<\/form>/g)].map(m=>m[0]);
  const completeForm=forms.find(f=>f.includes('name="participated"')&&f.includes(p+'-race'));
  const action=completeForm.match(/name="\$ACTION_ID_([^"]+)"/)[1];
  const responses=await Promise.all([post(page.request,action,{bookingId:p+'-race',participated:'on'}),post(page.request,action,{bookingId:p+'-race',participated:'on'})]);
  expect(responses.map(r=>r.status())).toEqual([200,200]);
  expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id=${p+'-race'} AND type='earned'`)[0].n).toBe(1);
  expect((await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id=${p+'-race'} AND action='booking_completed'`)[0].n).toBe(1);
  for(const suffix of ['cancel','declined','noshow','future']){
   const response=await post(page.request,action,{bookingId:p+'-'+suffix,participated:'on'});
   expect(response.status()).toBe(500); await zero(p+'-'+suffix);
   expect((await sql`SELECT completed_at FROM bookings WHERE id=${p+'-'+suffix}`)[0].completed_at).toBeNull();
  }
  const context=await browser.newContext(), customer=await context.newPage();
  await login(customer,email,'/myokim');
  const forged=await post(customer.request,action,{bookingId:p+'-future',participated:'on'});
  expect(forged.status()).toBe(500); await zero(p+'-future');
  // Actual verification and Received server actions, using their SSR action identifiers.
  const verifyForm=forms.find(f=>f.includes('name="claimId"')&&f.includes(p+'-claim'));
  const verifyId=verifyForm.match(/name="\$ACTION_ID_([^"]+)"/)[1];
  expect((await post(page.request,verifyId,{claimId:p+'-claim'})).status()).toBe(200);
  await zero(p+'-verify');
  await page.reload();
  const requestCard=page.locator('.portal-request',{hasText:p+'-received'});
  await requestCard.getByRole('button',{name:'Received',exact:true}).click();
  await expect.poll(async()=> (await sql`SELECT count(*)::int n FROM payments WHERE booking_id=${p+'-received'}`)[0].n).toBe(1);
  await zero(p+'-received');
  // Newly awarded points are spendable immediately, without a delay.
  await page.goto('/portal#money'); await page.locator('#portal-tab-money').click();
  const redemption=page.locator('form').filter({has:page.locator('input[name=points]')});
  await redemption.locator('select[name=bookingId]').selectOption(p+'-redeem');
  await redemption.locator('input[name=points]').fill('100');
  await redemption.getByRole('button',{name:'Apply points before payment'}).click();
  await expect.poll(async()=> (await sql`SELECT points_discount_amount FROM bookings WHERE id=${p+'-redeem'}`)[0].points_discount_amount).toBe('5.00');
  expect((await sql`SELECT sum(points)::int n FROM points_ledger WHERE booking_id=${p+'-redeem'} AND type='redeemed'`)[0].n).toBe(-100);
  // A real wizard submit records the current terms version, not a fixture SQL acceptance.
  const fillWizard = async () => {
    await customer.goto('/book/'+(p+'-wizard').toLowerCase());
    await customer.locator('select[name=cert_agency]').selectOption('PADI');
    await customer.locator('select[name=cert_level]').selectOption('Open Water');
    await customer.locator('#b-dives').fill('15'); await customer.locator('#b-name').fill(p);
    await customer.locator('#b-emergency-name').fill('Contact'); await customer.locator('#b-emergency-phone').fill('12345');
    await customer.locator('#b-dob').fill('1990-01-01');
    for(const name of ['insurance','medical','accept_policy']) await customer.locator('input[name='+name+']').check();
    await customer.getByRole('button',{name:'Bring all',exact:true}).click();
    await expect(customer.locator('.form-status-error')).toHaveCount(0);
  };
  for (const field of ['refund_version_id', 'terms_version_id']) {
    // Each rejection starts with fresh React state and current policy IDs.
    await fillWizard();
    await customer.locator(`input[name=${field}]`).evaluate(el => { el.value = 'stale-policy'; });
    const responsePromise = customer.waitForResponse(response =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/book/' + (p+'-wizard').toLowerCase());
    await customer.getByRole('button',{name:'Create booking',exact:true}).click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    expect(response.request().postData()).toContain('stale-policy');
    // Next 14.2 quirk: rejection flight streams may not close (gzip-dependent);
    // assert the user-visible outcome instead of response.finished().
    await expect(customer.locator('.form-status-error')).toHaveText('Please complete all required fields and accept the policies.');
    await expect(customer.getByRole('button',{name:'Create booking',exact:true})).toBeEnabled();
    expect((await sql`SELECT count(*)::int n FROM bookings WHERE customer_id=${p} AND product_id=${p+'-wizard'}`)[0].n).toBe(0);
  }
  await fillWizard();
  await customer.getByRole('button',{name:'Create booking',exact:true}).click();
  await expect(customer.locator('.booking-id')).toBeVisible();
  const newId=(await customer.locator('.booking-id').textContent()).trim();
  const [accepted]=await sql`SELECT declarations,accepted_at FROM bookings WHERE id=${newId}`;
  expect(accepted.declarations.termsVersionId).toBe('POL-TERMS-001'); expect(accepted.accepted_at).toBeTruthy();
  await context.close();
 }finally{
  const bids=(await sql`SELECT id FROM bookings WHERE customer_id=${p}`).map(r=>r.id);
  await sql.transaction([
   sql`DELETE FROM audit_log WHERE entity_id=ANY(${bids}) OR entity_id LIKE ${p+'%'} OR actor_user_id=${p} OR entity_id IN (SELECT id FROM payments WHERE booking_id=ANY(${bids})) OR entity_id IN (SELECT id FROM payment_claims WHERE booking_id=ANY(${bids}))`,
   sql`DELETE FROM points_ledger WHERE customer_id=${p}`,sql`DELETE FROM payments WHERE booking_id=ANY(${bids})`,sql`DELETE FROM payment_claims WHERE booking_id=ANY(${bids})`,sql`DELETE FROM invoices WHERE booking_id=ANY(${bids})`,sql`DELETE FROM bookings WHERE customer_id=${p}`,sql`DELETE FROM customers WHERE id=${p}`,sql`DELETE FROM sessions WHERE "userId"=${p}`,sql`DELETE FROM users WHERE id=${p}`,sql`DELETE FROM trips WHERE id LIKE ${p+'%'}`,sql`DELETE FROM verification_tokens WHERE token=ANY(${tokens})`,sql`DELETE FROM sessions WHERE "sessionToken"=ANY(${ownedSessions})`
  ]);
  expect((await sql`SELECT count(*)::int n FROM bookings WHERE customer_id=${p}`)[0].n).toBe(0);
 }
});

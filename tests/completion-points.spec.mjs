import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';
if (process.env.OKIM_DISABLE_EMAILS !== '1') throw new Error('Completion audit requires OKIM_DISABLE_EMAILS=1 in both test and local server environments');
config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const base = process.env.COMPLETION_TEST_URL ?? 'http://localhost:3100';
test('completion awards, replay, refunds, exclusions, legacy, no points restoration and bilingual terms', async ({ page }) => {
  test.setTimeout(60000);
  const prefix = 'CP-' + randomUUID();
  const tokens = [];
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  const login = async (p, email, target) => {
    const raw = randomUUID();
    const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
    tokens.push(token);
    await sql`INSERT INTO verification_tokens (identifier,token,expires) VALUES (${email},${token},${new Date(Date.now()+900000).toISOString()})`;
    await p.goto(`${base}/api/auth/callback/resend?callbackUrl=${encodeURIComponent(base+target)}&token=${raw}&email=${encodeURIComponent(email)}`);
    await p.waitForURL(`**${target}`);
  };
  const row = id => page.locator(`#booking-${id}`);
  const complete = async id => {
    await page.goto('/portal#bookings');
    await page.locator('#portal-tab-bookings').click();
    await page.getByRole('radio', { name: 'All', exact: true }).check();
    const more = page.getByRole('button', { name: /Show all/ });
    if (await more.count()) await more.first().click();
    await row(id).locator('input[name=participated]').check();
    await row(id).getByRole('button', { name: 'Complete individual booking' }).click();
  };
  try {
    await sql`INSERT INTO customers(id,name,email) VALUES (${prefix},${prefix},${prefix+'@example.com'})`;
    await sql`INSERT INTO trips(id,slug,title_en,title_zh,status,price_amount,deposit_value,capacity,travel_start,travel_end,rm_rate,sample) VALUES (${prefix},${prefix.toLowerCase()},'Completion fixture','完成测试','completed',200,20,100,NOW()-INTERVAL '10 days',NOW()-INTERVAL '2 days',9,true)`;
    await sql`INSERT INTO trips(id,slug,title_en,title_zh,status,price_amount,deposit_value,capacity,travel_start,travel_end,rm_rate,sample) VALUES (${prefix+'-fut'},${(prefix+'-fut').toLowerCase()},'Future fixture','未来测试','open',200,20,100,NOW()+INTERVAL '30 days',NOW()+INTERVAL '35 days',1,true)`;
    await sql`INSERT INTO bookings(id,customer_id,product_id,status,eligibility_status,currency,deposit_amount,balance_amount,declarations) VALUES (${prefix+'-spend'},${prefix},${prefix+'-fut'},'awaiting_deposit','approved','MYR',20,180,'{}')`;
    for (const suffix of ['net','cancel','declined','no-show','pending','legacy']) {
      const status = suffix==='cancel' ? 'cancelled' : suffix==='pending' ? 'awaiting_deposit' : 'confirmed';
      await sql`INSERT INTO bookings(id,customer_id,product_id,status,eligibility_status,currency,deposit_amount,balance_amount,declarations,cancel_reason) VALUES (${prefix+'-'+suffix},${prefix},${prefix},${status},${suffix==='declined'?'declined':'approved'},'MYR',20,180,'{}',${suffix==='no-show'?'No-show':null})`;
    }
    const bid=prefix+'-net';
    await sql`INSERT INTO payments(id,booking_id,kind,amount,currency,rm_rate,rm_amount,verified_at) VALUES (${prefix+'-p1'},${bid},'deposit',100,'MYR',1.5,150,NOW()),(${prefix+'-p2'},${bid},'balance',50,'MYR',2,100,NOW())`;
    await sql`INSERT INTO payments(id,booking_id,source_payment_id,kind,amount,currency,rm_rate,rm_amount,verified_at) VALUES (${prefix+'-r0'},${bid},${prefix+'-p1'},'refund',20,'MYR',1.5,30,NOW())`;
    await sql`UPDATE bookings SET points_discount_amount=10 WHERE id=${bid}`;
    await sql`INSERT INTO payments(id,booking_id,kind,amount,currency,rm_rate,rm_amount,verified_at) VALUES (${prefix+'-lp'},${prefix+'-legacy'},'full',20,'MYR',1,20,NOW())`;
    await sql`INSERT INTO points_ledger(id,customer_id,booking_id,payment_id,type,points,expires_at) VALUES (${prefix+'-legacy-lot'},${prefix},${prefix+'-legacy'},${prefix+'-lp'},'earned',20,NOW()+INTERVAL '6 months')`;
    await login(page,instructor,'/portal');
    await complete(bid);
    await expect.poll(async()=> (await sql`SELECT status FROM bookings WHERE id=${bid}`)[0].status).toBe('completed');
    const [award]=await sql`SELECT * FROM points_ledger WHERE booking_id=${bid} AND type='earned'`;
    expect(award.points).toBe(220);
    expect(award.rm_amount).toBe('220.00');
    expect(award.rule_snapshot.allocations.map(a=>a.rateSnapshot)).toEqual(['1.5000','2.0000']);
    const [booking]=await sql`SELECT completed_at FROM bookings WHERE id=${bid}`;
    const expiry=new Date(booking.completed_at); expiry.setUTCFullYear(expiry.getUTCFullYear()+1);
    expect(new Date(award.expires_at).toISOString()).toBe(expiry.toISOString());
    await page.reload();
    await expect(row(bid).getByRole('button',{name:'Complete individual booking'})).toHaveCount(0);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id=${bid} AND type='earned'`)[0].n).toBe(1);
    await complete(prefix+'-legacy');
    await expect.poll(async()=> (await sql`SELECT status FROM bookings WHERE id=${prefix+'-legacy'}`)[0].status).toBe('completed');
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id=${prefix+'-legacy'}`)[0].n).toBe(1);
    expect((await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id=${prefix+'-legacy'} AND action='legacy_points_retained'`)[0].n).toBe(1);
    await page.goto('/portal#money'); await page.locator('#portal-tab-money').click();
    // Refund picker uses a select rather than exposing payment UUIDs as copy.
    const select=page.locator('select[name=paymentId]');
    await select.selectOption(prefix+'-p1');
    const form=select.locator('..').locator('..');
    await form.locator('input[name=amount]').fill('40');
    await form.locator('input[name=reason]').fill('CP partial refund');
    await form.getByRole('button',{name:'Record completed external refund'}).click();
    await expect.poll(async()=> (await sql`SELECT COALESCE(sum(points),0)::int n FROM points_ledger WHERE booking_id=${bid} AND type='reversed'`)[0].n).toBe(-60);
    expect((await sql`SELECT status FROM bookings WHERE id=${bid}`)[0].status).toBe('completed');
    // Decision #30: redeemed points are never restored on refund. Spend points
    // on a fresh booking, pay via Received, refund, and assert no restoration.
    await page.goto(`${base}/portal#money`); await page.locator('#portal-tab-money').click();
    const redeemForm=page.locator('form').filter({has:page.locator('input[name=points]')});
    await redeemForm.locator('select[name=bookingId]').selectOption(prefix+'-spend');
    await redeemForm.locator('input[name=points]').fill('100');
    await redeemForm.getByRole('button',{name:'Apply points before payment'}).click();
    await expect.poll(async()=> (await sql`SELECT points_discount_amount FROM bookings WHERE id=${prefix+'-spend'}`)[0].points_discount_amount).toBe('5.00');
    await page.goto(`${base}/portal`);
    const card=page.locator('.portal-request',{hasText:prefix+'-spend'});
    await card.getByRole('button',{name:'Received',exact:true}).click();
    await expect.poll(async()=> (await sql`SELECT count(*)::int n FROM payments WHERE booking_id=${prefix+'-spend'} AND kind<>'refund'`)[0].n).toBe(1);
    const [spendPay]=await sql`SELECT id, amount FROM payments WHERE booking_id=${prefix+'-spend'} AND kind<>'refund'`;
    await page.goto(`${base}/portal#money`); await page.locator('#portal-tab-money').click();
    const rselect=page.locator('select[name=paymentId]');
    await rselect.selectOption(spendPay.id);
    const rform=rselect.locator('..').locator('..');
    await rform.locator('input[name=amount]').fill(String(spendPay.amount));
    await rform.locator('input[name=reason]').fill('CP no-restoration refund');
    await rform.getByRole('button',{name:'Record completed external refund'}).click();
    await expect.poll(async()=> (await sql`SELECT status FROM bookings WHERE id=${prefix+'-spend'}`)[0].status).toBe('refund_flagged');
    expect(await sql`SELECT id FROM points_ledger WHERE customer_id=${prefix} AND note LIKE 'restore:%'`).toHaveLength(0);
    expect((await sql`SELECT COALESCE(sum(points),0)::int n FROM points_ledger WHERE booking_id=${prefix+'-spend'} AND type='redeemed'`)[0].n).toBe(-100);
    for (const suffix of ['cancel','declined','no-show','pending']) expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE booking_id=${prefix+'-'+suffix}`)[0].n).toBe(0);
    await page.goto(`${base}/terms`);
    // Decision #31: policies stay at v1 until go-live; v2 completion-points wording is draft-only.
    await expect(page.locator('main')).toContainText('Version 1');
    await expect(page.locator('main')).toContainText('Points are earned only on instructor-verified payments');
    await page.locator('[data-lang-toggle]').click();
    await expect(page.locator('main')).toContainText('积分仅来自教练核实的付款');
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  } finally {
    await sql.transaction([
      sql`DELETE FROM audit_log WHERE entity_id LIKE ${prefix+'%'} OR entity_id IN (SELECT id FROM payments WHERE booking_id LIKE ${prefix+'%'})`,
      sql`DELETE FROM points_ledger WHERE customer_id=${prefix}`,
      sql`DELETE FROM payments WHERE booking_id LIKE ${prefix+'%'}`,
      sql`DELETE FROM payment_claims WHERE booking_id LIKE ${prefix+'%'}`,
      sql`DELETE FROM invoices WHERE booking_id LIKE ${prefix+'%'}`,
      sql`DELETE FROM bookings WHERE customer_id=${prefix}`,
      sql`DELETE FROM customers WHERE id=${prefix}`,
      sql`DELETE FROM trips WHERE id LIKE ${prefix+'%'}`,
      sql`DELETE FROM verification_tokens WHERE token=ANY(${tokens})`,
    ]);
    expect((await sql`SELECT count(*)::int n FROM bookings WHERE id LIKE ${prefix+'%'}`)[0].n).toBe(0);
    expect((await sql`SELECT count(*)::int n FROM points_ledger WHERE id LIKE ${prefix+'%'}`)[0].n).toBe(0);
  }
});

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';
config({path:'.env.local'});
const sql=neon(process.env.DATABASE_URL);
async function login(page,email){const raw=randomUUID();await sql`INSERT INTO verification_tokens(identifier,token,expires) VALUES(${email},${createHash('sha256').update(raw+process.env.AUTH_SECRET).digest('hex')},${new Date(Date.now()+900000).toISOString()})`;await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/myokim')}&token=${raw}&email=${email}`);await page.waitForURL('**/myokim');}
const ids=['mask','snorkel','fins','boots','wetsuit','bcd','regulator','computer','smb','torch','camera','other'];
const equipment={choices:Object.fromEntries(ids.map(id=>[id,'rent'])),wetsuit:'M',bcd:'L',footwear:'42',footwearUnit:'EU',fitNote:'Test fit',otherNote:''};
test('Diver profile and equipment: propagation, ownership, snapshots, cutoff, postponement, EN/CN responsive',async({page,browser},info)=>{
 const prefix='DE-'+randomUUID();const email=prefix.toLowerCase()+'@example.com';const rivalEmail=prefix.toLowerCase()+'-rival@example.com';let customer,trip;
 try{
 await login(page,email);[customer]=await sql`SELECT * FROM customers WHERE email=${email}`;
 await sql`UPDATE customers SET name=${prefix},diver_profile=${JSON.stringify({agency:'PADI',level:'Open Water',dives:10,equipment})}::json WHERE id=${customer.id}`;
 trip=prefix+'-trip';await sql`INSERT INTO trips(id,slug,title_en,title_zh,status,published,price_amount,deposit_value,capacity,travel_start,travel_end,sample,departure_timezone) VALUES(${trip},${trip.toLowerCase()},'Equipment fixture','装备测试','open',true,100,30,50,${new Date(Date.now()+86400000*10).toISOString()},${new Date(Date.now()+86400000*12).toISOString()},true,'Asia/Kuala_Lumpur')`;
 const statuses=['awaiting_deposit','payment_claimed','deposit_verified','confirmed','cancelled','eligibility_declined','refund_flagged','completed'];
 for(const status of statuses)await sql`INSERT INTO bookings(id,customer_id,product_id,status,eligibility_status,currency,declarations,equipment) VALUES(${prefix+'-'+status},${customer.id},${trip},${status},'approved','MYR','{"certLevel":"Open Water","loggedDives":10,"medical":false}',${JSON.stringify(equipment)}::json)`;
 await page.goto('/myokim');await page.locator('#my-tab-profile').click();const profile=page.locator('#profile');await profile.locator('input[name=dives]').fill('35');await profile.locator('input[name=phone]').fill('+6012345678');await profile.getByRole('button',{name:'Save profile',exact:true}).click();await expect(profile.getByRole('status')).toContainText('Saved.');
 const rows=await sql`SELECT status,eligibility_status,declarations,equipment FROM bookings WHERE customer_id=${customer.id}`;
 for(const row of rows){const active=statuses.slice(0,4).includes(row.status);expect(row.eligibility_status).toBe('approved');expect(row.declarations.loggedDives).toBe(active?35:10);expect(row.declarations.medical).toBe(false);expect(row.equipment).toEqual(equipment);}
 await page.goto(`/book/${trip.toLowerCase()}`);await expect(page.locator('select[name=cert_agency]')).toHaveValue('PADI');await expect(page.locator('select[name=cert_level]')).toHaveValue('Open Water');await expect(page.locator('#b-dives')).toHaveValue('35');await page.locator('#b-name').fill(prefix+' booking only');await page.locator('#b-emergency-name').fill('Contact');await page.locator('#b-emergency-phone').fill('12345');await page.locator('#b-dob').fill('1990-01-01');await page.locator('input[name=insurance]').check();await page.locator('input[name=medical]').check();await page.locator('input[name=accept_policy]').check();await page.getByRole('button',{name:'Bring all',exact:true}).click();await page.getByRole('button',{name:'Create booking',exact:true}).click();await expect(page.locator('.booking-id')).toBeVisible();const booking=(await page.locator('.booking-id').textContent()).trim();const [snap]=await sql`SELECT equipment FROM bookings WHERE id=${booking}`;expect(Object.values(snap.equipment.choices).every(c=>c==='own')).toBe(true);const [unchanged]=await sql`SELECT name,diver_profile FROM customers WHERE id=${customer.id}`;expect(unchanged.name).toBe(prefix);expect(unchanged.diver_profile.equipment).toEqual(equipment);
 await page.goto('/myokim');const card=page.locator('#equipment-'+booking);await card.getByRole('button',{name:'Remove all',exact:true}).click();expect(JSON.parse(await card.locator('input[name=equipment]').inputValue()).choices.mask).toBe('none');await card.getByRole('button',{name:'Reset from profile',exact:true}).click();await card.getByRole('button',{name:'Rent all',exact:true}).click();const sizes=page.locator('#sizes-'+booking);await sizes.getByRole('button',{name:'Save booking equipment',exact:true}).click();await expect(sizes.getByRole('status')).toContainText('Saved');
 const request=await page.waitForTimeout(100);void request;
 const captured=[];page.on('request',r=>{if(r.method()==='POST'&&r.headers()['next-action'])captured.push({headers:r.headers(),body:r.postData()});});await page.locator('#sizes-'+booking).getByRole('button',{name:'Save booking equipment',exact:true}).click();await expect.poll(()=>captured.length).toBeGreaterThan(0);const action=captured.at(-1);const rivalContext=await browser.newContext();const rival=await rivalContext.newPage();await login(rival,rivalEmail);const denied=await rival.request.post('/myokim',{headers:{'Next-Action':action.headers['next-action'],'Content-Type':action.headers['content-type'],Origin:'http://localhost:3100'},data:action.body});expect(await denied.text()).toContain('unauthenticated');await rivalContext.close();
 await sql`UPDATE trips SET travel_start=${new Date(Date.now()+3600000).toISOString()} WHERE id=${trip}`;const cutoff=await page.request.post('/myokim',{headers:{'Next-Action':action.headers['next-action'],'Content-Type':action.headers['content-type'],Origin:'http://localhost:3100'},data:action.body});expect(await cutoff.text()).toContain('cutoff');await sql`UPDATE trips SET travel_start=${new Date(Date.now()+86400000*5).toISOString()} WHERE id=${trip}`;const reopened=await page.request.post('/myokim',{headers:{'Next-Action':action.headers['next-action'],'Content-Type':action.headers['content-type'],Origin:'http://localhost:3100'},data:action.body});expect(await reopened.text()).toContain('saved');await sql`UPDATE trips SET status='departed' WHERE id=${trip}`;const terminal=await page.request.post('/myokim',{headers:{'Next-Action':action.headers['next-action'],'Content-Type':action.headers['content-type'],Origin:'http://localhost:3100'},data:action.body});expect(await terminal.text()).toContain('cutoff');
 await sql`UPDATE trips SET status='open' WHERE id=${trip}`;
 for(const locale of ['en','zh']){await page.evaluate(l=>localStorage.setItem('okim-language',l),locale);await page.goto('/myokim');await page.locator('#my-tab-profile').click();await expect(page.locator('#profile h2')).toHaveText(locale==='en'?'Diver profile':'潜水员资料');const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,small:[...document.querySelectorAll('#profile button,#profile select,#profile input:not([type=hidden]):not([type=checkbox])')].filter(e=>e.getBoundingClientRect().width>0).filter(e=>e.getBoundingClientRect().height<44).length}));expect(layout.width).toBeLessThanOrEqual(layout.viewport);expect(layout.small).toBe(0);await page.screenshot({path:info.outputPath(`diver-${locale}.png`),fullPage:true});}
 const alerts=await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id=${booking} AND action='booking_equipment_saved'`;expect(alerts[0].n).toBeGreaterThan(0);
 await sql`UPDATE trips SET published=false WHERE id=${trip}`;
 }finally{
  // Zero-residue rule (owner): fixtures are deleted and verified, never retained.
  if(customer){
   const bids=(await sql`SELECT id FROM bookings WHERE customer_id=${customer.id}`).map(r=>r.id);
   await sql`DELETE FROM audit_log WHERE entity_id=ANY(${bids}) OR entity_id=${customer.id} OR entity_id LIKE ${prefix+'%'}`;
   await sql`DELETE FROM invoices WHERE booking_id=ANY(${bids})`;
   await sql`DELETE FROM points_ledger WHERE customer_id=${customer.id}`;
   await sql`DELETE FROM payment_claims WHERE booking_id=ANY(${bids})`;
   await sql`DELETE FROM payments WHERE booking_id=ANY(${bids})`;
   await sql`DELETE FROM bookings WHERE customer_id=${customer.id}`;
  }
  if(trip)await sql`DELETE FROM trips WHERE id=${trip}`;
  for(const e of [email,rivalEmail]){
   await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email=${e})`;
   await sql`DELETE FROM verification_tokens WHERE identifier=${e}`;
   await sql`DELETE FROM signup_names WHERE email=${e}`;
   await sql`DELETE FROM customers WHERE email=${e}`;
   await sql`DELETE FROM users WHERE email=${e}`;
  }
  expect((await sql`SELECT count(*)::int n FROM customers WHERE email LIKE ${prefix.toLowerCase()+'%'}`)[0].n).toBe(0);
  expect((await sql`SELECT count(*)::int n FROM bookings WHERE id LIKE ${prefix+'%'}`)[0].n).toBe(0);
 }
});

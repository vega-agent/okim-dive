import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createRequire, Module } from 'node:module'
import { createLocalPaymentDb } from './local-payment-db.mjs'

const require = createRequire(import.meta.url)
test('documents enforce owner and completion scope, pin bank-date receipts and leave elapsed holds reserved', async () => {
  const { db, pool } = createLocalPaymentDb()
  const conn = await pool.connect()
  const run = 'documents-' + randomUUID()
  const user = { id: run, customerId: run }
  const instructor = { id: run, role: 'instructor' }
  const cache = new Map()
  let emails = 0
  function replace(name, exports) {
    const file = require.resolve(name)
    cache.set(file,require.cache[file])
    if (!exports) { delete require.cache[file]; return }
    const module = new Module(file)
    module.loaded = true
    module.exports = exports
    require.cache[file] = module
  }
  const savedSecret = process.env.CRON_SECRET
  try {
    for (const name of ['payment-actions','payment-queries','payment-documents','booking-lifecycle']) replace('../../src/lib/'+name+'.ts')
    replace('../../src/db/index.ts',{db,transactionDb:db})
    replace('../../src/lib/portal-actions.ts',{requireInstructor:async()=>run})
    replace('next/cache',{revalidatePath(){}})
    replace('../../src/lib/emails.ts',new Proxy({}, {get(){return ()=>{emails++; throw Error('Unexpected lifecycle email')}}}))
    const { readInvoice, readReceipt } = require('../../src/lib/payment-documents.ts')
    const { recordBookingPayment, cancelBooking, recordBookingRefund } = require('../../src/lib/payment-actions.ts')
    const { readPaymentBooks } = require('../../src/lib/payment-queries.ts')
    const { GET } = require('../../app/api/cron/sweep/route.ts')
    const form = data => { const f = new FormData(); for(const [k,v] of Object.entries({bookingId:run,operationKey:randomUUID(),...data})) f.set(k,String(v)); return f }
    await conn.query('begin')
    await conn.query('insert into users (id,email) values($1,$2)',[run,run+'@example.com'])
    await conn.query('insert into customers(id,user_id,name,email) values($1,$1,$1,$2)',[run,run+'@example.com'])
    await conn.query("insert into trips(id,slug,status,title_en,title_zh,price_amount,deposit_value,travel_start,capacity) values($1,$1,'open','Test','测试',900,200,'2026-06-01',2)",[run])
    await conn.query("insert into bookings(id,customer_id,product_id,currency,original_price_amount,departure_timezone,declarations,hold_expires_at) values($1,$1,$1,'MYR',900,'Asia/Kuala_Lumpur',$2,'2020-01-01')",[run,JSON.stringify({medical:'PRIVATE-MEDICAL',bank:'PRIVATE-BANK'})])
    await conn.query("insert into booking_stages(id,booking_id,position,kind,amount,due_date) values($2,$1,1,'deposit',200,'2026-01-01'),($3,$1,3,'final',700,'2026-05-15')",[run,run+'d',run+'f'])
    await conn.query('insert into invoices(id,booking_id,number) values($1,$1,$1)',[run])
    await conn.query('commit')
    const hold = async()=> (await conn.query('select status,hold_expires_at,reminder_sent_at from bookings where id=$1',[run])).rows
    const before = await hold()
    delete process.env.CRON_SECRET
    const req = token=>new Request('http://localhost/api/cron/sweep',{headers:token ? {authorization:'Bearer '+token} : {}})
    expect((await GET(req())).status).toBe(403)
    process.env.CRON_SECRET = 'documents-only'
    expect((await GET(req('wrong'))).status).toBe(403)
    expect(await (await GET(req('documents-only'))).json()).toEqual({disabled:true,reason:'manual_release'})
    await readPaymentBooks({customerId:run,userId:run})
    expect(await readInvoice(db,user,run)).toBeNull()
    expect(await readInvoice(db,instructor,run)).toMatchObject({bookingStatus:'awaiting_deposit',summary:{outstandingMinor:90000}})
    expect(await hold()).toEqual(before)
    const first = await recordBookingPayment(form({amount:250,paidOn:'2026-04-08',expectedRevision:0}))
    expect(first.status).toBe('saved')
    const receipt = await readReceipt(db,user,first.paymentId)
    expect(receipt).toMatchObject({customerName:run,amountMinor:25000,paidOn:'2026-04-08',outstandingMinor:65000,
      allocations:[{kind:'deposit',amountMinor:20000},{kind:'final',amountMinor:5000}]})
    expect(receipt.number).not.toMatch(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}/i)
    expect(await readReceipt(db,{id:'other',customerId:run},first.paymentId)).toBeNull()
    expect(await readReceipt(db,{id:run,customerId:'other'},first.paymentId)).toBeNull()
    await conn.query("update customers set name=$2 where id=$1",[run,run+'-renamed'])
    expect(await readReceipt(db,instructor,first.paymentId)).toEqual(receipt)
    expect(await readInvoice(db,user,run)).toBeNull()
    expect((await recordBookingPayment(form({amount:650,paidOn:'2026-04-01',expectedRevision:1}))).status).toBe('saved')
    // The document route grants completion-only access. Individual completion
    // and awarding are tested with the real action in the refunds group.
    await conn.query("update bookings set status='completed' where id=$1",[run])
    const finished = await readInvoice(db,user,run)
    expect(finished).toMatchObject({bookingStatus:'completed',summary:{outstandingMinor:0}})
    expect(JSON.stringify([finished,receipt])).not.toMatch(/PRIVATE-MEDICAL|PRIVATE-BANK/)
    expect(await readInvoice(db,{id:'other',customerId:run},run)).toBeNull()
    await conn.query("update bookings set status='confirmed' where id=$1",[run])
    expect((await cancelBooking(form({cancellationKind:'operator_cancelled',reason:'Weather',expectedRevision:2}))).status).toBe('saved')
    const result=await recordBookingRefund(form({amount:250,paidOn:'2026-04-10',expectedRevision:3}))
    expect(result.status).toBe('saved')
    expect(await readReceipt(db,user,result.childPaymentIds[0])).toMatchObject({kind:'refunded',paidOn:'2026-04-10',customerName:run+'-renamed'})
    expect(await readReceipt(db,user,first.paymentId)).toEqual(receipt)
    expect(await readInvoice(db,user,run)).toBeNull()
    expect(emails).toBe(0)
    // Exercise the production database claim and audit with a retry of an
    // already committed reservation. The transport is a counting fake.
    replace('../../src/lib/booking-actions.ts')
    replace('../../src/auth.ts',{auth:async()=>({user})})
    replace('../../src/lib/booking-reservation.ts',{reserveTripBooking:async()=>({status:'created',bookingId:run,currency:'MYR',stages:[],replay:true})})
    replace('../../src/lib/local-email-gate.ts',{localEmailsDisabled:()=>false})
    const { createBooking } = require('../../src/lib/booking-actions.ts')
    const { equipmentFromProfile } = require('../../src/lib/diver-equipment.ts')
    const intent = form({name:'Sample',cert_level:'Open Water',logged_dives:5,emergency_name:'Sample',emergency_phone:'000',
      dob:'2000-01-01',insurance:'on',medical:'on',accept_policy:'on',accept_deposits:'on',equipment:JSON.stringify(equipmentFromProfile(null))})
    await Promise.all([createBooking(run,intent),createBooking(run,intent)])
    expect(await createBooking(run,intent)).toMatchObject({status:'created',acknowledgment:'failed'})
    const audit = await conn.query("select meta, (select acknowledgment_attempted_at is not null from bookings where id=$1) as claimed from audit_log where entity_id=$1 and action='booking_acknowledgment'",[run])
    expect(audit.rows).toEqual([{meta:{outcome:'failed',acceptedByProvider:false,notifyIris:true},claimed:true}])
    expect(emails).toBe(1)
    await conn.query("delete from audit_log where entity_id=$1 and action='booking_acknowledgment'",[run])
    expect(await createBooking(run,intent)).toMatchObject({status:'created',acknowledgment:'unconfirmed'})
    expect(emails).toBe(1)
    await conn.query("update payments set receipt_snapshot=receipt_snapshot::jsonb-'customerName' where id=$1",[first.paymentId])
    expect((await readReceipt(db,user,first.paymentId)).customerName).toBeNull()
    await conn.query('update payments set receipt_snapshot=null where id=$1',[first.paymentId])
    expect(await readReceipt(db,user,first.paymentId)).toBeNull()
  }finally{
    if(savedSecret===undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET=savedSecret
    for(const [file,original] of cache){ if(original) require.cache[file]=original; else delete require.cache[file] }
    try{
      await conn.query('rollback'); await conn.query('begin')
      await conn.query('delete from audit_log where actor_user_id=$1',[run])
      await conn.query('delete from payment_allocations where stage_id in(select id from booking_stages where booking_id=$1)',[run])
      for(const t of ['payments','payment_claims','booking_stages','invoices']) await conn.query('delete from '+t+' where booking_id=$1',[run])
      for(const t of ['bookings','trips','customers','users']) await conn.query('delete from '+t+' where id=$1',[run])
      await conn.query('commit')
    }catch(e){await conn.query('rollback');throw e}finally{conn.release();await pool.end()}
  }
})

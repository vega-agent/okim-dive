import { expect, test } from '@playwright/test'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { buildTripStages, deriveDisplay, publishBlockers } = require('../src/lib/trip-display.ts')

const trip = {
  priceAmount: '3000.00', currency: 'MYR', departureTimezone: 'Asia/Kuala_Lumpur',
  balanceDueDate: '2027-03-01', capacity: 1, travelStart: '2027-03-10', travelEnd: '2027-03-15',
  titleEn: 'Sample', titleZh: '示例', locationEn: 'Island', locationZh: '海岛',
  summaryEn: 'Diving', summaryZh: '潜水', highlightsEn: ['Reef'], highlightsZh: ['礁石'],
  itineraryEn: ['Dive'], itineraryZh: ['潜水'], includedEn: ['Guide'], includedZh: ['向导'],
}
const deposits = [{ amount: '500.00', dueDate: '2027-01-01' }, { amount: '700.00', dueDate: '2027-02-01' }]

test.describe('schedule', () => {
  test('published facts and both language previews show the same two dates and derived final amount', () => {
    expect(publishBlockers(trip, deposits)).toEqual([])
    const stages = buildTripStages(trip, deposits)
    expect(stages.map(s => [s.position, s.amountMinor, s.dueDate])).toEqual([
      [1, 50000, '2027-01-01'], [2, 70000, '2027-02-01'], [3, 180000, '2027-03-01'],
    ])
    for (const locale of ['en', 'zh']) {
      const display = deriveDisplay(trip, locale, deposits)
      expect(display.depositText).toContain('2027-02-01')
      expect(display.balanceText).toContain('1,800.00')
      expect(display.balanceText).toContain('2027-03-01')
    }
  })

  test('incomplete, excessive, unordered and on-departure schedules block publishing', () => {
    for (const invalid of [[], [...deposits, deposits[1]], [{ ...deposits[0], dueDate: null }],
      [deposits[0], { ...deposits[1], dueDate: deposits[0].dueDate }],
      [deposits[0], { ...deposits[1], dueDate: '2026-12-01' }], [{ ...deposits[0], amount: '3000.01' }]]) {
      expect(publishBlockers(trip, invalid).length).toBeGreaterThan(0)
    }
    expect(publishBlockers({ ...trip, balanceDueDate: '2027-03-10' }, deposits).length).toBeGreaterThan(0)
    expect(publishBlockers({ ...trip, balanceDueDate: null }, [{ ...deposits[0], amount: '3000' }])).toEqual([])
  })
})

test.describe('booking', () => {
  test('last place, replay, agreed schedule, policy versions and rollback use one transaction', async () => {
    const { createLocalPaymentDb } = await import('./support/local-payment-db.mjs')
    const { reserveTripBooking, offerFingerprint } = require('../src/lib/booking-reservation.ts')
    const { randomUUID } = await import('node:crypto')
    const { db, pool } = createLocalPaymentDb()
    const id = 'task3-' + randomUUID()
    const ids = [id + '-a', id + '-b']
    const policies = [id + '-refund', id + '-terms']
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const user of ids) {
        await client.query('insert into users (id,email) values ($1,$2)', [user, user + '@example.com'])
        await client.query('insert into customers (id,user_id,name,email) values ($1,$1,$1,$2)', [user, user + '@example.com'])
      }
      for (const [index, kind] of ['refund', 'terms'].entries()) {
        await client.query("insert into policy_versions (id,kind,version,body_en,body_zh) values ($1,$2,1,'Test','Test')", [policies[index], kind])
      }
      await client.query("insert into trips (id,slug,status,published,title_en,title_zh,currency,price_amount,deposit_value,capacity,travel_start,balance_due_date) values ($1,$1,'open',true,'Test','Test','MYR',3000,500,1,'2099-03-10','2027-03-01')", [id])
      await client.query("insert into trip_deposits (id,trip_id,sort,amount,due_days,due_date) values ($2,$1,0,500,0,'2027-01-01'),($3,$1,1,700,0,'2027-02-01')", [id, id + '-1', id + '-2'])
      await client.query('COMMIT')
      const acceptedOffer = offerFingerprint({ ...trip, id, travelStart: new Date('2099-03-10T00:00:00Z'), travelEnd: null }, buildTripStages(trip, deposits))
      const requests = ids.map(customerId => ({
        customerId, userId: customerId, slug: id, operationKey: randomUUID(), acceptedOffer, name: 'Diver',
        refundVersionId: policies[0], termsVersionId: policies[1], declarations: { certLevel: 'Open Water' }, equipment: {},
      }))
      // An intentional invoice-stage DB failure proves the preceding booking/stage inserts roll back.
      await client.query("create function pg_temp.reject_fixture_invoice() returns trigger language plpgsql as $$ begin raise exception 'fixture invoice rejection'; end $$")
      await client.query('create trigger task3_reject_invoice before insert on invoices for each row execute function pg_temp.reject_fixture_invoice()')
      try {
        await expect(reserveTripBooking(db, requests[0])).rejects.toThrow()
        expect((await client.query('select count(*)::int n from bookings where product_id=$1', [id])).rows[0].n).toBe(0)
      } finally {
        await client.query('drop trigger task3_reject_invoice on invoices')
      }
      expect((await reserveTripBooking(db, { ...requests[0], acceptedOffer: 'old' })).status).toBe('offer_changed')
      expect((await reserveTripBooking(db, { ...requests[0], termsVersionId: 'old' })).status).toBe('invalid')
      await client.query("update trips set travel_start='2099-03-11' where id=$1", [id])
      expect((await reserveTripBooking(db, requests[0])).status).toBe('offer_changed')
      await client.query("update trips set travel_start='2099-03-10' where id=$1", [id])
      const outcomes = await Promise.all(requests.map(r => reserveTripBooking(db, r)))
      expect(outcomes.map(r => r.status).sort()).toEqual(['created', 'trip_full'])
      const winner = outcomes.findIndex(r => r.status === 'created')
      const original = outcomes[winner]
      const request = requests[winner]
      expect(original.stages.map(s => [s.position, s.amountMinor])).toEqual([[1, 50000], [2, 70000], [3, 180000]])
      expect((await client.query('select declarations from bookings where id=$1', [original.bookingId])).rows[0].declarations.name).toBe('Diver')
      const audit = (await client.query("select meta from audit_log where entity_id=$1 and action='booking_policy_accepted'", [original.bookingId])).rows
      expect(audit).toHaveLength(1)
      expect(audit[0].meta).toMatchObject({ refundVersionId: policies[0], termsVersionId: policies[1], depositsNonRefundableAcknowledged: true })
      expect((await reserveTripBooking(db, { ...request, name: 'Changed' })).status).toBe('invalid')
      expect((await reserveTripBooking(db, { ...request, operationKey: randomUUID() })).status).toBe('already_booked')
      await client.query("update trips set price_amount=4000,status='closed' where id=$1", [id])
      await client.query("update trip_deposits set due_date='2027-01-15' where trip_id=$1 and sort=0", [id])
      expect(await reserveTripBooking(db, request)).toMatchObject({ ...original, replay: true })
      expect((await client.query('select count(*)::int n from invoices where booking_id=$1', [original.bookingId])).rows[0].n).toBe(1)
    } finally {
      await client.query('ROLLBACK')
      await client.query('BEGIN')
      try {
        for (const table of ['audit_log', 'invoices', 'booking_stages']) {
          const column = table === 'audit_log' ? 'entity_id' : 'booking_id'
          await client.query('delete from ' + table + ' where ' + column + ' in (select id from bookings where product_id=$1)', [id])
        }
        await client.query('delete from bookings where product_id=$1', [id])
        await client.query('delete from trip_deposits where trip_id=$1', [id])
        await client.query('delete from trips where id=$1', [id])
        await client.query('delete from policy_versions where id=any($1)', [policies])
        await client.query('delete from customers where id=any($1)', [ids])
        await client.query('delete from users where id=any($1)', [ids])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
        await pool.end()
      }
    }
  })
})

test('schedule editor saves an incomplete draft, rejects a third deposit, and copies and deletes a complete schedule', async () => {
  const { createLocalPaymentDb } = await import('./support/local-payment-db.mjs')
  const { randomUUID } = await import('node:crypto')
  const { Module } = await import('node:module')
  const { db, pool } = createLocalPaymentDb()
  const run = 'schedule-test-' + randomUUID()
  const client = await pool.connect()
  const cache = new Map()
  let redirected = ''
  function replace(specifier, exports) {
    const file = require.resolve(specifier)
    cache.set(file, require.cache[file])
    const stub = new Module(file)
    stub.loaded = true
    stub.exports = exports
    require.cache[file] = stub
  }
  const actionFile = require.resolve('../src/lib/trip-actions.ts')
  // Trip cancellation imports the ledger reader; scope that module to this test's pool too.
  for(const file of [actionFile,require.resolve('../src/lib/booking-lifecycle.ts'),require.resolve('../src/lib/payment-queries.ts')]){
    cache.set(file,require.cache[file])
    delete require.cache[file]
  }
  try {
    replace('../src/db/index.ts', { db, transactionDb: db })
    replace('../src/lib/portal-actions.ts', { requireInstructor: async () => run })
    replace('next/cache', { revalidatePath() {} })
    replace('next/navigation', { redirect(path) { redirected = path } })
    const actions = require(actionFile)
    const form = new FormData()
    form.set('titleEn', run)
    await actions.createTrip(form)
    const id = redirected.split('/').pop()
    form.set('tripId', id)
    form.set('priceAmount', '3000')
    form.set('travelStart', '2099-03-10')
    form.set('travelEnd', '2099-03-12')
    form.append('depositAmount', '500')
    form.append('depositDueDate', '')
    await actions.updateTripSettings(form)
    const read = async tripId => (await client.query('select amount::text, due_date::text from trip_deposits where trip_id=$1 order by sort', [tripId])).rows
    expect(await read(id)).toEqual([{ amount: '500.00', due_date: null }])
    form.set('state', 'open')
    await expect(actions.setLaunchState(form)).rejects.toThrow()
    form.set('depositDueDate', '2027-01-01')
    form.append('depositAmount', '700')
    form.append('depositDueDate', '2027-02-01')
    form.set('balanceDueDate', '2027-03-01')
    form.append('depositAmount', '1')
    form.append('depositDueDate', '2027-02-15')
    await expect(actions.updateTripSettings(form)).rejects.toThrow()
    form.delete('depositAmount')
    form.delete('depositDueDate')
    for (const row of deposits) { form.append('depositAmount', row.amount); form.append('depositDueDate', row.dueDate) }
    await actions.updateTripSettings(form)
    await actions.duplicateTrip(form)
    const copyId = redirected.split('/').pop()
    expect(await read(copyId)).toEqual([{ amount: '500.00', due_date: '2027-01-01' }, { amount: '700.00', due_date: '2027-02-01' }])
    expect((await client.query('select balance_due_date::text from trips where id=$1', [copyId])).rows[0].balance_due_date).toBe('2027-03-01')
    form.set('tripId', copyId)
    await actions.deleteDraft(form)
    expect(await read(copyId)).toEqual([])
    expect((await client.query('select count(*)::int n from trips where id=$1', [copyId])).rows[0].n).toBe(0)
    form.set('tripId', id)
    await client.query("update trips set title_zh='测试',location_en='Test',location_zh='地点',summary_en='Test',summary_zh='测试',highlights_en='[\"Test\"]',highlights_zh='[\"测试\"]',itinerary_en='[\"Test\"]',itinerary_zh='[\"测试\"]',included_en='[\"Test\"]',included_zh='[\"测试\"]' where id=$1", [id])
    await actions.setLaunchState(form)
    expect((await client.query('select published from trips where id=$1', [id])).rows[0].published).toBe(true)
  } finally {
    for (const [file, entry] of cache) {
      if (entry) require.cache[file] = entry
      else delete require.cache[file]
    }
    try {
      await client.query('BEGIN')
      await client.query('delete from trip_deposits where trip_id in (select id from trips where title_en=$1)', [run])
      await client.query('delete from trips where title_en=$1', [run])
      await client.query('delete from audit_log where actor_user_id=$1', [run])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
      await pool.end()
    }
  }
})

test('payments allocate partial and combined receipts, replay original results, and serialize competing saves', async () => {
  const { createLocalPaymentDb } = await import('./support/local-payment-db.mjs')
  const { randomUUID } = await import('node:crypto')
  const { Module } = await import('node:module')
  const { db, pool } = createLocalPaymentDb()
  const id = 'pay-test-' + randomUUID()
  const client = await pool.connect()
  const cache = new Map()
  let authenticated = false
  let externalSends = 0
  function stub(specifier, exports) {
    const file = require.resolve(specifier)
    cache.set(file, require.cache[file])
    const m = new Module(file)
    m.loaded = true
    m.exports = exports
    require.cache[file] = m
  }
  try {
    stub('../src/db/index.ts', { db, transactionDb: db })
    stub('../src/lib/portal-actions.ts', { requireInstructor: async () => { if (!authenticated) throw Error('Forbidden'); return id } })
    stub('next/cache', { revalidatePath() {} })
    stub('../src/lib/emails.ts', new Proxy({}, { get() { return () => { externalSends++; throw Error('Unexpected email') } } }))
    const { recordBookingPayment } = require('../src/lib/payment-actions.ts')
    const { readPaymentBooks, loadPaymentSummaries } = require('../src/lib/payment-queries.ts')
    const call = (amount, revision, key = randomUUID(), paidOn = '2026-01-02', bookingId = id) => {
      const form = new FormData()
      for (const [field, value] of Object.entries({ amount, expectedRevision: revision, operationKey: key, paidOn, bookingId })) form.set(field, String(value))
      return recordBookingPayment(form)
    }
    expect((await call('50', 0)).status).toBe('error')
    authenticated = true
    await client.query('BEGIN')
    await client.query('insert into users (id,email) values ($1,$2)', [id,id+'@example.com'])
    await client.query('insert into customers (id,user_id,name,email) values ($1,$1,$1,$2)', [id, id + '@example.com'])
    await client.query("insert into trips (id,slug,status,published,title_en,title_zh,price_amount,deposit_value,capacity,travel_start) values ($1,$1,'full',true,'Test','Test',3000,500,1,'2026-01-01')", [id])
    await client.query("insert into bookings (id,customer_id,product_id,currency,declarations,eligibility_status,original_price_amount,points_discount_amount,departure_timezone) values ($1,$1,$1,'MYR','{}','approved',3000,150,'Asia/Kuala_Lumpur')", [id])
    await client.query("insert into booking_stages (id,booking_id,position,kind,amount,due_date) values ($2,$1,1,'deposit',500,'2026-01-01'),($3,$1,2,'deposit',700,'2026-02-01'),($4,$1,3,'final',1800,'2026-03-01')", [id,id+'-d1',id+'-d2',id+'-f'])
    await client.query('COMMIT')
    expect((await loadPaymentSummaries([])).size).toBe(0)
    expect((await readPaymentBooks({ customerId: id, userId: 'unrelated-' + id })).summaries.size).toBe(0)
    for (const amount of ['2850.01', '0', '-2', '1.001']) expect((await call(amount, 0)).status).toBe('error')
    const a = randomUUID()
    const first = await call('100.00', 0, a)
    expect(first).toMatchObject({ status: 'saved', summary: { revision: 1, nextStageId: id+'-d1', outstandingMinor: 275000, suggestedAmountMinor: 40000 } })
    expect((await client.query('select status from bookings where id=$1', [id])).rows[0].status).toBe('awaiting_deposit')
    expect(await call('100.00', 0, a.toUpperCase())).toEqual(first)
    for (const [field, invalid, correct] of [['currency','USD','MYR'], ['kind','unknown','deposit']]) {
      await client.query('update payments set ' + field + '=$1 where id=$2',[invalid,first.paymentId])
      expect((await call('400',1)).status).toBe('error')
      await client.query('update payments set ' + field + '=$1 where id=$2',[correct,first.paymentId])
    }
    const competing = await Promise.all([call('400',1), call('400',1)])
    expect(competing.map(r => r.status).sort()).toEqual(['saved','stale'])
    expect((await client.query('select status from bookings where id=$1', [id])).rows[0].status).toBe('confirmed')
    const combined = await call('1000',2)
    expect(combined).toMatchObject({ status: 'saved', summary: { revision: 3, outstandingMinor: 135000, netReceivedMinor: 150000 } })
    expect((await call('100',0,a))).toEqual(first)
    expect((await call('101',0,a)).status).toBe('error')
    expect((await call('100',0,a,'2026-01-01')).status).toBe('error')
    const receipt = (await client.query('select receipt_snapshot from payments where id=$1',[combined.paymentId])).rows[0].receipt_snapshot
    expect(receipt).toMatchObject({ schemaVersion: 1, kind: 'received', bookingId: id, paidOn: '2026-01-02', amountMinor: 100000,
      grossReceivedMinor: 150000, netReceivedMinor: 150000, refundedMinor: 0, outstandingMinor: 135000,
      allocations: [{stageId:id+'-d2',position:2,kind:'deposit',amountMinor:70000},{stageId:id+'-f',position:3,kind:'final',amountMinor:30000}] })
    expect((await call('1350',3)).summary.outstandingMinor).toBe(0)
    expect((await client.query('select status from bookings where id=$1', [id])).rows[0].status).toBe('confirmed')
    expect((await readPaymentBooks({ customerId: id, userId: id })).summaries.get(id).outstandingMinor).toBe(0)
    expect((await client.query('select count(*)::int n from payment_claims where booking_id=$1',[id])).rows[0].n).toBe(4)
    expect(externalSends).toBe(0)
  } finally {
    for (const file of ['../src/lib/payment-actions.ts','../src/lib/payment-queries.ts']) {
      try { delete require.cache[require.resolve(file)] } catch { /* The initial red run has no module yet. */ }
    }
    for (const [file, entry] of cache) { if (entry) require.cache[file] = entry; else delete require.cache[file] }
    try {
      await client.query('ROLLBACK')
      await client.query('BEGIN')
      await client.query('delete from audit_log where actor_user_id=$1',[id])
      await client.query('delete from payment_allocations where payment_id in (select id from payments where booking_id=$1)',[id])
      for (const table of ['payments','payment_claims','booking_stages']) await client.query('delete from '+table+' where booking_id=$1',[id])
      for (const table of ['bookings','trips','customers','users']) await client.query('delete from '+table+' where id=$1',[id])
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release(); await pool.end() }
  }
})

test('refunds preserve booked terms through postponement, allocate multiple sources and respect each original bank date',async()=>{
  const {createLocalPaymentDb}=await import('./support/local-payment-db.mjs')
  const {randomUUID}=await import('node:crypto')
  const {Module}=await import('node:module')
  const {db,pool}=createLocalPaymentDb()
  const conn=await pool.connect(), id='refunds-'+randomUUID(), bids=[id+'a',id+'b']
  const touched=new Map()
  const app=['../src/lib/booking-lifecycle.ts','../src/lib/payment-actions.ts','../src/lib/trip-actions.ts','../src/lib/payment-queries.ts','../src/lib/portal-actions.ts','../src/lib/seamless-actions.ts']
  function stub(name,exports){
    const file=require.resolve(name),m=new Module(file)
    touched.set(file,require.cache[file]);m.loaded=true;m.exports=exports;require.cache[file]=m
  }
  const form=values=>{const fd=new FormData(); for(const [k,v] of Object.entries(values)) fd.set(k,String(v));return fd}
  try{
    for(const name of app){const file=require.resolve(name);touched.set(file,require.cache[file]);delete require.cache[file]}
    stub('../src/db/index.ts',{db,transactionDb:db})
    stub('../src/auth.ts',{auth:async()=>({user:{id,role:'instructor'}})})
    stub('next/cache',{revalidatePath(){}})
    const {recordBookingPayment,recordBookingRefund,respondToPostponement}=require('../src/lib/payment-actions.ts')
    const {completeBooking}=require('../src/lib/portal-actions.ts')
    const {readPaymentBooks}=require('../src/lib/payment-queries.ts')
    const {updateTripSettings}=require('../src/lib/trip-actions.ts')
    await conn.query('BEGIN')
    await conn.query("insert into trips(id,slug,title_en,title_zh,status,price_amount,deposit_value,capacity,travel_start,travel_end) values($1,$1,'Test','示例','open',1000,200,3,'2025-05-01','2025-05-03')",[id])
    for(const bid of bids){
      await conn.query("insert into customers(id,name,email) values($1,$1,$2)",[bid,bid+'@example.com'])
      await conn.query("insert into bookings(id,product_id,customer_id,declarations,currency,original_price_amount,departure_timezone) values($1,$2,$1,'{}','MYR',1000,'Asia/Kuala_Lumpur')",[bid,id])
      await conn.query("insert into booking_stages(id,booking_id,position,kind,amount,due_date) values($1||'-D',$1,1,'deposit',200,'2025-01-01'),($1||'-F',$1,3,'final',800,'2025-03-01')",[bid])
    }
    await conn.query('COMMIT')
    const payment=(amount,rev,paidOn)=>recordBookingPayment(form({bookingId:bids[0],amount,expectedRevision:rev,operationKey:randomUUID(),paidOn}))
    const first=await payment('120',0,'2025-04-10'), second=await payment('150',1,'2025-04-20')
    expect([first.status,second.status]).toEqual(['saved','saved'])
    const changeDates=async(start,end)=>{
      const f=form({tripId:id,travelStart:start,travelEnd:end,priceAmount:1000,balanceDueDate:'2025-03-01'})
      f.append('depositAmount','200');f.append('depositDueDate','2025-01-01')
      await updateTripSettings(f)
      return (await conn.query("select id,meta from audit_log where entity_id=$1 and action='trip_dates_changed' order by at desc limit 1",[id])).rows[0]
    }
    const snapshot=()=>conn.query('select id,position,amount,due_date from booking_stages where booking_id=any($1) order by id',[bids]).then(r=>r.rows)
    const original=await snapshot()
    const obsolete=await changeDates('2025-06-01','2025-06-03')
    const change=await changeDates('2025-07-01','2025-07-03')
    expect(change.meta.bookingIds).toEqual(bids)
    const reply=(bookingId,changeId,decision)=>respondToPostponement(form({bookingId,changeId,decision,reason:'Recorded diver decision'}))
    expect((await reply(bids[0],obsolete.id,'decline')).status).toBe('error')
    const settled=await recordBookingPayment(form({bookingId:bids[1],amount:'1000',expectedRevision:0,operationKey:randomUUID(),paidOn:'2025-04-10'}))
    expect(settled.status).toBe('saved')
    const completedForm=form({bookingId:bids[1],participated:'on'})
    await expect(completeBooking(completedForm)).rejects.toThrow(/date decision/)
    expect((await reply(bids[1],change.id,'accept')).status).toBe('saved')
    await completeBooking(completedForm)
    expect((await conn.query('select points from points_ledger where booking_id=$1',[bids[1]])).rows).toEqual([{points:1000}])
    expect((await reply(bids[1],change.id,'decline')).status).toBe('error')
    expect((await respondToPostponement(form({bookingId:bids[0],changeId:change.id,decision:'decline',reason:'Diver decision',expectedRevision:0}))).status).toBe('stale')
    const cancelled=await reply(bids[0],change.id,'decline')
    expect(cancelled.summary).toMatchObject({refundOutstandingMinor:27000,outstandingMinor:0})
    expect((await reply(bids[0],change.id,'decline')).status).toBe('saved')
    expect(await snapshot()).toEqual(original)
    const refund=(amount,paidOn,key=randomUUID())=>recordBookingRefund(form({bookingId:bids[0],amount,paidOn,expectedRevision:3,operationKey:key}))
    expect((await refund('200','2025-04-15')).status).toBe('error')
    const key=randomUUID(),result=await refund('200','2025-04-30',key)
    expect(result.summary.refundOutstandingMinor).toBe(7000)
    expect(result.childPaymentIds).toHaveLength(2)
    expect(await refund('200','2025-04-30',key)).toEqual(result)
    const sources=(await conn.query("select source_payment_id,amount from payments where booking_id=$1 and kind='refund' order by amount desc",[bids[0]])).rows
    expect(sources).toEqual([{source_payment_id:first.paymentId,amount:'120.00'},{source_payment_id:second.paymentId,amount:'80.00'}])
    await conn.query('update payments set source_payment_id=$1 where id=$2',[settled.paymentId,result.childPaymentIds[0]])
    await expect(readPaymentBooks({bookingIds:[...bids]})).rejects.toThrow(/Refund source/)

  }finally{
    for(const [file,value] of touched){if(value)require.cache[file]=value;else delete require.cache[file]}
    try{
      await conn.query('ROLLBACK');await conn.query('BEGIN')
      await conn.query('delete from audit_log where actor_user_id=$1',[id])
      await conn.query('delete from payment_allocations where stage_id in(select id from booking_stages where booking_id=any($1))',[bids])
      for(const t of ['points_ledger','payments','payment_claims','booking_stages'])await conn.query('delete from '+t+' where booking_id=any($1)',[bids])
      await conn.query('delete from bookings where id=any($1)',[bids])
      await conn.query('delete from trip_deposits where trip_id=$1',[id])
      await conn.query('delete from trips where id=$1',[id]);await conn.query('delete from customers where id=any($1)',[bids]);await conn.query('COMMIT')
    }catch(err){await conn.query('ROLLBACK');throw err}finally{conn.release();await pool.end()}
  }
})

import './support/payment-ui.mjs'

import './support/payment-documents.mjs'

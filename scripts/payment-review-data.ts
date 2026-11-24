import { cancellationRefundSnapshot, previewPayment, summarizeBooking, validatePaymentSchedule, type AllocationInput, type StageInput } from '../src/lib/payment-schedule'

export const fixtureSet = 'payment-review-20261123'
type Row = Record<string, unknown>
export type Rows = Record<string, Row[]>
const zone = 'Asia/Kuala_Lumpur'
const money = (minor:number) => (minor / 100).toFixed(2)
const stamp = (day:string) => day + 'T03:00:00Z'
const daysBetween = (a:string,b:string) => (Date.parse(a)-Date.parse(b))/86400000

type Trip = { id:string; en:string; zh:string; depart:string; end:string; past?:boolean; stages:[number,string|null][] }
const tours:Trip[] = [
  { id:'TRP-REVIEW-HISTORY',en:'Tioman reef journal · sample',zh:'刁曼岛珊瑚礁日志 · 示例',depart:'2026-10-10',end:'2026-10-12',past:true,stages:[[50000,'2026-08-20'],[250000,'2026-09-20']] },
  { id:'TRP-REVIEW-TWO',en:'Tioman island weekend · sample',zh:'刁曼岛周末潜旅 · 示例',depart:'2027-02-13',end:'2027-02-15',stages:[[50000,'2026-11-16'],[70000,'2026-12-20'],[180000,'2027-01-25']] },
  { id:'TRP-REVIEW-ZERO',en:'Tioman reef day · sample',zh:'刁曼岛珊瑚礁一日游 · 示例',depart:'2027-01-16',end:'2027-01-16',stages:[[60000,'2026-12-15'],[0,null]] },
]
// Existing authored trip and its Messages remain intact. Check these terms again under the cutover lock.
const retainedTrip:Trip={id:'TRP-004',en:'',zh:'',depart:'2026-12-12',end:'',stages:[[36000,'2026-10-13'],[84000,'2026-11-12']]}
type Example = { code:string; customer:string; tour:Trip; booked:string; status:string; payments:[number,string][]; discount?:number; cancel?:string; refund?:[number,string] }
const examples:Example[] = [
  {code:'HISTORY',customer:'CUS-001',tour:tours[0],booked:'2026-08-12',status:'completed',payments:[[300000,'2026-09-18']]},
  {code:'POINTS',customer:'CUS-001',tour:retainedTrip,booked:'2026-10-20',status:'confirmed',discount:5000,payments:[[36000,'2026-10-22'],[20000,'2026-11-09']]},
  {code:'PARTIAL',customer:'CUS-REVIEW-01',tour:tours[1],booked:'2026-11-01',status:'awaiting_deposit',payments:[[25000,'2026-11-03']]},
  {code:'COMBINED',customer:'CUS-001',tour:tours[1],booked:'2026-11-15',status:'confirmed',payments:[[50000,'2026-11-16'],[95000,'2026-11-19']]},
  {code:'REFUND',customer:'CUS-001',tour:tours[1],booked:'2026-11-01',status:'cancelled',payments:[[50000,'2026-11-03'],[100000,'2026-11-10']],cancel:'2026-11-12',refund:[10000,'2026-11-14']},
  {code:'RESERVED',customer:'CUS-REVIEW-02',tour:tours[1],booked:'2026-11-22',status:'awaiting_deposit',payments:[]},
  {code:'ZERO',customer:'CUS-REVIEW-03',tour:tours[2],booked:'2026-11-06',status:'confirmed',payments:[[60000,'2026-11-15']]},
]
export function reviewRows() {
  const rows:Rows={}
  const add=(table:string,row:Row) => { (rows[table]??=[]).push(row) }
  for (const [i,name] of Array.from(['Nadia Tan','Kai Lim','Jun Lee'].entries())) {
    const n=String(i+1).padStart(2,'0')
    add('customers',{id:'CUS-REVIEW-'+n,name:'Sample · '+name,email:'okim.review.'+n+'@example.com',locale:i===1?'zh':'en'})
  }
  for (const t of tours) {
    const price=t.stages.reduce((s,[m])=>s+m,0), finalDate=t.stages[t.stages.length-1][1]
    add('trips',{id:t.id,slug:t.id.toLowerCase(),status:t.past?'completed':'open',published:false,sample:true,title_en:t.en,title_zh:t.zh,
      departure_timezone:zone,location_key:'malaysia',location_en:'Tioman Island',location_zh:'刁曼岛',travel_start:t.depart,travel_end:t.end,
      price_amount:money(price),currency:'MYR',rm_rate:1,deposit_type:'fixed',deposit_value:money(t.stages[0][0]),balance_due_date:finalDate,
      balance_due_days:finalDate?daysBetween(t.depart,finalDate):0,capacity:8,min_participants:1})
    t.stages.slice(0,-1).forEach(([m,date],i)=>add('trip_deposits',{id:t.id+'-D'+(i+1),trip_id:t.id,sort:i,amount:money(m),due_date:date,due_days:daysBetween(t.depart,date!)}))
  }
  const reports:Record<string,ReturnType<typeof summarizeBooking>>={}
  for (const e of examples) {
    const bid='BKG-REVIEW-'+e.code, payPrefix='PAY-REVIEW-'+e.code, discount=e.discount??0
    const stages:StageInput[]=e.tour.stages.map(([amountMinor,dueDate],i,list)=>{
      const final=i===list.length-1
      return {id:bid+(final?'-FINAL':'-D'+(i+1)),position:final?3:i===0?1:2,kind:final?'final':'deposit',amountMinor,dueDate}
    })
    const price=stages.reduce((s,v)=>s+v.amountMinor,0)
    validatePaymentSchedule(price,stages,e.tour.depart)
    const allocations:AllocationInput[]=[]
    let cancellationKind:'diver_withdrawal'|null=null
    let refundEntitlementMinor=0, refundBaselineMinor=0, revision=discount?1:0
    const summary=()=>summarizeBooking({bookingId:bid,currency:'MYR',revision,originalPriceMinor:price,discountMinor:discount,stages,allocations,
      today:'2026-11-23',cancellationKind,refundEntitlementMinor,refundBaselineMinor})
    const audit=(key:string,action:string,at:string,meta:Row)=>add('audit_log',{id:'AUD-REVIEW-'+e.code+'-'+key,action,entity:'booking',entity_id:bid,at:stamp(at),meta:{...meta,sampleFixture:fixtureSet}})
    const writeReceipt=(id:string,bankDate:string,minor:number,pieces:{stageId:string;amountMinor:number}[],source:string|null,kind:string)=>{
      const direction=source?'refunded':'received'
      revision++
      for (const p of pieces) {
        allocations.push({...p,paymentId:id,direction})
        add('payment_allocations',{payment_id:id,stage_id:p.stageId,amount:money(p.amountMinor)})
      }
      const state=summary()
      const snapshot={schemaVersion:1,provenance:'synthetic_review_fixture',bookingId:bid,currency:'MYR',amountMinor:minor,kind:direction,paidOn:bankDate,recordedAt:stamp(bankDate),
        allocations:pieces.map(p=>{const s=stages.find(s=>s.id===p.stageId)!;return {...p,position:s.position,kind:s.kind}}),
        grossReceivedMinor:state.grossReceivedMinor,refundedMinor:state.refundedMinor,netReceivedMinor:state.netReceivedMinor,outstandingMinor:state.outstandingMinor}
      const claim=source?null:'CLM-'+id.slice(4)
      if(claim) add('payment_claims',{id:claim,booking_id:bid,kind,currency:'MYR',amount:money(minor),status:'verified',paid_on:bankDate,submitted_at:stamp(bankDate),reference:bid,operation_key:'review-claim-'+id})
      add('payments',{id,booking_id:bid,claim_id:claim,source_payment_id:source,kind,amount:money(minor),currency:'MYR',rm_rate:1,rm_amount:money(minor),verified_at:stamp(bankDate),
        receipt_no:'RCT-'+id.slice(4),operation_key:'review-pay-'+id,receipt_snapshot:snapshot})
      audit(id,source?'refund_recorded':'payment_verified',bankDate,{paymentId:id,sourcePaymentId:source,amountMinor:minor})
    }
    e.payments.forEach(([m,d],i)=>writeReceipt(payPrefix+'-'+(i+1),d,m,previewPayment(summary(),m).allocations,null,m===price?'full':i===0?'deposit':'balance'))
    if(e.cancel){
      const snapshot=cancellationRefundSnapshot(summary(),'diver_withdrawal')
      refundEntitlementMinor=snapshot.refundEntitlementMinor; refundBaselineMinor=snapshot.refundBaselineMinor; cancellationKind='diver_withdrawal'; revision++
      audit('cancel','booking_cancelled',e.cancel,{category:cancellationKind,refundEntitlementMinor,refundBaselineMinor})
      if(e.refund){
        const [m,date]=e.refund, stage=stages[stages.length-1],source=payPrefix+'-2'
        if(m>refundEntitlementMinor || !allocations.some(a=>a.paymentId===source&&a.stageId===stage.id&&a.amountMinor>=m)) throw Error('Invalid example refund portion')
        writeReceipt(payPrefix+'-R1',date,m,[{stageId:stage.id,amountMinor:m}],source,'refund')
      }
    }
    add('bookings',{id:bid,customer_id:e.customer,product_id:e.tour.id,product_type:'trip',status:e.status,eligibility_status:'approved',currency:'MYR',
      original_price_amount:money(price),departure_timezone:zone,payment_revision:revision,deposit_amount:money(stages[0].amountMinor),balance_amount:money(price-stages[0].amountMinor-discount),
      points_discount_amount:money(discount),policy_version_id:'POL-REFUND-001',declarations:{sampleFixture:fixtureSet},created_at:stamp(e.booked),
      completed_at:e.status==='completed'?stamp('2026-10-13'):null,cancelled_at:e.cancel?stamp(e.cancel):null,cancel_reason:e.cancel?'Sample diver withdrawal':null,cancellation_kind:cancellationKind,
      refund_entitlement_amount:e.cancel?money(refundEntitlementMinor):null,refund_baseline_amount:e.cancel?money(refundBaselineMinor):null})
    for(const s of stages) add('booking_stages',{id:s.id,booking_id:bid,position:s.position,kind:s.kind,amount:money(s.amountMinor),due_date:s.dueDate})
    add('invoices',{id:'INV-REVIEW-'+e.code,booking_id:bid,number:'INV-REVIEW-'+e.code,issued_at:stamp(e.booked),points_redemption_id:discount?'review-points-use':null})
    audit('seed','review_booking_seeded',e.booked,{})
    if(e.status==='completed') {
      add('points_ledger',{id:'EARN-COMPLETE-'+bid,customer_id:e.customer,booking_id:bid,type:'earned',points:3000,rm_amount:'3000.00',expires_at:stamp('2027-10-13'),created_at:stamp('2026-10-13'),
        operation_key:'completion:'+bid,rule_snapshot:{awardVersion:'completion-v1',earnRate:1,expiryMonths:12,rounding:'floor_per_payment',restoration:'none',allocations:[{paymentId:payPrefix+'-1',cashCents:300000,refundedCents:0,rateSnapshot:'1',rmAmount:'3000.00',points:3000}]}})
      audit('complete','booking_completed','2026-10-13',{points:3000})
    }
    if(discount){
      add('points_ledger',{id:'REDEEM-REVIEW-POINTS',customer_id:e.customer,booking_id:bid,type:'redeemed',points:-1000,rm_amount:'50.00',source_lot_id:'EARN-COMPLETE-BKG-REVIEW-HISTORY',
        rate_snapshot:'1',operation_key:'review-points-use',rule_snapshot:{redeemValue:0.05,capPct:20,restoration:'none'},expires_at:stamp('2027-10-13'),created_at:stamp(e.booked)})
      audit('points','points_redeemed',e.booked,{points:1000,discount:'50.00'})
    }
    reports[bid]=summary()
  }
  return {rows,reports}
}

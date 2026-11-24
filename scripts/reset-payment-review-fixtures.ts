// Read-only by default. An explicit target and matching digest bind an approved replacement.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, mkdtempSync, openSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { parse } from 'dotenv'
import obsolete from './payment-review-obsolete.json'
import { fixtureSet, reviewRows, type Rows } from './payment-review-data'

const host='ep-purple-paper-ao84nvvx.c-2.ap-southeast-1.aws.neon.tech'
const hosted=host+':5432/neondb', local='127.0.0.1:55433/okim_review_fixtures'
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const lit=(s:string)=>"'"+s.replaceAll("'","''")+"'"
const list=(xs:string[])=>'('+xs.map(lit).join(',')+')'
const check=(condition:string,label:string)=>`DO $assert$ BEGIN IF (${condition}) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION '${label}'; END IF; END $assert$;`
const bIds=list(obsolete.bookings), pIds=list(obsolete.payments), cIds=list(obsolete.customers), tIds=list(obsolete.trips), uIds=list(obsolete.users)
const auditFilter=`id IN ${list(obsolete.audit_log)} AND (entity<>'trip' OR EXISTS(SELECT 1 FROM public.trips t WHERE t.id=a.entity_id AND a.at>=t.created_at))`
type Scope={table:string; where:string; id?:string; expected?:number}
const scopes:Scope[]=[
  {table:'audit_log',where:auditFilter},
  {table:'payment_allocations',where:`payment_id IN ${pIds}`,id:"payment_id||'/'||stage_id",expected:6},
  {table:'booking_stages',where:`booking_id IN ${bIds}`,expected:12},
  ...(['points_ledger','payments','payment_claims','invoices','bookings','trip_deposits'] as const).map(table=>({table,where:`id IN ${list(obsolete[table])}`,expected:obsolete[table].length})),
  {table:'trips',where:`id IN ${tIds} AND NOT published AND ((id='TRP-DEMO-01' AND sample) OR (id BETWEEN 'TRP-005' AND 'TRP-008' AND (slug='test' OR slug LIKE 'test-%')) OR (id BETWEEN 'TRP-009' AND 'TRP-015' AND title_en='Untitled trip' AND slug LIKE 'untitled-trip%'))`,expected:12},
  {table:'customers',where:`id IN ${cIds} AND user_id IS NULL`,expected:4},
  {table:'sessions',where:`"userId" IN ${uIds}`,id:'"userId"',expected:10},
  {table:'users',where:`id IN ${uIds} AND role='customer' AND lower(split_part(email,'@',2)) IN ('example.com','example.invalid')`,expected:10},
]
const scopeInventory = (s:Scope)=>`SELECT jsonb_build_object('ids',coalesce(jsonb_agg(${s.id??'id'} ORDER BY ${s.id??'id'}),'[]'),
  'hash',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(a)::text,E'\\n' ORDER BY to_jsonb(a)::text),''),'UTF8')),'hex')) FROM public.${s.table} a WHERE ${s.where}`
const protectedChecks:Record<string,string>={
  migrated:`EXISTS(SELECT 1 FROM public.audit_log WHERE id='payment-schedule-20261123' AND action='payment_schedule_migrated')`,
  original_customer:`EXISTS(SELECT 1 FROM public.customers c JOIN public.users u ON u.id=c.user_id WHERE c.id='CUS-001' AND u.role='instructor')`,
  reviewed_trip:`EXISTS(SELECT 1 FROM public.trips t JOIN public.trip_deposits d ON d.trip_id=t.id WHERE t.id='TRP-004' AND t.status='open' AND t.sample AND t.published AND t.currency='MYR' AND t.price_amount=1200 AND t.departure_timezone='Asia/Kuala_Lumpur' AND t.travel_start::date='2026-12-12' AND t.balance_due_date='2026-11-12' AND d.sort=0 AND d.amount=360 AND d.due_date='2026-10-13') AND (SELECT count(*) FROM public.trip_deposits WHERE trip_id='TRP-004')=1`,
  no_owner_duplicate:`NOT EXISTS(SELECT 1 FROM public.bookings WHERE customer_id='CUS-001' AND product_id='TRP-004' AND id NOT IN ${bIds} AND status NOT IN ('cancelled','expired','eligibility_declined'))`,
  policy:`EXISTS(SELECT 1 FROM public.policy_versions WHERE id='POL-REFUND-001' AND kind='refund')`,
  no_extra_trip_dependencies:`NOT EXISTS(SELECT 1 FROM public.bookings WHERE product_id IN ${tIds} AND id NOT IN ${bIds})
    AND NOT EXISTS(SELECT 1 FROM public.trip_messages WHERE trip_id IN ${tIds}) AND NOT EXISTS(SELECT 1 FROM public.briefings WHERE trip_id IN ${tIds})
    AND NOT EXISTS(SELECT 1 FROM public.trip_checklist_items WHERE trip_id IN ${tIds}) AND NOT EXISTS(SELECT 1 FROM public.inquiries WHERE trip_id IN ${tIds})
    AND NOT EXISTS(SELECT 1 FROM public.trip_deposits WHERE trip_id IN ${tIds} AND id NOT IN ${list(obsolete.trip_deposits)})`,
  no_extra_identity_dependencies:`NOT EXISTS(SELECT 1 FROM public.customers WHERE user_id IN ${uIds} OR merged_into IN ${cIds})
    AND NOT EXISTS(SELECT 1 FROM public.message_reads WHERE customer_id IN ${cIds}) AND NOT EXISTS(SELECT 1 FROM public.accounts WHERE "userId" IN ${uIds})
    AND NOT EXISTS(SELECT 1 FROM public.bookings WHERE customer_id IN ${cIds} AND id NOT IN ${bIds})`,
  no_extra_money_dependencies:`NOT EXISTS(SELECT 1 FROM public.points_ledger WHERE (source_lot_id IN ${list(obsolete.points_ledger)} OR booking_id IN ${bIds} OR customer_id IN ${cIds} OR payment_id IN ${pIds}) AND id NOT IN ${list(obsolete.points_ledger)})
    AND NOT EXISTS(SELECT 1 FROM public.payments WHERE (source_payment_id IN ${pIds} OR booking_id IN ${bIds}) AND id NOT IN ${pIds})
    AND NOT EXISTS(SELECT 1 FROM public.payment_claims WHERE booking_id IN ${bIds} AND id NOT IN ${list(obsolete.payment_claims)})
    AND NOT EXISTS(SELECT 1 FROM public.invoices WHERE booking_id IN ${bIds} AND id NOT IN ${list(obsolete.invoices)})`,
}
const insertOrder=['customers','trips','trip_deposits','bookings','booking_stages','invoices','payment_claims','payments','payment_allocations','points_ledger','audit_log']
const material=reviewRows()
const collisionChecks=Object.entries(material.rows).filter(([t])=>t!=='payment_allocations').map(([t,rows])=>
  `NOT EXISTS(SELECT 1 FROM public.${t} WHERE id IN ${list(rows.map(r=>String(r.id)))})`)
protectedChecks.no_seed_id_collision=collisionChecks.join(' AND ')
const inventorySQL=`SELECT jsonb_build_object('obsolete',jsonb_build_object(${scopes.map(s=>lit(s.table)+',('+scopeInventory(s)+')').join(',')}),
 'checks',jsonb_build_object(${Object.entries(protectedChecks).map(([k,q])=>lit(k)+',('+q+')').join(',')}),
 'marker',(SELECT meta::jsonb->>'approval' FROM public.audit_log WHERE id=${lit(fixtureSet)}),
 'database',current_database())`
function inserts(rows:Rows){
  return insertOrder.map(table=>{
    const groups=new Map<string,Record<string,unknown>[]>()
    for(const r of rows[table]) {
      const columns=Object.keys(r).sort().join(',')
      groups.set(columns,[...(groups.get(columns)??[]),r])
    }
    return Array.from(groups,([columns,records])=>{
      const encoded=Buffer.from(JSON.stringify(records)).toString('base64')
      return `INSERT INTO public.${table}(${columns}) SELECT ${columns} FROM jsonb_populate_recordset(NULL::public.${table},convert_from(decode('${encoded}','base64'),'UTF8')::jsonb);`
    }).join('\n')
  }).join('\n')
}

function main(){
  const {values}=parseArgs({options:{target:{type:'string'},apply:{type:'boolean'},'approve-report':{type:'string'}}})
  const target=values.target??hosted
  if(target!==local&&target!==hosted) throw Error('Unrecognized exact target.')
  if(values.apply&&(!values.target||!/^[a-f0-9]{64}$/.test(values['approve-report']??''))) throw Error('Apply requires explicit target and matching --approve-report digest.')
  const pg:NodeJS.ProcessEnv={NODE_ENV:'production',PATH:process.env.PATH,PGCONNECT_TIMEOUT:'10',PGCLIENTENCODING:'UTF8',PGAPPNAME:fixtureSet,PGOPTIONS:'-c default_transaction_read_only=on -c timezone=UTC -c search_path=pg_catalog,public -c lock_timeout=5000 -c statement_timeout=30000'}
  if(target===local)Object.assign(pg,{PGHOST:'127.0.0.1',PGPORT:'55433',PGDATABASE:'okim_review_fixtures',PGUSER:'okim_payment_test',PGSSLMODE:'disable'})
  else{
    const url=new URL(parse(readFileSync('.env.local')).DATABASE_URL_UNPOOLED)
    if(url.hostname!==host||url.pathname!='/neondb'||(url.port&&url.port!=='5432')||!['postgresql:','postgres:'].includes(url.protocol))throw Error('Configured endpoint differs.')
    Object.assign(pg,{PGHOST:host,PGPORT:'5432',PGDATABASE:'neondb',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:'system'})
  }
  const sql=(input:string)=>execFileSync('psql',['-XwqAt','-v','ON_ERROR_STOP=1'],{env:pg,input,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim()
  const snapshot=sql('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; '+inventorySQL+'; COMMIT;')
  const inventory=JSON.parse(snapshot) as {obsolete:Record<string,{ids:string[];hash:string}>; checks:Record<string,boolean>; database:string; marker:string|null}
  if(inventory.database!==pg.PGDATABASE)throw Error('Wrong database identity.')
  if(inventory.marker){if(values.apply&&inventory.marker!==values['approve-report'])throw Error('Previous apply has a different digest.');console.log(JSON.stringify({target,state:'already_applied',changes:0,approval:inventory.marker}));return}
  const {rows,reports}=material
  const code=hash(['scripts/reset-payment-review-fixtures.ts','scripts/payment-review-data.ts','scripts/payment-review-obsolete.json','src/lib/payment-schedule.ts'].map(p=>readFileSync(p,'utf8')).join('\n'))
  const approval=hash(JSON.stringify([target,code,snapshot,rows]))
  const blockers=Object.keys(inventory.checks).filter(k=>!inventory.checks[k])
  for(const s of scopes) if(s.expected!==undefined && inventory.obsolete[s.table].ids.length!==s.expected) blockers.push('unexpected_count_'+s.table)
  const counts=Object.fromEntries(Object.entries(rows).map(([table,r])=>[table,r.length]))
  console.log(JSON.stringify({target,approval,blockers,deleteIds:Object.fromEntries(scopes.map(s=>[s.table,inventory.obsolete[s.table].ids])),insertCounts:counts,
    bookings:Object.values(reports).map(r=>({id:r.bookingId,received:r.grossReceivedMinor,refunded:r.refundedMinor,owing:r.outstandingMinor,refundOwing:r.refundOutstandingMinor}))},null,2))
  if(blockers.length){process.exitCode=2;return}
  if(!values.apply)return
  if(approval!==values['approve-report'])throw Error('Reviewed report or implementation changed.')
  const path=join(mkdtempSync(join(tmpdir(),'okim-before-review-fixtures-')),'database.dump')
  const fd=openSync(path,'wx',0o600)
  try{execFileSync('pg_dump',['-w','-Fc'],{env:pg,stdio:['ignore',fd,'pipe']})}finally{closeSync(fd)}
  execFileSync('pg_restore',['--list',path],{env:pg,stdio:['ignore','ignore','pipe']})
  console.log('Private backup '+path)
  const locks=Array.from(new Set([...insertOrder,...scopes.map(s=>s.table),'policy_versions','message_reads','trip_messages','briefings','trip_checklist_items','inquiries','accounts'])).sort()
  const deleteSQL=scopes.map(s=>`DELETE FROM public.${s.table} a WHERE ${s.where};`).join('\n')
  const verify=Object.entries(reports).map(([id,s])=>check(`(SELECT sum(amount)*100 FROM public.booking_stages WHERE booking_id=${lit(id)})=${s.originalPriceMinor}
    AND (SELECT coalesce(sum(amount) FILTER(WHERE kind<>'refund'),0)*100 FROM public.payments WHERE booking_id=${lit(id)})=${s.grossReceivedMinor}
    AND (SELECT coalesce(sum(amount) FILTER(WHERE kind='refund'),0)*100 FROM public.payments WHERE booking_id=${lit(id)})=${s.refundedMinor}
    AND NOT EXISTS(SELECT 1 FROM public.payments p LEFT JOIN public.payment_allocations a ON a.payment_id=p.id WHERE p.booking_id=${lit(id)} GROUP BY p.id HAVING sum(a.amount) IS DISTINCT FROM p.amount OR p.receipt_snapshot IS NULL)`,'Review fixture accounting mismatch')).join('\n')
  sql(`BEGIN READ WRITE; LOCK TABLE ${locks.map(t=>'public.'+t).join(',')} IN ACCESS EXCLUSIVE MODE;
    ${check(`(SELECT encode(sha256(convert_to((${inventorySQL})::text,'UTF8')),'hex'))='${hash(snapshot)}'`,'Reviewed source changed')}
    ${deleteSQL} ${inserts(rows)} ${verify}
    INSERT INTO public.audit_log(id,action,entity,entity_id,meta) VALUES(${lit(fixtureSet)},'review_fixtures_replaced','migration',${lit(fixtureSet)},json_build_object('approval','${approval}','synthetic',true)); COMMIT;`)
  console.log('Review fixture replacement committed.')
}
try{main()}catch(error){
  if(error instanceof Error&&'status' in error){const line=String((error as {stderr?:Buffer}).stderr??'').split('\n').find(l=>/ERROR:|FATAL:|error:/.test(l));console.error(line??'PostgreSQL operation failed.')}
  else console.error(error instanceof Error?error.message:'Fixture replacement failed.')
  process.exitCode=1
}

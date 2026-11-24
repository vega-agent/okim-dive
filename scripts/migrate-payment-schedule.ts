// Run from the repository root. Default mode opens a read-only transaction.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, mkdtempSync, openSync, closeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { parse } from 'dotenv'
import { buildTransition, type LegacyFacts } from './payment-migration-report'

const hostedHost = 'ep-purple-paper-ao84nvvx.c-2.ap-southeast-1.aws.neon.tech'
const hosted = hostedHost + ':5432/neondb'
const local = '127.0.0.1:55433/postgres'
const migration = 'payment-schedule-20261123'
const ddlPath = 'src/db/migrations/20261123_payment_schedule.sql'
const hash = (s:string) => createHash('sha256').update(s).digest('hex')
const digestSQL = (s:string) => `encode(sha256(convert_to((${s})::text,'UTF8')),'hex')`

const catalogSQL = `SELECT coalesce(jsonb_object_agg(key,definition),'{}') AS catalog FROM (
  SELECT 'table.'||c.relname AS key, c.relkind::text AS definition FROM pg_class c
    WHERE c.relnamespace='public'::regnamespace AND c.relname IN ('booking_stages','payment_allocations')
  UNION ALL SELECT 'column.'||c.relname||'.'||a.attname,
    format_type(a.atttypid,a.atttypmod)||CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END||coalesce(' DEFAULT '||pg_get_expr(ad.adbin,ad.adrelid),'')
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef ad ON ad.adrelid=c.oid AND ad.adnum=a.attnum
    WHERE c.relnamespace='public'::regnamespace AND c.relname=ANY(ARRAY['bookings','trips','trip_deposits','payments','payment_claims','booking_stages','payment_allocations','audit_log'])
    AND a.attnum>0 AND NOT a.attisdropped
  UNION ALL SELECT 'index.'||indexname,indexdef FROM pg_indexes WHERE schemaname='public'
    AND tablename IN ('bookings','trips','trip_deposits','payments','payment_claims','booking_stages','payment_allocations','audit_log')
  UNION ALL SELECT 'constraint.'||r.relname||'.'||c.conname,pg_get_constraintdef(c.oid)
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid WHERE r.relnamespace='public'::regnamespace
    AND r.relname IN ('bookings','trips','trip_deposits','payments','payment_claims','booking_stages','payment_allocations','audit_log')
) x`
const expected = [
  'table.booking_stages','table.payment_allocations',
  'column.trips.balance_due_date','column.trip_deposits.due_date','column.payments.receipt_snapshot',
  ...['original_price_amount','departure_timezone','payment_revision','cancellation_kind','refund_entitlement_amount','refund_baseline_amount','request_operation_key','acknowledgment_attempted_at'].map(n=>'column.bookings.'+n),
  ...['id','booking_id','position','kind','amount','due_date'].map(n=>'column.booking_stages.'+n),
  ...['payment_id','stage_id','amount'].map(n=>'column.payment_allocations.'+n),
  ...['trip_deposits_trip_sort','bookings_request_operation_key','booking_stages_booking_position','booking_stages_pkey','payment_allocations_pkey'].map(n=>'index.'+n),
  ...['trip_deposits.trip_deposits_sort_range','bookings.bookings_schedule_required','bookings.bookings_payment_revision_nonnegative','bookings.bookings_cancellation_kind','bookings.bookings_refund_amounts','booking_stages.booking_stages_positive_due','booking_stages.booking_stages_kind_position','payment_allocations.payment_allocations_positive','booking_stages.booking_stages_booking_id_bookings_id_fk','payment_allocations.payment_allocations_payment_id_payments_id_fk','payment_allocations.payment_allocations_stage_id_booking_stages_id_fk'].map(n=>'constraint.'+n),
]
const factsSQL = `
SELECT jsonb_build_object(
'trips', coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM (
 SELECT id,status,departure_timezone AS timezone,to_char(travel_start,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS departure,
 price_amount::text AS price,balance_due_days AS final_days FROM public.trips)t),'[]'),
'deposits', coalesce((SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM (
 SELECT id,trip_id,sort,amount::text,due_days FROM public.trip_deposits)d),'[]'),
'bookings', coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM (
 SELECT id,product_id,product_type,status,currency, deposit_amount::text AS deposit,balance_amount::text AS balance,
 points_discount_amount::text AS discount,cancelled_at IS NOT NULL AS has_cancel_date,cancel_reason IS NOT NULL AS has_cancel_reason FROM public.bookings)b),'[]'),
'claims', coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM (
 SELECT id,booking_id,kind,currency,status,amount::text,paid_on::date::text AS paid_on,
 to_char(submitted_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS submitted FROM public.payment_claims)c),'[]'),
'payments', coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM (
 SELECT id,booking_id,kind,amount::text,currency,source_payment_id AS source,claim_id,receipt_no,
 to_char(verified_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS verified FROM public.payments)p),'[]')
) AS facts
`
const markerSQL = `SELECT meta::jsonb FROM public.audit_log WHERE id='${migration}' AND action='payment_schedule_migrated' AND entity='migration' AND entity_id='${migration}'`
const markerCollisionSQL = `EXISTS (SELECT 1 FROM public.audit_log WHERE id='${migration}')`
const snapshotSQL = `WITH src AS (${factsSQL}), cat AS (${catalogSQL}) SELECT jsonb_build_object(
  'facts',facts,'sourceHash',${digestSQL('facts')},'catalog',catalog,'catalogHash',${digestSQL('catalog')},
  'marker',(${markerSQL}),'markerExists',${markerCollisionSQL},'database',current_database()) FROM src, cat`

function main() {
  const { values } = parseArgs({ options:{ target:{type:'string'}, apply:{type:'boolean'}, 'approve-report':{type:'string'} }, strict:true })
  const target = values.target ?? hosted
  if (target !== local && target !== hosted) throw Error('Unrecognized target. Specify the exact reviewed host:port/database.')
  if (values.apply && (!values.target || !/^[0-9a-f]{64}$/.test(values['approve-report'] ?? ''))) throw Error('Apply requires explicit --target and --approve-report SHA-256.')
  if (!values.apply && values['approve-report']) throw Error('--approve-report requires --apply.')
  // Do not inherit libpq environment overrides, startup files or service profiles.
  const env: NodeJS.ProcessEnv = { NODE_ENV:'production', PATH:process.env.PATH, PGCONNECT_TIMEOUT:'10', PGAPPNAME:migration, PGCLIENTENCODING:'UTF8',
    PGOPTIONS:'-c search_path=pg_catalog,public -c timezone=UTC -c statement_timeout=30000 -c lock_timeout=5000 -c default_transaction_read_only=on' }
  if (target === local) Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:'55433',PGDATABASE:'postgres',PGUSER:'okim_payment_test',PGSSLMODE:'disable'})
  else {
    const config = parse(readFileSync('.env.local'))
    const url = new URL(config.DATABASE_URL_UNPOOLED)
    if (url.hostname !== hostedHost || url.pathname !== '/neondb' || (url.port && url.port !== '5432') || !['postgresql:','postgres:'].includes(url.protocol)) throw Error('Configured direct endpoint differs from the reviewed target.')
    Object.assign(env,{PGHOST:hostedHost,PGPORT:'5432',PGDATABASE:'neondb',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:'system'})
  }
  const sql = (input:string) => execFileSync('psql',['-X','-w','-qAt','-v','ON_ERROR_STOP=1'],{env,input,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim()
  const snapshot = JSON.parse(sql(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; ${snapshotSQL}; COMMIT;`)) as
    { facts: LegacyFacts; sourceHash:string; catalog:Record<string,string>; catalogHash:string; marker:{catalogHash:string; approval:string}|null; markerExists:boolean; database:string }
  if (snapshot.database !== env.PGDATABASE) throw Error('Database identity mismatch.')
  const missing = expected.filter(name => !(name in snapshot.catalog))
  const present = expected.filter(name => name in snapshot.catalog)
  if (snapshot.marker) {
    if (missing.length || snapshot.marker.catalogHash !== snapshot.catalogHash) throw Error('Migrated schema drift detected. Review the catalog before proceeding.')
    if (values.apply && snapshot.marker.approval !== values['approve-report']) throw Error('Supplied approval differs from the committed migration.')
    console.log(JSON.stringify({target,state:'already_applied',changes:0,approval:snapshot.marker.approval},null,2)); return
  }
  const plan = buildTransition(snapshot.facts)
  if (present.length || snapshot.markerExists) plan.blockers.push({ reason:'partial_or_conflicting_target_schema',ids:[...present,...(snapshot.markerExists?[migration]:[])] })
  const ddl = readFileSync(ddlPath,'utf8')
  const codeHash = hash([ddl,'scripts/migrate-payment-schedule.ts','scripts/payment-migration-report.ts','src/lib/payment-schedule.ts'].map((v,i)=>i ? readFileSync(v,'utf8') : v).join('\n'))
  const approval = hash(JSON.stringify({ target, source:snapshot.sourceHash, catalog:snapshot.catalogHash, codeHash, plan }))
  const report = {target,state:plan.blockers.length?'blocked':'reviewable',approval,sourceHash:snapshot.sourceHash,catalogHash:snapshot.catalogHash,codeHash,
    schema:{missing,present}, counts:Object.fromEntries(Object.entries(snapshot.facts).map(([k,v])=>[k,v.length])), ...plan}
  console.log(JSON.stringify(report,null,2))
  if (plan.blockers.length) { process.exitCode=2; return }
  if (!values.apply) return
  if (values['approve-report'] !== approval) throw Error('Report approval mismatch. Re-review the current dry-run.')
  const backupDir = mkdtempSync(join(tmpdir(),'okim-payment-backup-'))
  const backup = join(backupDir,'database.dump')
  const fd = openSync(backup,'wx',0o600)
  try { execFileSync('pg_dump',['-w','-Fc'],{env,stdio:['ignore',fd,'pipe']}) } finally { closeSync(fd) }
  execFileSync('pg_restore',['--list',backup],{env,stdio:['ignore','ignore','pipe']})
  console.log('Private pre-migration database archive: '+backup)
  const payload = Buffer.from(JSON.stringify(plan)).toString('base64')
  // LOCK before computing a fresh snapshot; concurrent legacy writes or a competing migration invalidate approval.
  const checkSQL = (predicate:string) => `DO $guard$ BEGIN IF (${predicate}) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Migration precondition changed'; END IF; END $guard$;`
  sql(`BEGIN READ WRITE;
    LOCK TABLE public.trips,public.trip_deposits,public.bookings,public.payment_claims,public.payments,public.audit_log IN ACCESS EXCLUSIVE MODE;
    ${checkSQL(`(SELECT ${digestSQL('facts')}='${snapshot.sourceHash}' FROM (${factsSQL}) src) AND
      (SELECT ${digestSQL('catalog')}='${snapshot.catalogHash}' FROM (${catalogSQL}) cat) AND NOT ${markerCollisionSQL}`)}
    CREATE TEMP TABLE transition ON COMMIT DROP AS SELECT convert_from(decode('${payload}','base64'),'UTF8')::jsonb AS plan;
    ${ddl}
    ${checkSQL(`(SELECT ${digestSQL('facts')}='${snapshot.sourceHash}' FROM (${factsSQL}) src)`)}
    INSERT INTO public.audit_log(id,action,entity,entity_id,meta) SELECT '${migration}','payment_schedule_migrated','migration','${migration}',
      jsonb_build_object('approval','${approval}','catalogHash',${digestSQL('catalog')},'provenance','reconstructed_test_fixture',
        'bookingIds',jsonb_path_query_array(plan,'$.bookings[*].id'),'reconstructedReceiptPaymentIds',jsonb_path_query_array(plan,'$.receipts[*].id'))
      FROM (${catalogSQL}) cat, pg_temp.transition;
    COMMIT;`)
  console.log('Migration committed; fixture reconciliation passed.')
}

try { main() } catch (error) {
  // psql/pg_dump error objects may contain SQL input or an environment. Print only the diagnostic class.
  if (error instanceof Error && 'status' in error) {
    const diagnostic = String((error as {stderr?:Buffer}).stderr ?? '').split('\n').find(line=>/ERROR:|FATAL:|error:/.test(line))
    console.error('PostgreSQL command failed. '+(diagnostic ?? 'Check local PostgreSQL tools and target availability.'))
  } else console.error(error instanceof Error ? error.message : 'Migration failed.')
  process.exitCode=1
}

/**
 * Portal demo reset (owner decision 2026-11-22, OPC/PORTAL-REDESIGN-PLAN.md #1/#3).
 * 1) Purge leaked test fixtures: @example.invalid customers (DE- runs) and
 *    dbg-*@okimdive.com orphans, their bookings/claims/payments/ledger/audit
 *    rows, DE-/DBG- fixture trips, expired magic-link tokens. NEVER touches
 *    Jeff's CUS-001 / BKG-DEMO-01/02 / RCT-DEMO-01/02 or real trips/policies.
 * 2) Seed 4 clearly-labelled sample divers on TRP-004 for the demo video:
 *    two pending deposit claims (verify-on-camera), one awaiting deposit,
 *    one verified deposit with eligibility pending review.
 * Run: node scripts/portal-demo-reset.ts            (purge + seed, idempotent)
 *      node scripts/portal-demo-reset.ts --purge-only
 *      node scripts/portal-demo-reset.ts --clean    (remove portal DEMO rows only)
 * NOTE (owner): Neon free tier — keep fixtures minimal; this script replaces
 * its own rows on re-run and leaves no test residue.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
const now = new Date()
const iso = (d: Date) => d.toISOString()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const monthsAhead = (n: number) => { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() + n); return d }

const SEED_CUSTOMERS = ['CUS-DEMO-01', 'CUS-DEMO-02', 'CUS-DEMO-03', 'CUS-DEMO-04']
const SEED_BOOKINGS = ['BKG-DEMO-03', 'BKG-DEMO-04', 'BKG-DEMO-05', 'BKG-DEMO-06']
const SEED_CLAIMS = ['DEMO-03', 'DEMO-04', 'DEMO-06']
const SEED_PAYMENTS = ['PAY-DEMO-06']
const SEED_LEDGER = ['EARN-PAY-DEMO-06']
const SEED_INVOICES = ['INV-DEMO-03', 'INV-DEMO-04', 'INV-DEMO-05', 'INV-DEMO-06']

async function cleanSeed() {
  const ids = [...SEED_BOOKINGS, ...SEED_CLAIMS, ...SEED_PAYMENTS, ...SEED_LEDGER, ...SEED_INVOICES, ...SEED_CUSTOMERS]
  await sql.transaction([
    sql`DELETE FROM audit_log WHERE entity_id = ANY(${ids})`,
    sql`DELETE FROM points_ledger WHERE id = ANY(${SEED_LEDGER}) OR booking_id = ANY(${SEED_BOOKINGS})`,
    sql`DELETE FROM payments WHERE id = ANY(${SEED_PAYMENTS}) OR booking_id = ANY(${SEED_BOOKINGS})`,
    sql`DELETE FROM payment_claims WHERE id = ANY(${SEED_CLAIMS}) OR booking_id = ANY(${SEED_BOOKINGS})`,
    sql`DELETE FROM invoices WHERE id = ANY(${SEED_INVOICES}) OR booking_id = ANY(${SEED_BOOKINGS})`,
    sql`DELETE FROM bookings WHERE id = ANY(${SEED_BOOKINGS})`,
    sql`DELETE FROM customers WHERE id = ANY(${SEED_CUSTOMERS})`,
  ])
}

async function purge() {
  const customers = await sql`SELECT id, email, user_id FROM customers WHERE email LIKE '%@example.invalid' OR email LIKE 'dbg-%@okimdive.com'`
  const cids = customers.map(c => c.id as string)
  const emails = customers.map(c => c.email as string)
  const uids = customers.map(c => c.user_id as string | null).filter((u): u is string => !!u)
  const bookings = cids.length ? await sql`SELECT id FROM bookings WHERE customer_id = ANY(${cids})` : []
  const bids = bookings.map(b => b.id as string)
  const claims = bids.length ? await sql`SELECT id FROM payment_claims WHERE booking_id = ANY(${bids})` : []
  const payments = bids.length ? await sql`SELECT id FROM payments WHERE booking_id = ANY(${bids})` : []
  const claimIds = claims.map(c => c.id as string)
  const payIds = payments.map(p => p.id as string)
  const trips = await sql`SELECT id FROM trips WHERE id LIKE 'DE-%-trip' OR id LIKE 'DBG-%-trip'`
  const tids = trips.map(t => t.id as string)
  const inquiries = await sql`SELECT id FROM inquiries WHERE trip_id = ANY(${tids}) OR email LIKE '%@example.com'`
  const inquiryIds = inquiries.map(i => i.id as string)
  const auditEntityIds = [...bids, ...claimIds, ...payIds, ...cids, ...inquiryIds]

  const queries = []
  if (auditEntityIds.length || uids.length) queries.push(sql`DELETE FROM audit_log WHERE entity_id = ANY(${auditEntityIds}) OR actor_user_id = ANY(${uids})`)
  if (cids.length || bids.length || payIds.length) queries.push(sql`DELETE FROM points_ledger WHERE customer_id = ANY(${cids}) OR booking_id = ANY(${bids}) OR payment_id = ANY(${payIds})`)
  if (bids.length) queries.push(sql`DELETE FROM payments WHERE booking_id = ANY(${bids})`)
  if (bids.length) queries.push(sql`DELETE FROM payment_claims WHERE booking_id = ANY(${bids})`)
  if (bids.length) queries.push(sql`DELETE FROM invoices WHERE booking_id = ANY(${bids})`)
  if (bids.length) queries.push(sql`DELETE FROM bookings WHERE id = ANY(${bids})`)
  if (inquiryIds.length) queries.push(sql`DELETE FROM inquiries WHERE id = ANY(${inquiryIds})`)
  if (tids.length) queries.push(sql`DELETE FROM trip_checklist_items WHERE trip_id = ANY(${tids})`)
  if (tids.length) queries.push(sql`DELETE FROM briefings WHERE trip_id = ANY(${tids})`)
  if (tids.length) queries.push(sql`DELETE FROM trips WHERE id = ANY(${tids})`)
  if (emails.length) queries.push(sql`DELETE FROM signup_names WHERE email = ANY(${emails})`)
  queries.push(sql`DELETE FROM verification_tokens WHERE identifier = ANY(${emails}) OR expires < ${iso(now)}`)
  if (cids.length) queries.push(sql`DELETE FROM customers WHERE id = ANY(${cids})`)
  if (uids.length) queries.push(sql`DELETE FROM sessions WHERE "userId" = ANY(${uids})`)
  if (uids.length) queries.push(sql`DELETE FROM accounts WHERE "userId" = ANY(${uids})`)
  if (uids.length) queries.push(sql`DELETE FROM users WHERE id = ANY(${uids})`)
  // Orphaned audit rows whose booking no longer exists (e.g. old DBG- runs).
  queries.push(sql`DELETE FROM audit_log WHERE entity = 'booking' AND entity_id NOT IN (SELECT id FROM bookings)`)
  if (queries.length) await sql.transaction(queries)
  console.log(`Purged: ${cids.length} fixture customers, ${bids.length} bookings, ${claimIds.length} claims, ${payIds.length} payments, ${tids.length} fixture trips, ${inquiryIds.length} fixture inquiries; expired tokens cleared.`)
}

const equipment = (rent: string[], own: string[]) => ({
  choices: Object.fromEntries(['mask', 'snorkel', 'fins', 'boots', 'wetsuit', 'bcd', 'regulator', 'computer', 'smb', 'torch', 'camera', 'other'].map(id => [id, own.includes(id) ? 'own' : rent.includes(id) ? 'rent' : 'none'])),
  wetsuit: 'M', bcd: 'L', footwear: '42', footwearUnit: 'EU', fitNote: '', otherNote: '',
})

async function seed() {
  const [jeff] = await sql`SELECT id FROM users WHERE email = 'jeff.mailme@gmail.com' LIMIT 1`
  if (!jeff) throw new Error('Jeff user row not found — cannot attribute seeded audit rows')
  const actor = jeff.id as string
  const [refund] = await sql`SELECT id FROM policy_versions WHERE kind = 'refund' ORDER BY version DESC LIMIT 1`
  const [terms] = await sql`SELECT id FROM policy_versions WHERE kind = 'terms' ORDER BY version DESC LIMIT 1`
  if (!refund || !terms) throw new Error('Policy versions missing — seed policies first')
  const [trip] = await sql`SELECT id, currency, rm_rate FROM trips WHERE id = 'TRP-004'`
  if (!trip) throw new Error('TRP-004 demo trip not found')

  const divers = [
    { cus: 'CUS-DEMO-01', bkg: 'BKG-DEMO-03', name: 'Aiman Rahman', email: 'aiman.rahman.demo@okimdive.com', phone: '+60123456701', locale: 'en', agency: 'PADI', level: 'Open Water', dives: 12, dob: '1992-03-14', emergency: 'Nurul Rahman', emergencyPhone: '+60123456711', status: 'awaiting_deposit', eligibility: 'approved', hold: true, eq: equipment(['fins', 'boots', 'wetsuit', 'bcd', 'smb'], ['mask', 'snorkel', 'regulator', 'computer']) },
    { cus: 'CUS-DEMO-02', bkg: 'BKG-DEMO-04', name: 'Mei Ling Tan', email: 'meiling.tan.demo@okimdive.com', phone: '+60123456702', locale: 'zh', agency: 'PADI', level: 'Advanced Open Water', dives: 28, dob: '1988-11-02', emergency: 'Wei Tan', emergencyPhone: '+60123456712', status: 'awaiting_deposit', eligibility: 'approved', hold: true, eq: equipment(['wetsuit', 'bcd', 'torch'], ['mask', 'snorkel', 'fins', 'boots', 'regulator', 'computer', 'smb']) },
    { cus: 'CUS-DEMO-03', bkg: 'BKG-DEMO-05', name: 'Rajesh Kumar', email: 'rajesh.kumar.demo@okimdive.com', phone: '+60123456703', locale: 'en', agency: 'SSI', level: 'Open Water', dives: 8, dob: '1995-07-21', emergency: 'Priya Kumar', emergencyPhone: '+60123456713', status: 'awaiting_deposit', eligibility: 'approved', hold: true, eq: equipment(['mask', 'snorkel', 'fins', 'boots', 'wetsuit', 'bcd', 'regulator', 'computer', 'smb'], []) },
    { cus: 'CUS-DEMO-04', bkg: 'BKG-DEMO-06', name: 'Sarah Lim', email: 'sarah.lim.demo@okimdive.com', phone: '+60123456704', locale: 'en', agency: 'SSI', level: 'Rescue Diver', dives: 45, dob: '1990-01-30', emergency: 'Daniel Lim', emergencyPhone: '+60123456714', status: 'deposit_verified', eligibility: 'approved', hold: false, eq: equipment(['wetsuit', 'bcd'], ['mask', 'snorkel', 'fins', 'boots', 'regulator', 'computer', 'smb', 'torch']) },
  ]

  const queries = []
  for (const d of divers) {
    const profile = { agency: d.agency, level: d.level, dives: d.dives, equipment: d.eq }
    const declarations = {
      certLevel: d.level, certAgency: d.agency, agencyOther: '', levelOther: '', loggedDives: d.dives,
      insurance: true, medical: false, emergencyName: d.emergency, emergencyPhone: d.emergencyPhone,
      dob: d.dob, whatsapp: null, termsVersionId: terms.id, locale: d.locale,
    }
    const holdIso = d.hold ? iso(new Date(now.getTime() + 14 * 86_400_000)) : null
    queries.push(sql`INSERT INTO customers (id, user_id, name, email, phone, locale, diver_profile, created_at) VALUES (${d.cus}, NULL, ${d.name}, ${d.email}, ${d.phone}, ${d.locale}, ${JSON.stringify(profile)}::json, ${iso(daysAgo(3))})`)
    queries.push(sql`INSERT INTO bookings (id, customer_id, product_type, product_id, status, eligibility_status, policy_version_id, accepted_at, deposit_amount, balance_amount, currency, points_discount_amount, declarations, equipment, created_at, hold_expires_at) VALUES (${d.bkg}, ${d.cus}, 'trip', 'TRP-004', ${d.status}, ${d.eligibility}, ${refund.id}, ${iso(daysAgo(2))}, '360.00', '840.00', 'MYR', '0', ${JSON.stringify(declarations)}::json, ${JSON.stringify(d.eq)}::json, ${iso(daysAgo(2))}, ${holdIso})`)
    queries.push(sql`INSERT INTO invoices (id, booking_id, number, issued_at) VALUES (${d.bkg.replace('BKG', 'INV')}, ${d.bkg}, ${'INV-2026-' + d.bkg.replace('BKG-', '')}, ${iso(daysAgo(2))})`)
  }
  // Sarah: verified deposit + receipt + pending points (eligibility still pending).
  // Aiman + Mei Ling are booking REQUESTS with 14-day holds — the on-camera
  // "Received" demo (seamless flow S1); no pre-recorded claims.
  queries.push(sql`INSERT INTO payment_claims (id, booking_id, amount, currency, paid_on, reference, kind, recorded_by, operation_key, submitted_at, status) VALUES ('DEMO-06', 'BKG-DEMO-06', '360.00', 'MYR', ${iso(daysAgo(2))}, 'BKG-DEMO-06', 'deposit', ${actor}, 'portal-demo-seed-DEMO-06', ${iso(daysAgo(2))}, 'verified')`)
  queries.push(sql`INSERT INTO payments (id, booking_id, claim_id, kind, amount, currency, rm_rate, rm_amount, verified_by, verified_at, receipt_no, operation_key) VALUES ('PAY-DEMO-06', 'BKG-DEMO-06', 'DEMO-06', 'deposit', '360.00', 'MYR', ${trip.rm_rate}, '360.00', ${actor}, ${iso(daysAgo(1))}, 'RCT-DEMO-06', 'portal-demo-seed-PAY-DEMO-06')`)
  const rules = { earnRate: 1, redeemValue: 0.05, expiryMonths: 12, capPct: 20, rounding: 'floor_per_payment', confirmation: 'aggregate_verified_cash', restoration: 'none', availableAfterCompletion: true }
  queries.push(sql`INSERT INTO points_ledger (id, customer_id, booking_id, payment_id, type, points, rm_amount, rate_snapshot, expires_at, rule_snapshot, operation_key, created_at, note) VALUES ('EARN-PAY-DEMO-06', 'CUS-DEMO-04', 'BKG-DEMO-06', 'PAY-DEMO-06', 'earned', 360, '360.00', ${trip.rm_rate}, ${iso(monthsAhead(12))}, ${JSON.stringify(rules)}::json, 'portal-demo-seed-EARN-06', ${iso(daysAgo(1))}, 'Demo seed — sample data')`)
  queries.push(sql`INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, at, meta) VALUES ('AUD-DEMO-06', ${actor}, 'payment_recorded', 'payment_claim', 'DEMO-06', ${iso(daysAgo(2))}, ${JSON.stringify({ sample: true })}::json)`)
  queries.push(sql`INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, at, meta) VALUES ('AUD-PAY-DEMO-06', ${actor}, 'payment_verified', 'payment', 'PAY-DEMO-06', ${iso(daysAgo(1))}, ${JSON.stringify({ bookingStatus: 'deposit_verified', sample: true })}::json)`)
  await sql.transaction(queries)
  console.log('Seeded 4 sample divers on TRP-004: BKG-DEMO-03/04/05 booking requests with 14-day holds (Received demo), BKG-DEMO-06 verified deposit (self-declared, no approval gate). Receipt RCT-DEMO-06, 360 pts pending.')
}

async function main() {
  const flag = process.argv[2]
  if (flag === '--clean') { await cleanSeed(); console.log('Portal DEMO rows removed.'); return }
  await cleanSeed()
  await purge()
  if (flag !== '--purge-only') await seed()
  const [counts] = await sql`SELECT (SELECT count(*) FROM bookings) AS bookings, (SELECT count(*) FROM customers) AS customers, (SELECT count(*) FROM trips) AS trips, (SELECT count(*) FROM payment_claims WHERE status = 'pending') AS pending_claims`
  console.log('After reset:', JSON.stringify(counts))
}

main().catch(err => { console.error(err); process.exit(1) })
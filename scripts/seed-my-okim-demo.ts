/**
 * M6 demo seed: clearly-labelled sample bookings + points under Jeff's customer
 * (CUS-001) so /myokim renders the full read-only journey for design approval and
 * the demo video. All rows use DEMO ids and sample trips — never real customer data.
 * Run: node scripts/seed-my-okim-demo.ts          (idempotent: replaces DEMO rows)
 *      node scripts/seed-my-okim-demo.ts --clean  (removes DEMO rows only)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
const CUSTOMER = 'CUS-001'

const now = new Date()
const iso = (d: Date) => d.toISOString()
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const monthsAhead = (n: number) => { const d = new Date(now); d.setUTCMonth(d.getUTCMonth() + n); return d }

async function clean() {
  await sql`DELETE FROM audit_log WHERE entity_id LIKE '%DEMO%'`
  await sql`DELETE FROM points_ledger WHERE id LIKE '%DEMO%'`
  await sql`DELETE FROM payments WHERE id LIKE '%DEMO%'`
  await sql`DELETE FROM payment_claims WHERE id LIKE '%DEMO%'`
  await sql`DELETE FROM invoices WHERE id LIKE '%DEMO%'`
  await sql`DELETE FROM bookings WHERE id LIKE '%DEMO%'`
  await sql`DELETE FROM trips WHERE id = 'TRP-DEMO-01'`
}

async function main() {
  const ACTOR = (await sql`SELECT id FROM users WHERE email = 'jeff.mailme@gmail.com'`)[0]?.id
  if (!ACTOR) throw new Error('Jeff user row missing — sign in once first')

  await clean()
  if (process.argv.includes('--clean')) { console.log('DEMO rows removed'); return }

  // Past sample trip (unpublished — keeps the public /trips list clean).
  await sql`INSERT INTO trips (id, slug, status, currency, price_amount, deposit_type, deposit_value, balance_due_days, capacity, rm_rate, travel_start, travel_end, title_en, title_zh, travel_dates_en, travel_dates_zh, published, sample)
  VALUES ('TRP-DEMO-01', 'tioman-demo-past', 'completed', 'MYR', 1000, 'percent', 30, 30, 8, 1, ${iso(new Date('2026-10-09T16:00:00Z'))}, ${iso(new Date('2026-10-11T16:00:00Z'))}, 'Tioman Reef Weekend — Past Demo', '刁曼岛珊瑚礁周末——往期示例', '9–11 Oct 2026', '2026年10月9–11日', false, true)`

  const declarations = JSON.stringify({ certification: 'Open Water (demo)', loggedDives: 25, insurance: true, medical: 'None declared (demo)', emergencyContact: 'Demo contact +60 12-345 6789' })
  const rules = { earnRate: 1, redeemValue: 0.05, expiryMonths: 12, capPct: 20, rounding: 'floor_per_payment', confirmation: 'aggregate_verified_cash', restoration: 'original_expiry', availableAfterCompletion: true }

  // 1) Upcoming confirmed booking on the demo bookable trip TRP-004 (deposit paid).
  await sql`INSERT INTO bookings (id, customer_id, product_id, status, eligibility_status, policy_version_id, accepted_at, deposit_amount, balance_amount, currency, declarations, created_at)
  VALUES ('BKG-DEMO-01', ${CUSTOMER}, 'TRP-004', 'confirmed', 'approved', 'POL-REFUND-001', ${iso(daysAgo(4))}, 360, 840, 'MYR', ${declarations}, ${iso(daysAgo(4))})`
  await sql`INSERT INTO invoices (id, booking_id, number, issued_at) VALUES ('INV-DEMO-01', 'BKG-DEMO-01', 'INV-DEMO-01', ${iso(daysAgo(4))})`
  await sql`INSERT INTO payment_claims (id, booking_id, amount, currency, paid_on, reference, kind, status, recorded_by, operation_key, submitted_at)
  VALUES ('CLM-DEMO-01', 'BKG-DEMO-01', 360, 'MYR', ${iso(daysAgo(3))}, 'BKG-DEMO-01', 'deposit', 'verified', ${ACTOR}, 'demo-seed-claim-01', ${iso(daysAgo(3))})`
  await sql`INSERT INTO payments (id, booking_id, claim_id, kind, amount, currency, rm_rate, rm_amount, verified_by, verified_at, receipt_no, operation_key)
  VALUES ('PAY-DEMO-01', 'BKG-DEMO-01', 'CLM-DEMO-01', 'deposit', 360, 'MYR', 1, 360, ${ACTOR}, ${iso(daysAgo(2))}, 'RCT-DEMO-01', 'demo-seed-pay-01')`
  await sql`INSERT INTO points_ledger (id, customer_id, booking_id, payment_id, type, points, rm_amount, rate_snapshot, rule_snapshot, expires_at, created_at, note)
  VALUES ('EARN-PAY-DEMO-01', ${CUSTOMER}, 'BKG-DEMO-01', 'PAY-DEMO-01', 'earned', 360, 360, 1, ${JSON.stringify(rules)}, ${iso(monthsAhead(12))}, ${iso(daysAgo(2))}, 'Demo seed — sample data')`

  // 2) Completed past booking, fully paid — its points are unlocked.
  await sql`INSERT INTO bookings (id, customer_id, product_id, status, eligibility_status, policy_version_id, accepted_at, deposit_amount, balance_amount, currency, declarations, created_at, completed_at)
  VALUES ('BKG-DEMO-02', ${CUSTOMER}, 'TRP-DEMO-01', 'completed', 'approved', 'POL-REFUND-001', ${iso(new Date('2026-09-15T00:00:00Z'))}, 300, 700, 'MYR', ${declarations}, ${iso(new Date('2026-09-15T00:00:00Z'))}, ${iso(new Date('2026-10-12T00:00:00Z'))})`
  await sql`INSERT INTO invoices (id, booking_id, number, issued_at) VALUES ('INV-DEMO-02', 'BKG-DEMO-02', 'INV-DEMO-02', ${iso(new Date('2026-09-15T00:00:00Z'))})`
  await sql`INSERT INTO payment_claims (id, booking_id, amount, currency, paid_on, reference, kind, status, recorded_by, operation_key, submitted_at)
  VALUES ('CLM-DEMO-02', 'BKG-DEMO-02', 1000, 'MYR', ${iso(new Date('2026-09-20T00:00:00Z'))}, 'BKG-DEMO-02', 'full', 'verified', ${ACTOR}, 'demo-seed-claim-02', ${iso(new Date('2026-09-20T00:00:00Z'))})`
  await sql`INSERT INTO payments (id, booking_id, claim_id, kind, amount, currency, rm_rate, rm_amount, verified_by, verified_at, receipt_no, operation_key)
  VALUES ('PAY-DEMO-02', 'BKG-DEMO-02', 'CLM-DEMO-02', 'full', 1000, 'MYR', 1, 1000, ${ACTOR}, ${iso(new Date('2026-09-21T00:00:00Z'))}, 'RCT-DEMO-02', 'demo-seed-pay-02')`
  await sql`INSERT INTO points_ledger (id, customer_id, booking_id, payment_id, type, points, rm_amount, rate_snapshot, rule_snapshot, expires_at, created_at, note)
  VALUES ('EARN-PAY-DEMO-02', ${CUSTOMER}, 'BKG-DEMO-02', 'PAY-DEMO-02', 'earned', 1000, 1000, 1, ${JSON.stringify(rules)}, ${iso(new Date('2027-09-21T00:00:00Z'))}, ${iso(new Date('2026-09-21T00:00:00Z'))}, 'Demo seed — sample data')`

  for (const id of ['BKG-DEMO-01', 'BKG-DEMO-02']) {
    await sql`INSERT INTO audit_log (id, actor_user_id, action, entity, entity_id, meta) VALUES (${`demo-seed-${id}`}, ${ACTOR}, 'demo_seeded', 'booking', ${id}, '{"sample":true}')`
  }
  console.log('Seeded DEMO bookings BKG-DEMO-01 (confirmed, TRP-004) + BKG-DEMO-02 (completed, past sample trip) under CUS-001. Expected /myokim: total 1360, available 1000.')
}

main().catch((error) => { console.error(error); process.exit(1) })
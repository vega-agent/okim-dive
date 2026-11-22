/**
 * Okim Dive — Drizzle schema (MVP-SPEC §12, one record book).
 * Append-only ledger; human-readable diver-facing IDs (CUS-xxx, BKG-xxx).
 */
import { pgTable, text, timestamp, integer, numeric, boolean, json, uniqueIndex, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/* ---------- Auth.js tables (Drizzle adapter shape) ---------- */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  role: text('role', { enum: ['instructor', 'customer'] }).notNull().default('customer'),
  image: text('image'),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
}, (t) => [
  uniqueIndex('account_provider_account_id').on(t.provider, t.providerAccountId),
])

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId').notNull().references(() => users.id),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => [index('verification_token_identifier').on(t.identifier)])

/* ---------- Customers ---------- */

// Name captured at the email step for new divers (owner decision 2026-11-21):
// stashed by email until the magic link verifies, then applied at diver creation.
export const signupNames = pgTable('signup_names', {
  email: text('email').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const customers = pgTable('customers', {
  diverProfile: json('diver_profile').$type<Record<string, unknown>>(),
  id: text('id').primaryKey(), // CUS-001
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  locale: text('locale', { enum: ['en', 'zh'] }).notNull().default('en'),
  mergedInto: text('merged_into'), // instructor-only merge; null = live record
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('customer_email_unique').on(t.email),
  // Unique diver names so Iris never sees ambiguous customers (owner 2026-11-21).
  // Partial: '' = setup pending, many pending customers may coexist.
  uniqueIndex('customer_name_unique').on(sql`lower(${t.name})`).where(sql`${t.name} <> ''`),
])

/* ---------- Trips (Iris-set rules; bilingual content) ---------- */

export const trips = pgTable('trips', {
  departureTimezone: text('departure_timezone').notNull().default('Asia/Kuala_Lumpur'),
  id: text('id').primaryKey(), // TRP-001
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: ['draft', 'open', 'on_request', 'full', 'departed', 'completed', 'cancelled'] }).notNull().default('draft'),
  currency: text('currency', { enum: ['MYR', 'SGD', 'USD'] }).notNull().default('MYR'),
  priceAmount: numeric('price_amount', { precision: 10, scale: 2 }).notNull(),
  depositType: text('deposit_type', { enum: ['fixed', 'percent'] }).notNull().default('percent'),
  depositValue: numeric('deposit_value', { precision: 10, scale: 2 }).notNull(),
  balanceDueDays: integer('balance_due_days').notNull().default(30),
  capacity: integer('capacity').notNull().default(1),
  minParticipants: integer('min_participants').notNull().default(1),
  rmRate: numeric('rm_rate', { precision: 10, scale: 4 }).notNull().default('1'),
  // Requirements (Iris-set; instructor decides, AI never does — MVP-SPEC §9)
  reqCertLevel: text('req_cert_level'),
  reqMinDives: integer('req_min_dives'),
  reqInsurance: boolean('req_insurance').notNull().default(false),
  reqMedical: boolean('req_medical').notNull().default(true),
  travelStart: timestamp('travel_start', { mode: 'date' }),
  travelEnd: timestamp('travel_end', { mode: 'date' }),
  // Bilingual content
  titleEn: text('title_en').notNull(),
  titleZh: text('title_zh').notNull(),
  locationEn: text('location_en'),
  locationZh: text('location_zh'),
  summaryEn: text('summary_en'),
  summaryZh: text('summary_zh'),
  // Display fields (M3): free-text card/dialog values from data/trips/*.json.
  // Structured columns above drive booking logic (M4+); these drive rendering.
  sortOrder: integer('sort_order').notNull().default(0),
  travelDatesEn: text('travel_dates_en'),
  travelDatesZh: text('travel_dates_zh'),
  durationEn: text('duration_en'),
  durationZh: text('duration_zh'),
  difficultyEn: text('difficulty_en'),
  difficultyZh: text('difficulty_zh'),
  groupSizeEn: text('group_size_en'),
  groupSizeZh: text('group_size_zh'),
  costDisplayEn: text('cost_display_en'),
  costDisplayZh: text('cost_display_zh'),
  costBasisEn: text('cost_basis_en'),
  costBasisZh: text('cost_basis_zh'),
  depositTextEn: text('deposit_text_en'),
  depositTextZh: text('deposit_text_zh'),
  balanceTextEn: text('balance_text_en'),
  balanceTextZh: text('balance_text_zh'),
  cancellationTextEn: text('cancellation_text_en'),
  cancellationTextZh: text('cancellation_text_zh'),
  requirementsTextEn: text('requirements_text_en'),
  requirementsTextZh: text('requirements_text_zh'),
  inquiryLabelEn: text('inquiry_label_en'),
  inquiryLabelZh: text('inquiry_label_zh'),
  highlightsEn: json('highlights_en').$type<string[]>(),
  highlightsZh: json('highlights_zh').$type<string[]>(),
  itineraryEn: json('itinerary_en').$type<string[]>(),
  itineraryZh: json('itinerary_zh').$type<string[]>(),
  includedEn: json('included_en').$type<string[]>(),
  includedZh: json('included_zh').$type<string[]>(),
  additionalCostsEn: json('additional_costs_en').$type<string[]>(),
  additionalCostsZh: json('additional_costs_zh').$type<string[]>(),
  notesEn: text('notes_en'),
  notesZh: text('notes_zh'),
  published: boolean('published').notNull().default(false),
  sample: boolean('sample').notNull().default(false), // honest sample label — vibe doc rule
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})

/* ---------- Bookings (product-agnostic for Phase 2 course booking) ---------- */

export const bookings = pgTable('bookings', {
  equipment: json('equipment').$type<Record<string, unknown>>(),
  id: text('id').primaryKey(), // BKG-001
  customerId: text('customer_id').notNull().references(() => customers.id),
  productType: text('product_type', { enum: ['trip', 'course'] }).notNull().default('trip'),
  productId: text('product_id').notNull(),
  status: text('status', {
    enum: ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed', 'completed', 'refund_flagged', 'cancelled', 'eligibility_declined', 'expired'],
  }).notNull().default('awaiting_deposit'),
  eligibilityStatus: text('eligibility_status', { enum: ['pending', 'approved', 'declined'] }).notNull().default('pending'),
  policyVersionId: text('policy_version_id').references(() => policyVersions.id),
  acceptedAt: timestamp('accepted_at', { mode: 'date' }),
  depositAmount: numeric('deposit_amount', { precision: 10, scale: 2 }),
  balanceAmount: numeric('balance_amount', { precision: 10, scale: 2 }),
  currency: text('currency', { enum: ['MYR', 'SGD', 'USD'] }).notNull(),
  pointsDiscountAmount: numeric('points_discount_amount', { precision: 10, scale: 2 }),
  // Declarations (JSON): cert, dives, insurance, medical, emergency contact, age
  declarations: json('declarations').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  cancelReason: text('cancel_reason'),
  // 14-day deposit soft-hold (decision #22, seamless flow S1–S2): reserves one
  // slot from creation; reminder 3 days before expiry; sweep releases unpaid.
  holdExpiresAt: timestamp('hold_expires_at', { mode: 'date' }),
  reminderSentAt: timestamp('reminder_sent_at', { mode: 'date' }),
})

/* ---------- Payment claims + payments ---------- */

export const paymentClaims = pgTable('payment_claims', {
  kind: text('kind', { enum: ['deposit', 'balance', 'full'] }).notNull().default('deposit'),
  recordedBy: text('recorded_by'),
  operationKey: text('operation_key').unique(),
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency', { enum: ['MYR', 'SGD', 'USD'] }).notNull(),
  paidOn: timestamp('paid_on', { mode: 'date' }).notNull(),
  reference: text('reference').notNull(), // Booking ID as transfer reference
  screenshotKey: text('screenshot_key'), // nullable: v1 evidence stays in WhatsApp (decision #20); instructor-recorded claims
  submittedAt: timestamp('submitted_at', { mode: 'date' }).notNull().defaultNow(),
  status: text('status', { enum: ['pending', 'verified', 'rejected'] }).notNull().default('pending'),
})

export const payments = pgTable('payments', {
  sourcePaymentId: text('source_payment_id'),
  operationKey: text('operation_key').unique(),
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  claimId: text('claim_id').references(() => paymentClaims.id),
  kind: text('kind', { enum: ['deposit', 'balance', 'full', 'refund'] }).notNull(),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency', { enum: ['MYR', 'SGD', 'USD'] }).notNull(),
  rmRate: numeric('rm_rate', { precision: 10, scale: 4 }),
  rmAmount: numeric('rm_amount', { precision: 12, scale: 2 }),
  verifiedBy: text('verified_by'), // audit: who
  verifiedAt: timestamp('verified_at', { mode: 'date' }), // audit: when
  receiptNo: text('receipt_no').unique(),
}, (t) => [uniqueIndex('payment_claim_once').on(t.claimId)])

export const invoices = pgTable('invoices', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  number: text('number').notNull().unique(),
  issuedAt: timestamp('issued_at', { mode: 'date' }).notNull().defaultNow(),
  pointsRedemptionId: text('points_redemption_id'),
})

/* ---------- Okim Points: append-only ledger, never a balance ---------- */

export const pointsLedger = pgTable('points_ledger', {
  sourceLotId: text('source_lot_id'),
  operationKey: text('operation_key').unique(),
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  bookingId: text('booking_id').references(() => bookings.id),
  paymentId: text('payment_id').references(() => payments.id),
  type: text('type', { enum: ['earned', 'redeemed', 'expired', 'reversed'] }).notNull(),
  points: integer('points').notNull(),
  rmAmount: numeric('rm_amount', { precision: 12, scale: 2 }),
  rateSnapshot: numeric('rate_snapshot', { precision: 10, scale: 4 }),
  ruleSnapshot: json('rule_snapshot').$type<Record<string, unknown>>(),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  note: text('note'),
}, (t) => [index('points_ledger_customer').on(t.customerId)])

/* ---------- Versioned policies ---------- */

export const policyVersions = pgTable('policy_versions', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['refund', 'privacy', 'terms'] }).notNull(),
  version: integer('version').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyZh: text('body_zh').notNull(),
  effectiveAt: timestamp('effective_at', { mode: 'date' }).notNull().defaultNow(),
  createdBy: text('created_by'),
}, (t) => [uniqueIndex('policy_kind_version').on(t.kind, t.version)])

/* ---------- Settings, inquiries, checklist, briefings, audit ---------- */

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: json('value').$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})

export const inquiries = pgTable('inquiries', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  interest: text('interest', { enum: ['course', 'trip', 'other'] }).notNull().default('other'),
  interestDetail: text('interest_detail'), // raw form selection, e.g. course-open-water
  tripId: text('trip_id').references(() => trips.id),
  message: text('message').notNull(),
  // Contact-form extras (M3): structured for the portal inquiry queue (M5)
  whatsapp: text('whatsapp'),
  preferredDates: text('preferred_dates'),
  groupSize: integer('group_size'),
  certification: text('certification'),
  locale: text('locale', { enum: ['en', 'zh'] }).notNull().default('en'),
  consentAt: timestamp('consent_at', { mode: 'date' }), // PDPA consent at inquiry (§14)
  status: text('status', { enum: ['new', 'handled'] }).notNull().default('new'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

export const tripChecklistItems = pgTable('trip_checklist_items', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id),
  labelEn: text('label_en').notNull(),
  labelZh: text('label_zh').notNull(),
  done: boolean('done').notNull().default(false),
  sort: integer('sort').notNull().default(0),
})

export const briefings = pgTable('briefings', {
  id: text('id').primaryKey(),
  tripId: text('trip_id').notNull().references(() => trips.id),
  draftText: text('draft_text'), // QwenWork manual-handoff draft (§15)
  approvedText: text('approved_text'),
  approvedBy: text('approved_by'), // Iris — human approval, AI never decides safety
  approvedAt: timestamp('approved_at', { mode: 'date' }),
  source: text('source').notNull().default('qwenwork-handoff'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
})

/* ---------- Trip messages (Luma-style stream, TRIP-MESSAGES-SPEC 2026-11-22) ----------
   On-platform delivery only for now (channel='platform'); email is a post-production
   option. Publish = human approval; edits/deletes audited with before-text.
   Audience filtered at VIEW time: late bookers see earlier matching messages. */

export const tripMessages = pgTable('trip_messages', {
  id: text('id').primaryKey(), // MSG-001
  tripId: text('trip_id').notNull().references(() => trips.id),
  label: text('label').notNull(), // free tag for sorting: Briefing, Checklist, Weather…
  subjectEn: text('subject_en').notNull(),
  subjectZh: text('subject_zh').notNull(),
  bodyEn: text('body_en').notNull(),
  bodyZh: text('body_zh').notNull(),
  audience: text('audience', { enum: ['confirmed', 'all_active'] }).notNull().default('confirmed'),
  channel: text('channel').notNull().default('platform'),
  publishedBy: text('published_by'),
  publishedAt: timestamp('published_at', { mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
}, (t) => [index('trip_messages_trip').on(t.tripId)])

export const messageReads = pgTable('message_reads', {
  messageId: text('message_id').notNull().references(() => tripMessages.id),
  customerId: text('customer_id').notNull().references(() => customers.id),
  seenAt: timestamp('seen_at', { mode: 'date' }).notNull().defaultNow(),
}, (t) => [uniqueIndex('message_read_unique').on(t.messageId, t.customerId)])

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id'),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  at: timestamp('at', { mode: 'date' }).notNull().defaultNow(),
  meta: json('meta').$type<Record<string, unknown>>(),
}, (t) => [index('audit_entity').on(t.entity, t.entityId)])

-- Transaction body for scripts/migrate-payment-schedule.ts.
-- The runner supplies the reviewed fixture plan and verifies conservation before commit.
\set ON_ERROR_STOP on
DO $entry$
BEGIN
  IF to_regclass('pg_temp.transition') IS NULL THEN
    RAISE EXCEPTION 'Use the reviewed migration runner with its transaction-scoped fixture plan';
  END IF;
END $entry$;
ALTER TABLE public.trip_deposits ADD COLUMN due_date date,
  ADD CONSTRAINT trip_deposits_sort_range CHECK (sort IN (0,1));
CREATE UNIQUE INDEX trip_deposits_trip_sort ON public.trip_deposits (trip_id, sort);
ALTER TABLE public.trips ADD COLUMN balance_due_date date;
ALTER TABLE public.bookings
  ADD COLUMN original_price_amount numeric(10,2),
  ADD COLUMN departure_timezone text,
  ADD COLUMN payment_revision integer NOT NULL DEFAULT 0,
  ADD COLUMN cancellation_kind text,
  ADD COLUMN refund_entitlement_amount numeric(10,2),
  ADD COLUMN refund_baseline_amount numeric(10,2),
  ADD COLUMN request_operation_key text,
  ADD COLUMN acknowledgment_attempted_at timestamptz,
  ADD CONSTRAINT bookings_payment_revision_nonnegative CHECK (payment_revision >= 0),
  ADD CONSTRAINT bookings_cancellation_kind CHECK (cancellation_kind IN
    ('diver_withdrawal','nonpayment','no_show','operator_cancelled','postponement_declined')),
  ADD CONSTRAINT bookings_refund_amounts CHECK (
    (cancellation_kind IS NULL AND refund_entitlement_amount IS NULL AND refund_baseline_amount IS NULL)
    OR (cancellation_kind IS NOT NULL AND refund_entitlement_amount IS NOT NULL AND refund_entitlement_amount >= 0 AND refund_entitlement_amount < 'Infinity'::numeric
      AND refund_baseline_amount IS NOT NULL AND refund_baseline_amount >= 0 AND refund_baseline_amount < 'Infinity'::numeric));
CREATE UNIQUE INDEX bookings_request_operation_key ON public.bookings (request_operation_key);

CREATE TABLE public.booking_stages (
  id text PRIMARY KEY,
  booking_id text NOT NULL CONSTRAINT booking_stages_booking_id_bookings_id_fk REFERENCES public.bookings(id),
  position integer NOT NULL,
  kind text NOT NULL,
  amount numeric(10,2) NOT NULL,
  due_date date,
  CONSTRAINT booking_stages_kind_position CHECK (
    amount < 'Infinity'::numeric AND ((kind='deposit' AND position IN (1,2) AND amount > 0) OR (kind='final' AND position=3 AND amount >= 0))),
  CONSTRAINT booking_stages_positive_due CHECK (amount=0 OR due_date IS NOT NULL)
);
-- position 3 exclusively identifies final; uniqueness gives at most one final per booking.
CREATE UNIQUE INDEX booking_stages_booking_position ON public.booking_stages (booking_id, position);
CREATE TABLE public.payment_allocations (
  payment_id text NOT NULL CONSTRAINT payment_allocations_payment_id_payments_id_fk REFERENCES public.payments(id),
  stage_id text NOT NULL CONSTRAINT payment_allocations_stage_id_booking_stages_id_fk REFERENCES public.booking_stages(id),
  amount numeric(10,2) NOT NULL,
  PRIMARY KEY(payment_id, stage_id),
  CONSTRAINT payment_allocations_positive CHECK (amount > 0 AND amount < 'Infinity'::numeric)
);
ALTER TABLE public.payments ADD COLUMN receipt_snapshot json;

-- All quantities in the approved plan are integer minor units.
UPDATE public.trips t SET balance_due_date=d."dueDate"
FROM jsonb_to_recordset((SELECT plan->'tripDates' FROM pg_temp.transition)) AS d(id text,"dueDate" date)
WHERE t.id=d.id;
UPDATE public.trip_deposits t SET due_date=d."dueDate"
FROM jsonb_to_recordset((SELECT plan->'depositDates' FROM pg_temp.transition)) AS d(id text,"dueDate" date)
WHERE t.id=d.id;
UPDATE public.bookings b SET original_price_amount=d."originalPriceMinor"/100.0, departure_timezone=d.timezone
FROM jsonb_to_recordset((SELECT plan->'bookings' FROM pg_temp.transition)) AS d(id text,"originalPriceMinor" bigint,timezone text)
WHERE b.id=d.id;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_schedule_required CHECK (
  original_price_amount IS NOT NULL AND original_price_amount > 0 AND original_price_amount < 'Infinity'::numeric AND departure_timezone IS NOT NULL AND length(trim(departure_timezone)) > 0);

INSERT INTO public.booking_stages(id,booking_id,position,kind,amount,due_date)
SELECT id,"bookingId",position,kind,"amountMinor"/100.0,"dueDate"
FROM jsonb_to_recordset((SELECT plan->'stages' FROM pg_temp.transition))
  AS s(id text,"bookingId" text,position int,kind text,"amountMinor" bigint,"dueDate" date);
INSERT INTO public.payment_allocations(payment_id,stage_id,amount)
SELECT "paymentId","stageId","amountMinor"/100.0 FROM jsonb_to_recordset((SELECT plan->'allocations' FROM pg_temp.transition))
  AS a("paymentId" text,"stageId" text,"amountMinor" bigint);
UPDATE public.payments p SET receipt_snapshot=r.snapshot
FROM jsonb_to_recordset((SELECT plan->'receipts' FROM pg_temp.transition)) AS r(id text,snapshot json)
WHERE p.id=r.id;

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bookings b LEFT JOIN public.booking_stages s ON s.booking_id=b.id
    GROUP BY b.id HAVING count(s.id)<>2 OR sum(s.amount) IS DISTINCT FROM b.original_price_amount
      OR b.original_price_amount IS DISTINCT FROM b.deposit_amount+b.balance_amount+coalesce(b.points_discount_amount,0))
    OR EXISTS (SELECT 1 FROM public.payments p LEFT JOIN public.payment_allocations a ON a.payment_id=p.id
    GROUP BY p.id HAVING sum(a.amount) IS DISTINCT FROM p.amount OR p.receipt_snapshot IS NULL)
    OR EXISTS (SELECT 1 FROM public.payment_allocations a JOIN public.payments p ON p.id=a.payment_id
      JOIN public.booking_stages s ON s.id=a.stage_id WHERE p.booking_id<>s.booking_id)
    OR EXISTS (SELECT 1 FROM public.payment_allocations a JOIN public.payments p ON p.id=a.payment_id
      LEFT JOIN public.payment_allocations source ON source.payment_id=p.source_payment_id AND source.stage_id=a.stage_id
      WHERE p.kind='refund' GROUP BY p.source_payment_id,a.stage_id,source.amount HAVING source.amount IS NULL OR sum(a.amount)>source.amount)
  THEN RAISE EXCEPTION 'Migration reconciliation failed'; END IF;
END $verify$;

-- Run from the repository root against the migrated disposable PostgreSQL database:
-- psql -X -w -h 127.0.0.1 -p 55433 -U okim_payment_test -d postgres -f tests/financial-workflow-db/verify.sql
-- These probes exercise storage and transactions. The application owns validation,
-- allocation, state transitions, refund eligibility, and receipt immutability.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';

DO $test$
DECLARE
  booking constant text := 'workflow-db-booking';
  zero_final constant text := 'workflow-db-zero-final';
  snapshot constant jsonb := '{"schemaVersion":1,"paidOn":"2027-01-05","grossReceivedMinor":5000,"outstandingMinor":85000,
    "allocations":[{"stageId":"workflow-db-d1","amountMinor":5000}]}'::jsonb;
BEGIN
  IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet
    OR inet_server_port() IS DISTINCT FROM 55433
    OR current_database() <> 'postgres' OR current_user <> 'okim_payment_test'
  THEN
    RAISE EXCEPTION 'Expected the disposable PostgreSQL target at 127.0.0.1:55433/postgres';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM audit_log WHERE id = 'payment-schedule-20261123' AND action = 'payment_schedule_migrated'
  ) THEN
    RAISE EXCEPTION 'Missing the payment schedule migration audit marker';
  END IF;

  INSERT INTO customers (id, name, email)
  VALUES ('workflow-db-customer', 'Workflow DB fixture', 'workflow-db@example.com');

  INSERT INTO trips (id, slug, title_en, title_zh, price_amount, deposit_value, balance_due_date)
  VALUES ('workflow-db-trip', 'workflow-db-trip', 'Workflow DB fixture', 'Workflow DB fixture', 1000, 200, '2027-03-01');

  INSERT INTO bookings (id, customer_id, product_id, currency, declarations, original_price_amount,
                        departure_timezone, points_discount_amount, request_operation_key)
  VALUES (booking, 'workflow-db-customer', 'workflow-db-trip', 'MYR', '{}', 1000,
          'Asia/Kuala_Lumpur', 100, '54000000-0000-4000-8000-000000000001'),
         (zero_final, 'workflow-db-customer', 'workflow-db-trip', 'MYR', '{}', 200,
          'Asia/Kuala_Lumpur', 0, '54000000-0000-4000-8000-000000000002');

  INSERT INTO booking_stages (id, booking_id, position, kind, amount, due_date)
  VALUES ('workflow-db-d1', booking, 1, 'deposit', 200, '2027-01-01'),
         ('workflow-db-d2', booking, 2, 'deposit', 300, '2027-02-01'),
         ('workflow-db-final', booking, 3, 'final', 500, '2027-03-01'),
         ('workflow-db-zero-d1', zero_final, 1, 'deposit', 200, '2027-01-01'),
         ('workflow-db-zero-f', zero_final, 3, 'final', 0, NULL);

  IF (SELECT sum(amount) FROM booking_stages WHERE booking_id = booking) IS DISTINCT FROM 1000::numeric
    OR (SELECT sum(amount) FROM booking_stages WHERE booking_id = zero_final) IS DISTINCT FROM 200::numeric
    OR NOT EXISTS (
      SELECT 1 FROM booking_stages WHERE booking_id = zero_final AND kind = 'final' AND amount = 0 AND due_date IS NULL
    )
  THEN
    RAISE EXCEPTION 'Expected conserved stage prices and an optional zero final deadline';
  END IF;

  UPDATE trips SET price_amount = 1200, balance_due_date = '2027-04-01' WHERE id = 'workflow-db-trip';
  IF NOT EXISTS (
    SELECT 1 FROM booking_stages WHERE id = 'workflow-db-final' AND amount = 500 AND due_date = '2027-03-01'
  ) OR NOT EXISTS (
    SELECT 1 FROM bookings WHERE id = booking AND original_price_amount = 1000
       AND points_discount_amount = 100
  ) THEN
    RAISE EXCEPTION 'Expected the stored booking price, final discount and stage deadline to survive a trip edit';
  END IF;
  RAISE NOTICE 'PASS: durable two-deposit and zero-final schedules';

  BEGIN
    INSERT INTO booking_stages (id, booking_id, position, kind, amount, due_date)
    VALUES ('workflow-db-third-deposit', booking, 4, 'deposit', 50, '2027-04-01');
    RAISE EXCEPTION 'Expected a third deposit to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO booking_stages (id, booking_id, position, kind, amount, due_date)
    VALUES ('workflow-db-duplicate-d1', booking, 1, 'deposit', 50, '2027-04-01');
    RAISE EXCEPTION 'Expected duplicate stage position to be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    UPDATE booking_stages SET due_date = NULL WHERE id = 'workflow-db-d2';
    RAISE EXCEPTION 'Expected a positive stage without a deadline to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  RAISE NOTICE 'PASS: stage position, uniqueness, and deadline constraints';

  INSERT INTO payment_claims (id, booking_id, kind, amount, currency, paid_on, reference, status, operation_key)
  VALUES ('workflow-db-claim-partial', booking, 'deposit', 50, 'MYR', '2027-01-05', booking, 'verified',
          '54000000-0000-4000-8000-000000000003');

  INSERT INTO payments (id, booking_id, claim_id, kind, amount, currency, receipt_no, receipt_snapshot, operation_key)
  VALUES ('workflow-db-partial', booking, 'workflow-db-claim-partial', 'deposit', 50, 'MYR', 'workflow-db-R1', snapshot,
          '54000000-0000-4000-8000-000000000003');
  INSERT INTO payment_allocations (payment_id, stage_id, amount) VALUES ('workflow-db-partial', 'workflow-db-d1', 50);

  BEGIN
    INSERT INTO payments (id, booking_id, kind, amount, currency, operation_key)
    VALUES ('workflow-db-duplicate-operation', booking, 'deposit', 50, 'MYR', '54000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'Expected duplicate operation key to be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO payments (id, booking_id, claim_id, kind, amount, currency)
    VALUES ('workflow-db-duplicate-claim', booking, 'workflow-db-claim-partial', 'deposit', 50, 'MYR');
    RAISE EXCEPTION 'Expected second payment for the same claim to be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO payment_allocations (payment_id, stage_id, amount)
    VALUES ('workflow-db-partial', 'workflow-db-d2', 0);
    RAISE EXCEPTION 'Expected a zero allocation to be rejected';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  IF (SELECT amount - (SELECT amount FROM payment_allocations
                       WHERE payment_id = 'workflow-db-partial' AND stage_id = 'workflow-db-d1')
      FROM booking_stages WHERE id = 'workflow-db-d1') IS DISTINCT FROM 150::numeric
  THEN
    RAISE EXCEPTION 'Expected 150 left on the first deposit after the partial receipt';
  END IF;

  INSERT INTO payments (id, booking_id, kind, amount, currency, operation_key)
  VALUES ('workflow-db-d1-rest', booking, 'deposit', 150, 'MYR', '54000000-0000-4000-8000-000000000004'),
         ('workflow-db-combined', booking, 'balance', 400, 'MYR', '54000000-0000-4000-8000-000000000005');
  INSERT INTO payment_allocations (payment_id, stage_id, amount)
  VALUES ('workflow-db-d1-rest', 'workflow-db-d1', 150),
         ('workflow-db-combined', 'workflow-db-d2', 300),
         ('workflow-db-combined', 'workflow-db-final', 100);

  IF EXISTS (
    SELECT 1 FROM payments p LEFT JOIN payment_allocations a ON a.payment_id = p.id
    WHERE p.booking_id = booking GROUP BY p.id HAVING p.amount IS DISTINCT FROM sum(a.amount)
  ) OR (
    SELECT b.original_price_amount - b.points_discount_amount - sum(a.amount)
    FROM bookings b JOIN booking_stages s ON s.booking_id = b.id
    JOIN payment_allocations a ON a.stage_id = s.id
    WHERE b.id = booking GROUP BY b.id
  ) IS DISTINCT FROM 300::numeric THEN
    RAISE EXCEPTION 'Expected 600 allocated received and 300 outstanding after a final-only 100 discount';
  END IF;
  RAISE NOTICE 'PASS: partial D1, D1 settlement, combined D2/final receipt, and duplicate guards';

  INSERT INTO payments (id, booking_id, kind, amount, currency, source_payment_id)
  VALUES ('workflow-db-prior-refund', booking, 'refund', 20, 'MYR', 'workflow-db-combined');
  INSERT INTO payment_allocations (payment_id, stage_id, amount)
  VALUES ('workflow-db-prior-refund', 'workflow-db-final', 20);

  UPDATE bookings SET status = 'cancelled', cancellation_kind = 'diver_withdrawal',
    refund_entitlement_amount = 80, refund_baseline_amount = 20
  WHERE id = booking;

  INSERT INTO payments (id, booking_id, kind, amount, currency, source_payment_id)
  VALUES ('workflow-db-partial-refund', booking, 'refund', 30, 'MYR', 'workflow-db-combined');
  INSERT INTO payment_allocations (payment_id, stage_id, amount)
  VALUES ('workflow-db-partial-refund', 'workflow-db-final', 30);
  INSERT INTO audit_log (id, action, entity, entity_id, meta)
  VALUES ('refund-op-54000000-0000-4000-8000-000000000006', 'refund_recorded', 'booking', booking,
          '{"childPaymentIds":["workflow-db-partial-refund"],"refundOutstandingAfterMinor":5000}');

  IF (
    SELECT b.refund_entitlement_amount + b.refund_baseline_amount - sum(p.amount)
    FROM bookings b JOIN payments p ON p.booking_id = b.id AND p.kind = 'refund'
    WHERE b.id = booking GROUP BY b.id
  ) IS DISTINCT FROM 50::numeric THEN
    RAISE EXCEPTION 'Expected 50 refund outstanding after partial refund and prior refund baseline';
  END IF;

  BEGIN
    INSERT INTO payments (id, booking_id, kind, amount, currency, source_payment_id)
    VALUES ('workflow-db-rolled-back-refund', booking, 'refund', 50, 'MYR', 'workflow-db-combined');
    INSERT INTO payment_allocations (payment_id, stage_id, amount)
    VALUES ('workflow-db-rolled-back-refund', 'workflow-db-final', 50);
    INSERT INTO audit_log (id, action, entity, entity_id)
    VALUES ('refund-op-54000000-0000-4000-8000-000000000006', 'refund_recorded', 'booking', booking);
    RAISE EXCEPTION 'Expected duplicate refund audit key to be rejected';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  IF EXISTS (SELECT 1 FROM payments WHERE id = 'workflow-db-rolled-back-refund')
    OR EXISTS (SELECT 1 FROM payment_allocations WHERE payment_id = 'workflow-db-rolled-back-refund')
  THEN
    RAISE EXCEPTION 'Refund write failure left money or allocations behind';
  END IF;

  INSERT INTO payments (id, booking_id, kind, amount, currency, source_payment_id)
  VALUES ('workflow-db-last-refund', booking, 'refund', 50, 'MYR', 'workflow-db-combined');
  INSERT INTO payment_allocations (payment_id, stage_id, amount)
  VALUES ('workflow-db-last-refund', 'workflow-db-final', 50);

  IF (
    SELECT b.refund_entitlement_amount + b.refund_baseline_amount - sum(p.amount)
    FROM bookings b JOIN payments p ON p.booking_id = b.id AND p.kind = 'refund'
    WHERE b.id = booking GROUP BY b.id
  ) IS DISTINCT FROM 0::numeric OR (
    SELECT sum(CASE WHEN p.kind = 'refund' THEN -a.amount ELSE a.amount END)
    FROM payment_allocations a JOIN payments p ON p.id = a.payment_id WHERE p.booking_id = booking
  ) IS DISTINCT FROM 500::numeric OR EXISTS (
    SELECT 1 FROM payment_allocations a JOIN payments p ON p.id = a.payment_id
    LEFT JOIN payment_allocations source ON source.payment_id = p.source_payment_id AND source.stage_id = a.stage_id
    WHERE p.booking_id = booking AND p.kind = 'refund'
    GROUP BY p.source_payment_id, a.stage_id, source.amount HAVING source.amount IS NULL OR sum(a.amount) > source.amount
  ) THEN
    RAISE EXCEPTION 'Expected reconciled refunds, exhausted entitlement and 500 net deposits retained';
  END IF;
  IF (SELECT receipt_snapshot::jsonb FROM payments WHERE id = 'workflow-db-partial') IS DISTINCT FROM snapshot THEN
    RAISE EXCEPTION 'Expected subsequent receipts and refunds to leave the first snapshot intact';
  END IF;
  RAISE NOTICE 'PASS: refund baseline, source-linked partial/full refunds, atomic failure and receipt history';
END
$test$;
ROLLBACK;

DO $cleanup$
BEGIN
  IF EXISTS (
    SELECT 1 FROM customers WHERE id LIKE 'workflow-db-%' UNION ALL
    SELECT 1 FROM trips WHERE id LIKE 'workflow-db-%' UNION ALL
    SELECT 1 FROM bookings WHERE id LIKE 'workflow-db-%' UNION ALL
    SELECT 1 FROM booking_stages WHERE id LIKE 'workflow-db-%' UNION ALL
    SELECT 1 FROM payment_claims WHERE id LIKE 'workflow-db-%' UNION ALL
    SELECT 1 FROM payments WHERE id LIKE 'workflow-db-%' UNION ALL
    SELECT 1 FROM payment_allocations WHERE payment_id LIKE 'workflow-db-%' UNION ALL
    SELECT 1 FROM audit_log WHERE entity_id LIKE 'workflow-db-%'
  ) THEN
    RAISE EXCEPTION 'Workflow DB fixtures remain after rollback';
  END IF;
  RAISE NOTICE 'PASS: zero persisted fixtures across all eight touched tables';
END
$cleanup$;

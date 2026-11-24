// Synthetic one-deposit booking for adjacent UI tests (profile, Messages and equipment).
// Financial behavior is exercised separately through the real payment actions.
export function stagedBookingRows(sql, { id, customerId, tripId, status = 'awaiting_deposit',
  equipment = null, declarations = {}, createdAt = new Date().toISOString() }) {
  const completed = status === 'completed'
  const confirmed = completed || status === 'confirmed' || status === 'deposit_verified'
  const received = completed ? 100 : confirmed ? 30 : 0
  const rows = [
    sql`INSERT INTO bookings(id,customer_id,product_id,status,eligibility_status,currency,
      original_price_amount,departure_timezone,deposit_amount,balance_amount,declarations,equipment,created_at,completed_at,payment_revision)
      VALUES (${id},${customerId},${tripId},${status},'approved','MYR',
      100,'Asia/Kuala_Lumpur',30,70,${JSON.stringify(declarations)}::json,${equipment ? JSON.stringify(equipment) : null}::json,
      ${createdAt},${completed ? createdAt : null},${received ? 1 : 0})`,
    sql`INSERT INTO booking_stages(id,booking_id,position,kind,amount,due_date) VALUES
      (${id+'-D1'},${id},1,'deposit',30,current_date),(${id+'-final'},${id},3,'final',70,current_date+3)`,
    sql`INSERT INTO invoices(id,booking_id,number) VALUES(${'INV-'+id},${id},${'INV-'+id})`,
  ]
  if (received) {
    const paymentId = 'PAY-' + id
    const claim = 'CLM-' + id
    const paidOn = createdAt.slice(0,10)
    const allocations = [{stageId:id+'-D1',position:1,kind:'deposit',amountMinor:3000}]
    if (completed) allocations.push({stageId:id+'-final',position:3,kind:'final',amountMinor:7000})
    const snapshot = {schemaVersion:1,provenance:'synthetic_review_fixture',bookingId:id,currency:'MYR',kind:'received',
      paidOn,recordedAt:createdAt,amountMinor:received*100,allocations,grossReceivedMinor:received*100,
      refundedMinor:0,netReceivedMinor:received*100,outstandingMinor:(100-received)*100}
    const kind = completed ? 'full' : 'deposit'
    rows.push(sql`INSERT INTO payment_claims(id,booking_id,kind,amount,currency,paid_on,reference,status,operation_key)
      VALUES(${claim},${id},${kind},${received},'MYR',${paidOn},${id},'verified',${claim})`,
    sql`INSERT INTO payments(id,booking_id,claim_id,kind,amount,currency,rm_rate,rm_amount,verified_at,receipt_no,operation_key,receipt_snapshot)
      VALUES(${paymentId},${id},${claim},${kind},${received},'MYR',1,${received},${createdAt},${'RCT-'+id},${paymentId},${JSON.stringify(snapshot)}::json)`)
    for (const a of allocations) rows.push(sql`INSERT INTO payment_allocations(payment_id,stage_id,amount)
      VALUES(${paymentId},${a.stageId},${a.amountMinor/100})`)
  }
  return rows
}

export function deleteStagedBookingRows(sql, ids) {
  return [
    sql`DELETE FROM audit_log WHERE entity_id=ANY(${ids})
      OR entity_id IN(SELECT id FROM payments WHERE booking_id=ANY(${ids}) UNION ALL SELECT id FROM payment_claims WHERE booking_id=ANY(${ids}))`,
    sql`DELETE FROM points_ledger WHERE booking_id=ANY(${ids})`,
    sql`DELETE FROM payment_allocations WHERE stage_id IN (SELECT id FROM booking_stages WHERE booking_id=ANY(${ids}))`,
    sql`DELETE FROM payments WHERE booking_id=ANY(${ids})`,
    sql`DELETE FROM payment_claims WHERE booking_id=ANY(${ids})`,
    sql`DELETE FROM invoices WHERE booking_id=ANY(${ids})`,
    sql`DELETE FROM booking_stages WHERE booking_id=ANY(${ids})`,
    sql`DELETE FROM bookings WHERE id=ANY(${ids})`,
  ]
}

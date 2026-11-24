export type AcknowledgmentOutcome = 'provider_accepted' | 'failed' | 'suppressed'
export type AcknowledgmentStatus = AcknowledgmentOutcome | 'unconfirmed'
type Dependencies<P> = {
  claimAttempt: (bookingId: string) => Promise<boolean>
  send: (payload: P) => Promise<boolean>
  recordOutcome: (bookingId: string, outcome: AcknowledgmentOutcome) => Promise<void>
  previousOutcome: (bookingId: string) => Promise<AcknowledgmentStatus>
  suppressed?: boolean
}

/** Claim before external I/O. A missing outcome after a crash needs manual follow-up. */
export async function attemptBookingAcknowledgment<P>(bookingId: string, payload: P, deps: Dependencies<P>): Promise<AcknowledgmentStatus> {
  try {
    if (!await deps.claimAttempt(bookingId)) return await deps.previousOutcome(bookingId)
    let outcome: AcknowledgmentOutcome = 'suppressed'
    if (!deps.suppressed) {
      try { outcome = await deps.send(payload) ? 'provider_accepted' : 'failed' }
      catch { outcome = 'failed' }
    }
    await deps.recordOutcome(bookingId, outcome)
    return outcome
  } catch {
    return 'unconfirmed'
  }
}

type BookingAttempt = { requestOperationKey: string | null; createdAt: Date; acknowledgmentAttemptedAt: Date | null }

/** Give a request in progress five minutes before putting it in the support list. */
export function missingAcknowledgment(booking: BookingAttempt, hasOutcome: boolean, now: number) {
  if (hasOutcome || !booking.requestOperationKey) return null
  const at = booking.acknowledgmentAttemptedAt ?? booking.createdAt
  if (now - at.getTime() < 5 * 60_000) return null
  return { action: booking.acknowledgmentAttemptedAt ? 'booking_acknowledgment_unconfirmed' : 'booking_acknowledgment_not_attempted', at }
}

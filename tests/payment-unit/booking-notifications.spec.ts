import { test, expect } from '@playwright/test'
import { attemptBookingAcknowledgment, missingAcknowledgment, type AcknowledgmentStatus } from '../../src/lib/booking-notifications'

function fixture(result: boolean | Error = true) {
  let claimed = false
  let sends = 0
  let stored: AcknowledgmentStatus = 'unconfirmed'
  const deps = {
    async claimAttempt() { if (claimed) return false; claimed = true; return true },
    async send() { sends++; if (result instanceof Error) throw result; return result },
    async recordOutcome(_id: string, outcome: AcknowledgmentStatus) { stored = outcome },
    async previousOutcome() { return stored },
    suppressed: false,
  }
  return { deps, sends: () => sends, attempt: () => attemptBookingAcknowledgment('BKG-test', {}, deps) }
}

test('duplicate and concurrent booking acknowledgments make one sender call', async () => {
  const f = fixture()
  const outcomes = await Promise.all([f.attempt(), f.attempt()])
  expect(outcomes).toContain('provider_accepted')
  expect(await f.attempt()).toBe('provider_accepted')
  expect(f.sends()).toBe(1)
})

test('provider rejection, exception and local suppression persist different outcomes without retries', async () => {
  for (const response of [false, Error('fake transport')]) {
    const f = fixture(response)
    expect(await f.attempt()).toBe('failed')
    expect(await f.attempt()).toBe('failed')
    expect(f.sends()).toBe(1)
  }
  const f = fixture()
  f.deps.suppressed = true
  expect(await f.attempt()).toBe('suppressed')
  expect(await f.attempt()).toBe('suppressed')
  expect(f.sends()).toBe(0)
})

test('lost process or audit after the claim leaves an unconfirmed outcome and prevents a resend', async () => {
  const beforeSend = fixture()
  await beforeSend.deps.claimAttempt()
  expect(await beforeSend.attempt()).toBe('unconfirmed')
  expect(beforeSend.sends()).toBe(0)
  const afterSend = fixture()
  afterSend.deps.recordOutcome = async () => { throw Error('audit unavailable') }
  expect(await afterSend.attempt()).toBe('unconfirmed')
  expect(await afterSend.attempt()).toBe('unconfirmed')
  expect(afterSend.sends()).toBe(1)
})

test('manual support covers interrupted new bookings before and after claiming while excluding in-flight, audited and legacy rows', () => {
  const createdAt = new Date('2026-01-01T00:00:00Z')
  const now = createdAt.getTime() + 6 * 60_000
  const booking = { requestOperationKey:'request', createdAt, acknowledgmentAttemptedAt:null }
  expect(missingAcknowledgment(booking,false,now)).toEqual({action:'booking_acknowledgment_not_attempted',at:createdAt})
  expect(missingAcknowledgment({...booking,acknowledgmentAttemptedAt:createdAt},false,now)?.action).toBe('booking_acknowledgment_unconfirmed')
  expect(missingAcknowledgment(booking,false,createdAt.getTime())).toBeNull()
  expect(missingAcknowledgment({...booking,acknowledgmentAttemptedAt:new Date(now)},false,now)).toBeNull()
  expect(missingAcknowledgment(booking,true,now)).toBeNull()
  expect(missingAcknowledgment({...booking,requestOperationKey:null},false,now)).toBeNull()
})

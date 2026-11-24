import { expect, test } from '@playwright/test'
import { cashAward, spendablePoints } from '../../src/lib/points-accounting'

test('completion uses exact conversion before flooring each individual award', () => {
  expect(cashAward(2500, '4.6000')).toEqual({ points: 115, rmAmount: '115.00' })
  expect(cashAward(100, '1.9999')).toEqual({ points: 1, rmAmount: '2.00' })
})

test('expired and unfinished positive balances cannot finance an overspent points lot', () => {
  const row = {
    sourceLotId: null,
    bookingId: 'completed',
    type: 'earned',
    points: 100,
    expiresAt: new Date('2027-01-01'),
  }
  const ledger = [
    { ...row, id: 'debt' },
    { ...row, id: 'use', type: 'redeemed', points: -100, sourceLotId: 'debt' },
    { ...row, id: 'undo', type: 'reversed', points: -100, sourceLotId: 'debt' },
    { ...row, id: 'available' },
    { ...row, id: 'expired', expiresAt: new Date('2025-01-01') },
    { ...row, id: 'unfinished', bookingId: 'unfinished' },
  ]
  const state = spendablePoints(ledger, new Set(['completed']), new Date('2026-01-01'))
  expect(state.available).toBe(0)
  expect(state.spendable.map((s) => s.lot.id)).toEqual(['available'])
  expect(state.expired.map((s) => s.lot.id)).toEqual(['expired'])
})

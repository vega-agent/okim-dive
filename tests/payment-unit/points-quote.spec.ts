import { expect, test } from '@playwright/test'
import * as points from '../../src/lib/points-accounting'

test('the points preview floors the same fractional cents as settlement and respects the lower final balance', () => {
  expect(points.redemptionDiscountMinor(4, '0.05', '1.5000')).toBe(13)
  expect(points.maximumRedeemablePoints(500, 13, '0.05', '1.5000')).toBe(4)
  expect(points.maximumRedeemablePoints(2, 13, '0.05', '1.5000')).toBe(2)
  expect(points.maximumRedeemablePoints(1, 0, '0.05', '1.5000')).toBe(0)
  expect(points.maximumRedeemablePoints(1, 200, '0.001', '1.0000')).toBe(0)
})

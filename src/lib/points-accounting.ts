/** Historical earn rule: floor exact RM separately per payment. Store RM to two decimal places. */
export function cashAward(cashMinor: number, rate: string) {
  if (!Number.isSafeInteger(cashMinor) || cashMinor < 0 || !/^\d+(\.\d{1,4})?$/.test(rate))
    throw Error('Invalid cash conversion')
  const [whole, decimal = ''] = rate.split('.')
  const scaledRate = BigInt(whole + decimal.padEnd(4, '0'))
  if (scaledRate <= BigInt(0)) throw Error('Invalid cash conversion')
  const product = BigInt(cashMinor) * scaledRate
  const points = Number(product / BigInt(1000000)),
    rmMinor = Number((product + BigInt(5000)) / BigInt(10000))
  if (!Number.isSafeInteger(points) || !Number.isSafeInteger(rmMinor)) throw Error('Cash conversion out of range')
  return { points, rmAmount: (rmMinor / 100).toFixed(2) }
}

type Lot = {
  id: string
  sourceLotId: string | null
  type: string
  bookingId: string | null
  points: number
  expiresAt: Date | null
}
export function spendablePoints<T extends Lot>(rows: T[], completed: Set<string>, now: Date) {
  const earned = rows
    .filter((r) => r.type === 'earned')
    .sort((a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0) || a.id.localeCompare(b.id))
  const balances = new Map(earned.map((lot) => [lot.id, lot.points]))
  let available = 0
  for (const row of rows) {
    if (row.type === 'earned') continue
    if (row.sourceLotId && balances.has(row.sourceLotId))
      balances.set(row.sourceLotId, balances.get(row.sourceLotId)! + row.points)
    else available += Math.min(0, row.points)
  }
  const spendable: { lot: T; amount: number }[] = [],
    expired: { lot: T; amount: number }[] = []
  for (const lot of earned) {
    const amount = balances.get(lot.id)!
    if (amount <= 0) {
      available += amount
      continue
    }
    if (!lot.expiresAt || lot.expiresAt <= now) {
      expired.push({ lot, amount })
      continue
    }
    if (lot.bookingId && completed.has(lot.bookingId)) {
      spendable.push({ lot, amount })
      available += amount
    }
  }
  return { available: Math.max(0, available), spendable, expired }
}

function positiveDecimalRatio(value: string) {
  if (!/^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(Number(value)) || Number(value) <= 0) {
    throw Error('Invalid redemption conversion')
  }
  const [decimal, exp = '0'] = value.toLowerCase().split('e')
  const [whole, fraction = ''] = decimal.split('.')
  const scale = fraction.length - Number(exp)
  return {
    n: BigInt(whole + fraction + '0'.repeat(Math.max(0, -scale))),
    d: BigInt('1' + '0'.repeat(Math.max(0, scale))),
  }
}

function pointsToMinorRatio(redeemValue: string, rmRate: string) {
  const value = positiveDecimalRatio(redeemValue)
  const rate = positiveDecimalRatio(rmRate)
  return { n: BigInt(100) * value.n * rate.d, d: value.d * rate.n }
}

export function redemptionDiscountMinor(points: number, redeemValue: string, rmRate: string) {
  if (!Number.isSafeInteger(points) || points < 0) throw Error('Invalid points')
  const { n, d } = pointsToMinorRatio(redeemValue, rmRate)
  const discount = Number(BigInt(points) * n / d)
  if (!Number.isSafeInteger(discount)) throw Error('Discount out of range')
  return discount
}

export function maximumRedeemablePoints(available: number, capMinor: number, redeemValue: string, rmRate: string) {
  if (!Number.isSafeInteger(available) || !Number.isSafeInteger(capMinor) || available <= 0 || capMinor <= 0) return 0
  const { n, d } = pointsToMinorRatio(redeemValue, rmRate)
  // floor(points*n/d) <= cap exactly while points*n < (cap+1)*d.
  const ceiling = ((BigInt(capMinor) + BigInt(1)) * d - BigInt(1)) / n
  const points = Number(ceiling < BigInt(available) ? ceiling : BigInt(available))
  return BigInt(points) * n >= d ? points : 0
}

import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'esbuild'
import { createRequire, Module } from 'node:module'
import { fileURLToPath } from 'node:url'
import { auditLog, bookings, customers, inquiries, trips, tripDeposits, bookingStages } from '../src/db/schema.ts'
import { buildTripStages, slotsConsumed } from '../src/lib/trip-display.ts'
import { actionForm, withLocalTripActions } from './support/local-payment-db.mjs'


test('public sold-out trip offers interest registration and records consent without creating another booking', async () => {
  await withLocalTripActions(async ({ actor: id, tx, registerInterest }) => {
    const [trip] = await tx.insert(trips).values({
      id, slug: id, titleEn: 'Test reef', titleZh: '测试礁石', status: 'open', published: true, currency: 'MYR', depositType: 'fixed',
      priceAmount: '100.00', depositValue: '25.00', balanceDueDate: '2099-03-01', departureTimezone: 'Asia/Kuala_Lumpur',
      travelStart: new Date('2099-04-01T00:00:00Z'), travelEnd: new Date('2099-04-05T00:00:00Z'), capacity: 1,
    }).returning()
    const deposits = await tx.insert(tripDeposits).values({ id: id + '-D1', tripId: id, sort: 0, amount: '25', dueDate: '2099-01-01', dueDays: 90 }).returning()
    const stages = buildTripStages(trip, deposits)
    await tx.insert(customers).values({ id, name: id, email: id + '@example.com' })
    await tx.insert(bookings).values({ id, customerId: id, productId: id, status: 'awaiting_deposit', currency: 'MYR', originalPriceAmount: trip.priceAmount, departureTimezone: trip.departureTimezone, declarations: {} })
    await tx.insert(bookingStages).values(stages.map(s => ({ id: id + '-' + s.position, bookingId: id,
      position: s.position, kind: s.kind, amount: (s.amountMinor / 100).toFixed(2), dueDate: s.dueDate })))
    const readBookings = () => tx.select({ status: bookings.status }).from(bookings).where(eq(bookings.productId, id))
    const rows = await readBookings()
    // Next binds server actions to forms. Render the real client component with an
    // inert action URL, then call that action separately against the same local trip.
    const { outputFiles } = await build({ entryPoints: ['src/components/trip-detail.tsx'], bundle: true,
      platform: 'node', format: 'cjs', write: false, jsx: 'automatic', external: ['react', 'react/jsx-runtime', 'next/link'],
      plugins: [{ name: 'interest-form', setup(builder) {
        builder.onResolve({ filter: /^@\/lib\/seamless-actions$/ }, () => ({ path: 'interest', namespace: 'test' }))
        builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const registerInterest = "/test-interest"' }))
      } }],
    })
    const compiled = new Module(fileURLToPath(import.meta.url))
    compiled.require = createRequire(import.meta.url)
    compiled._compile(outputFiles[0].text, compiled.id)
    const TripDetail = compiled.exports.default
    const data = { ...trip, currency: 'MYR', bookable: true, consumed: slotsConsumed(rows.map(row => row.status)),
      stages,
      today: '2098-12-01', interestState: null,
    }
    const render = interestState => renderToStaticMarkup(React.createElement(TripDetail, { trip: { ...data, interestState } }))
    const full = render(null)
    expect(full).toContain('Register interest')
    expect(full).toContain('action="/test-interest"')
    expect(full).not.toContain('href="/book/' + id + '"')
    const markedFull = renderToStaticMarkup(React.createElement(TripDetail, { trip: { ...data, status: 'full', consumed: 0 } }))
    expect(markedFull).toContain('action="/test-interest"')
    expect(markedFull).not.toContain('href="/book/' + id + '"')

    const request = { tripId: id, name: 'Sample diver', email: id + '-waitlist@example.com', locale: 'en' }
    await expect(registerInterest(actionForm(request))).rejects.toMatchObject({ path: '/trips/' + id + '?interest=error' })
    const interests = () => tx.select().from(inquiries).where(eq(inquiries.tripId, id))
    expect(await interests()).toEqual([])
    await expect(registerInterest(actionForm({ ...request, consent: 'on' }))).rejects.toMatchObject({ path: '/trips/' + id + '?interest=registered' })
    expect(await interests()).toEqual([expect.objectContaining({ name: request.name, email: request.email, interest: 'trip',
      interestDetail: 'waitlist', locale: 'en', consentAt: expect.any(Date) })])
    expect(render('registered')).toContain('Interest registered')
    expect(await readBookings()).toEqual(rows)
    expect(await tx.select().from(auditLog).where(eq(auditLog.entityId, id))).toEqual([expect.objectContaining({ action: 'interest_registered' })])
  })
})

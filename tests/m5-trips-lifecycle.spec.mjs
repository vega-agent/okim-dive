import { expect, test } from '@playwright/test'
import { eq } from 'drizzle-orm'
import { trips, bookings, bookingStages, customers, settings, auditLog } from '../src/db/schema.ts'
import { actionForm, withLocalTripActions } from './support/local-payment-db.mjs'

test('trip settings freeze the rate at creation, require bilingual content and protect launched slugs and capacity', async () => {
  await withLocalTripActions(async ({ actor, tx, tripActions: actions }) => {
    const rate = value => actions.updateSettings(actionForm({ key: 'default_rm_rate', rmRate: value }))
    const create = async title => {
      await expect(actions.createTrip(actionForm({ titleEn: title }))).rejects.toMatchObject({ path: expect.stringMatching(/^\/portal\/trips\/TRP-/) })
      const [trip] = await tx.select().from(trips).where(eq(trips.titleEn, title))
      return trip
    }
    await rate('3.25')
    const first = await create(actor)
    await rate('4.05')
    const second = await create(actor + '-next')
    expect([first.rmRate, second.rmRate]).toEqual(['3.2500', '4.0500'])
    const readTrip = async () => (await tx.select().from(trips).where(eq(trips.id, first.id)))[0]
    const facts = { tripId: first.id, titleEn: actor, titleZh: '合成测试行程', locationKey: 'malaysia',
      currency: 'SGD', priceAmount: '500', depositAmount: ['50', '100'], depositDueDate: ['2099-01-01', '2099-02-01'],
      balanceDueDate: '2099-03-01', travelStart: '2099-04-01', travelEnd: '2099-04-05', capacity: 2, minParticipants: 1,
    }
    await actions.updateTripSettings(actionForm(facts))
    const content = { tripId: first.id, summary: 'Test reef', highlights: ['Reef'], itinerary: ['Day one'], included: ['Guide'] }
    await actions.updateTripContent(actionForm({ ...content, locale: 'en' }))
    const launch = state => actions.setLaunchState(actionForm({ tripId: first.id, state }))
    await expect(launch('open')).rejects.toThrow(/Publish blocked/)
    await actions.updateTripContent(actionForm({ tripId: first.id, locale: 'zh', summary: '礁石', highlights: ['礁石'], itinerary: ['第一天'], included: ['向导'] }))
    await launch('open')
    expect(await readTrip()).toMatchObject({ published: true, status: 'open', rmRate: '3.2500', costDisplayEn: 'SGD 500.00', costDisplayZh: 'SGD 500.00' })
    await actions.updateTripSettings(actionForm({ ...facts, titleEn: actor + '-renamed', priceAmount: '450' }))
    const updated = await readTrip()
    expect(updated.slug).toBe(first.slug)
    expect([updated.costDisplayEn, updated.costDisplayZh]).toEqual(['SGD 450.00', 'SGD 450.00'])
    expect([updated.balanceTextEn, updated.balanceTextZh].every(value => value.includes('300.00') && value.includes('2099-03-01'))).toBe(true)
    for (const index of [1, 2]) {
      const id = actor + '-' + index
      await tx.insert(customers).values({ id, name: id, email: id + '@example.com' })
      await tx.insert(bookings).values({ id, customerId: id, productId: first.id, status: 'awaiting_deposit', currency: 'SGD', originalPriceAmount: '450', departureTimezone: updated.departureTimezone, declarations: {} })
      await tx.insert(bookingStages).values([
        { id: id + '-1', bookingId: id, position: 1, kind: 'deposit', amount: '50', dueDate: '2099-01-01' },
        { id: id + '-2', bookingId: id, position: 2, kind: 'deposit', amount: '100', dueDate: '2099-02-01' },
        { id: id + '-3', bookingId: id, position: 3, kind: 'final', amount: '300', dueDate: '2099-03-01' },
      ])
    }
    await expect(actions.updateTripSettings(actionForm({ ...facts, capacity: 1 }))).rejects.toThrow(/Capacity cannot drop below 2/)
    await expect(launch('draft')).rejects.toThrow(/bookings/)
    await expect(actions.deleteDraft(actionForm({ tripId: first.id }))).rejects.toThrow(/without bookings/)
    await launch('closed')
    expect(await readTrip()).toMatchObject({ capacity: 2, slug: first.slug, published: false, status: 'open' })

    await actions.updateSettings(actionForm({ key: 'points_rules', earnRate: 1, redeemValue: 0.05, expiryMonths: 12, capPct: 15 }))
    await actions.updateSettings(actionForm({ key: 'payment_instructions', instructionsEn: 'Test transfer', instructionsZh: '测试转账' }))
    await actions.updateSettings(actionForm({ key: 'instructor_emails', emails: 'SAMPLE@example.com, sample@example.com' }))
    const config = new Map((await tx.select().from(settings)).map(row => [row.key, row.value]))
    expect(config.get('points_rules')).toMatchObject({ capPct: 15 })
    expect(config.get('payment_instructions')).toEqual({ en: 'Test transfer', zh: '测试转账', sample: true })
    expect(config.get('instructor_emails')).toEqual({ emails: ['sample@example.com'] })
    const audits = await tx.select().from(auditLog).where(eq(auditLog.actorUserId, actor))
    expect(audits.filter(row => row.action === 'settings_updated').map(row => row.meta.key).sort()).toEqual([
      'default_rm_rate', 'default_rm_rate', 'instructor_emails', 'payment_instructions', 'points_rules',
    ])
  })
})

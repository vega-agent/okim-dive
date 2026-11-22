'use server'
import { auth } from '@/auth'
import { transactionDb } from '@/db'
import { auditLog, bookings, customers, trips } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { activeUpcoming, equipmentEditable, parseEquipment } from './diver-equipment'

export async function saveDiverProfile(form: FormData): Promise<string> {
  const session = await auth()
  if (!session?.user?.customerId || !transactionDb) return 'unauthenticated'
  const name = String(form.get('name') ?? '').trim()
  const phone = String(form.get('phone') ?? '').trim()
  const locale = form.get('locale')
  const agency = String(form.get('agency') ?? '').trim()
  const level = String(form.get('level') ?? '').trim()
  const dives = Number(form.get('dives'))
  let equipment
  try { equipment = parseEquipment(JSON.parse(String(form.get('equipment')))) } catch { return 'invalid' }
  if (name.length < 2 || name.length > 200 || phone.length > 40 || !['en','zh'].includes(String(locale)) || !agency || agency.length > 100 || !level || level.length > 100 || !Number.isInteger(dives) || dives < 0 || dives > 10000 || !equipment) return 'invalid'
  try {
    const result = await transactionDb.transaction(async tx => {
      const [old] = await tx.select().from(customers).where(and(eq(customers.id,session.user.customerId!),eq(customers.userId,session.user.id!),isNull(customers.mergedInto))).for('update')
      if (!old) return 'unauthenticated'
      const profile = { agency,level,dives,equipment,agencyOther:String(form.get('agency_other') ?? '').trim().slice(0,100),levelOther:String(form.get('level_other') ?? '').trim().slice(0,100) }
      const previous = old.diverProfile ?? {}
      const changed = previous.agency !== agency || previous.level !== level || previous.dives !== dives
      await tx.update(customers).set({ name,phone,locale:locale as 'en'|'zh',diverProfile:profile }).where(eq(customers.id,old.id))
      const affected = await tx.select({ booking:bookings,trip:trips }).from(bookings).innerJoin(trips,eq(bookings.productId,trips.id)).where(and(eq(bookings.customerId,old.id),eq(bookings.productType,'trip'))).for('update')
      for (const { booking,trip } of affected) {
        if (!activeUpcoming(booking.status,trip.status,trip.travelStart)) continue
        if (changed) {
          // Owner 2026-11-22: no eligibility reset — declarations are self-declared
          // under the truthfulness disclaimer; sync the data, notify Iris (info only).
          await tx.update(bookings).set({ declarations:{ ...booking.declarations,certAgency:agency,certLevel:level,loggedDives:dives } }).where(eq(bookings.id,booking.id))
          await tx.insert(auditLog).values({ id:randomUUID(),actorUserId:session.user.id,action:'diver_declarations_changed',entity:'booking',entityId:booking.id,meta:{ old:{ certAgency:booking.declarations.certAgency,certLevel:booking.declarations.certLevel,loggedDives:booking.declarations.loggedDives },new:{ agency,level,dives },notifyIris:true } })
        }
        if (JSON.stringify(previous.equipment) !== JSON.stringify(equipment)) await tx.insert(auditLog).values({ id:randomUUID(),actorUserId:session.user.id,action:'diver_equipment_profile_changed',entity:'booking',entityId:booking.id,meta:{ old:previous.equipment ?? null,new:equipment,notifyIris:true,bookingSnapshotUnchanged:true } })
      }
      await tx.insert(auditLog).values({ id:randomUUID(),actorUserId:session.user.id,action:'diver_profile_saved',entity:'customer',entityId:old.id,meta:{ old:{ name:old.name,phone:old.phone,locale:old.locale,profile:previous },new:{ name,phone,locale,profile } } })
      return 'saved'
    })
    revalidatePath('/myokim'); revalidatePath('/portal'); return result
  } catch { return 'error' }
}

export async function saveBookingEquipment(bookingId:string,raw:unknown):Promise<string> {
  const session = await auth()
  if (!session?.user?.customerId || !transactionDb) return 'unauthenticated'
  const equipment = parseEquipment(raw)
  if (!equipment) return 'invalid'
  try {
    const result = await transactionDb.transaction(async tx => {
      const [owner] = await tx.select().from(customers).where(and(eq(customers.id,session.user.customerId!),eq(customers.userId,session.user.id!),isNull(customers.mergedInto)))
      if (!owner) return 'unauthenticated'
      const [row] = await tx.select({ booking:bookings,trip:trips }).from(bookings).innerJoin(trips,eq(bookings.productId,trips.id)).where(and(eq(bookings.id,bookingId),eq(bookings.customerId,owner.id),eq(bookings.productType,'trip'))).for('update')
      if (!row) return 'unauthenticated'
      if (!equipmentEditable(row.booking.status,row.trip.status,row.trip.travelStart)) return 'cutoff'
      await tx.update(bookings).set({ equipment:equipment as unknown as Record<string,unknown> }).where(eq(bookings.id,bookingId))
      await tx.insert(auditLog).values({ id:randomUUID(),actorUserId:session.user.id,action:'booking_equipment_saved',entity:'booking',entityId:bookingId,meta:{ old:row.booking.equipment,new:equipment,notifyIris:true } })
      return 'saved'
    })
    revalidatePath('/myokim'); revalidatePath('/portal'); return result
  } catch { return 'error' }
}

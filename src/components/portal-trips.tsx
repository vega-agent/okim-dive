'use client'

// Portal v2 (PORTAL-REDESIGN-V2-PLAN V3): the Trips tab is the trip workspace.
// One card per trip — the whole story on the face (dates, slots, confirmed,
// completion, messages published + seen), next-action buttons pre-filled, and
// a folded manifest with per-booking Info / Equipment / Complete / Withdraw
// (dialogs owned by portal-view). Replaces the v1 trips table; the composer
// page itself is owned by the trip-messages chat and only LINKED here.
import { useState, type ReactNode } from 'react'
import { useLocale } from '@/lib/use-locale'
import { createTrip, duplicateTrip, cancelTrip } from '@/lib/trip-actions'
import { completeTrip } from '@/lib/seamless-actions'
import { bookingRevisionList } from '@/lib/payment-schedule'
import { tripDisplayState } from '@/lib/trip-display'
import FinancialActionForm from './financial-action-form'
import PortalDialog from '@/components/portal-dialog'
import IconAction, { icons } from '@/components/icon-action'

export type PortalTrip = {
  id: string
  slug: string
  status: string
  published: boolean
  sample: boolean
  titleEn: string
  titleZh: string
  travelStart: string | null
  travelEnd: string | null
  capacity: number
  consumed: number
  bookingCount: number
  confirmedCount: number
  completedCount: number
  messagesPublished: number
  messagesSeen: number
  messagesSeenTotal: number
}

export type PortalBookingRow = {
  id: string
  productId: string
  status: string
  eligibilityStatus: string
  customerName: string
  tripTitle: { en: string; zh: string } | null
  sample: boolean
  currency: string
  depositAmount: string | null
  pendingChange?:unknown
  summary?: {revision: number; outstandingMinor:number; netReceivedMinor:number}|null
  equipment: unknown
}

export default function PortalTrips({ trips, manifest, renderBooking }: {
  trips: PortalTrip[]
  manifest: PortalBookingRow[]
  renderBooking: (b: PortalBookingRow) => ReactNode
}) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [saving, setSaving] = useState(false)
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [closing, setClosing] = useState<PortalTrip | null>(null)
  const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'
  const badge = (text: string, tone: string) => <span className={`status-badge tone-${tone}`}>{text}</span>
  const now = Date.now()
  const ended = (trip: PortalTrip) => !!trip.travelEnd && new Date(trip.travelEnd).getTime() <= now
  const upcoming = trips.filter(tr => !ended(tr)).sort((a, b) => (a.travelStart ?? '9999').localeCompare(b.travelStart ?? '9999'))
  const past = trips.filter(ended).sort((a, b) => (b.travelEnd ?? '').localeCompare(a.travelEnd ?? ''))

  const cancelling = manifest.filter(b => b.productId === cancelId && ['awaiting_deposit','payment_claimed','deposit_verified','confirmed'].includes(b.status))
  const refunds = new Map<string, number>()
  for (const b of cancelling) refunds.set(b.currency, (refunds.get(b.currency) ?? 0) + (b.summary?.netReceivedMinor ?? 0))

  const tripCard = (trip: PortalTrip) => {
    const state = tripDisplayState(trip, trip.consumed, trip.capacity)
    const completable = ended(trip) && trip.bookingCount > 0 && !['draft','cancelled','completed'].includes(trip.status)
    const rows = manifest.filter(b => b.productId === trip.id)
    const unresolved = rows.some(b => ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed'].includes(b.status) &&
      (b.summary?.outstandingMinor !== 0 || b.pendingChange))
    return <article key={trip.id} className="portal-trip-card" id={`trip-${trip.id}`}>
      <div className="portal-trip-head">
        <h3>{locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn}</h3>
        {badge(t(state.en, state.zh), state.tone)}
        {trip.sample && badge(t('Sample', '示例'), 'neutral')}
      </div>
      <p className="portal-trip-facts">{date(trip.travelStart)} – {date(trip.travelEnd)} · {t('Slots', '名额')} {trip.consumed}/{trip.capacity} · {trip.bookingCount} {t('bookings', '预订')}</p>
      {trip.bookingCount > 0 && <p className="portal-trip-facts">{trip.confirmedCount} {t('confirmed', '已确认')} · {trip.completedCount}/{trip.bookingCount} {t('completed', '已完成')}</p>}
      <p className="portal-trip-facts">
        {trip.messagesPublished > 0
          ? <>{t('Messages', '消息')}: {trip.messagesPublished} {t('published', '已发布')}{trip.messagesSeenTotal > 0 ? ` · ${t('seen', '已读')} ${trip.messagesSeen}/${trip.messagesSeenTotal}` : ''}</>
          : t('No messages published yet', '尚未发布消息')}
      </p>
      <div className="portal-trip-actions">
        <a className="btn btn-secondary" href={`/portal/trips/${trip.id}/messages`}>{t('Messages', '消息')}</a>
        <a className="btn btn-secondary" href={`/portal/trips/${trip.id}`}>{t('Edit', '编辑')}</a>
        <form action={duplicateTrip}>
          <input type="hidden" name="tripId" value={trip.id} />
          <button className="btn btn-secondary">{t('Duplicate', '复制')}</button>
        </form>
        {completable && <button type="button" className="btn btn-primary" disabled={unresolved} onClick={() => setClosing(trip)}>{t('Close trip', '结束行程')}</button>}
        {trip.status !== 'cancelled' && <IconAction danger tip={t('Cancel trip', '取消行程')} onClick={() => setCancelId(trip.id)}>{icons.cancel}</IconAction>}
      </div>
      {completable && unresolved && <p className="portal-hint">{t('Settle outstanding payments and confirm date changes before closing this trip.', '请先结清待付款项并确认改期选择，然后结束行程。')}</p>}
      {rows.length > 0 && <details className="portal-trip-manifest">
        <summary>{t('Manifest & equipment', '名单与装备')} ({rows.length})<span className="portal-fold-chevron" aria-hidden="true" /></summary>
        <div className="portal-trip-rows">{rows.map(b => renderBooking(b))}</div>
      </details>}
    </article>
  }

  return <section id="trips" className="portal-trips">
    <div className="portal-trips-top">
      <p className="portal-hint">{t('Active bookings reserve a place until cancelled.', '有效预订将保留名额，直至取消。')}</p>
      <form action={createTrip}>
        <button className="btn btn-primary">{t('New trip', '新建行程')}</button>
      </form>
    </div>
    {trips.length === 0 && <div className="portal-empty"><h3>{t('No trips yet', '暂无行程')}</h3><p>{t('Create your first trip to get started.', '创建第一个行程即可开始。')}</p></div>}
    {upcoming.map(tripCard)}
    {past.length > 0 && <details className="portal-fold portal-past-trips">
      <summary className="portal-fold-head">
        <h2>{t('Past trips', '已结束行程')}</h2>
        <span className="portal-fold-count">{past.length}</span>
        <span className="portal-fold-chevron" aria-hidden="true" />
      </summary>
      <div className="portal-fold-body">{past.map(tripCard)}</div>
    </details>}
    <PortalDialog open={closing !== null} pending={saving} title={t('Close trip', '结束行程')} closeLabel={t('Close', '关闭')} onClose={() => setClosing(null)}>
      {closing && <FinancialActionForm action={completeTrip} close={() => setClosing(null)} locale={locale} onPending={setSaving} confirm={t('Close trip', '结束行程')}>
        <input type="hidden" name="tripId" value={closing.id} />
        <p className="portal-dialog-context span-2">{locale === 'zh' ? closing.titleZh || closing.titleEn : closing.titleEn}</p>
        <p className="portal-hint span-2">{t('Attendance and points are recorded separately when you complete each diver’s booking.', '请在每位潜水员的预订中分别确认出席并发放积分。')}</p>
      </FinancialActionForm>}
    </PortalDialog>
    <PortalDialog open={cancelId !== null} pending={saving} title={t('Cancel trip', '取消行程')} closeLabel={t('Close', '关闭')} onClose={() => setCancelId(null)}>
      <FinancialActionForm action={cancelTrip} locale={locale} close={() => setCancelId(null)} onPending={setSaving} danger confirm={t('Cancel this trip', '取消此行程')}>
        <input type="hidden" name="tripId" value={cancelId ?? ''} />
        <input type="hidden" name="expectedBookings" value={bookingRevisionList(cancelling.map(b => ({ id: b.id, revision: b.summary!.revision })))} />
        <p className="portal-hint">{t('All active bookings will be cancelled. Each diver is owed their net paid amount. Record the bank refunds under Refunds to record.', '所有有效预订将被取消，每位潜水员应获退还净付款。在「待记录退款」中登记银行退款。')}</p>
        <p className="span-2">{t('Affected bookings', '受影响的预订')} {cancelling.length} · {t('Refund due', '应退款')} {refunds.size ? Array.from(refunds, ([currency, amount]) => currency + ' ' + (amount / 100).toFixed(2)).join(' · ') : t('None', '无')}</p>
        <label className="span-2">{t('Cancellation reason (shown to divers)', '取消原因（向潜水员展示）')}
          <input name="reason" required maxLength={500} placeholder={t('e.g. insufficient participants / weather advisory', '例如：人数不足／天气预警')} />
        </label>
        <label className="portal-consent"><input type="checkbox" name="confirm" required />{t('I confirm cancellation of all active bookings.', '我确认取消所有有效预订。')}</label>
      </FinancialActionForm>
    </PortalDialog>
  </section>
}
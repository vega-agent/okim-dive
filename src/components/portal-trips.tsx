'use client'
import { useLocale } from '@/lib/use-locale'
import { duplicateTrip } from '@/lib/trip-actions'
import { tripDisplayState } from '@/lib/trip-display'
import CardHelp from '@/components/portal-card-help'

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
}

export default function PortalTrips({ trips }: { trips: PortalTrip[] }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const date = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'
  const badge = (text: string, tone: string) => <span className={`status-badge tone-${tone}`}>{text}</span>

  return <section id="trips" className="portal-card">
    <div className="portal-card-head">
      <h2>{t('Trips', '行程管理')}</h2>
      <CardHelp id="trips-help" label={t('Help: trips', '帮助：行程管理')}>
        <p>{t('Create, edit, publish and cancel trips. Each trip has a Settings page (facts) and a Content page (one language at a time).', '创建、编辑、发布和取消行程。每个行程有设置页（事实信息）和内容页（每次编辑一种语言）。')}</p>
        <ol>
          <li>{t('New trip starts as a draft. Fill Settings, then English and Chinese content — publishing is blocked until both languages are complete.', '新行程从草稿开始。先填设置，再填英文和中文内容——两种语言都完整后才能发布。')}</li>
          <li>{t('Open for booking enables the book button; Inquiries only shows the contact form; Closed hides the trip but keeps existing bookings serviceable.', '开放预订会启用预订按钮；仅接受咨询显示联系表单；关闭会隐藏行程，但已有预订仍可处理。')}</li>
          <li>{t('Cancelling flags paid bookings for full refund and emails every affected diver. Record each external refund in Financial ops — points reverse there.', '取消会将已付款预订标记为全额退款，并邮件通知每位受影响潜水员。请在财务操作中记录每笔外部退款——积分在该处冲正。')}</li>
          <li>{t('Duplicate copies a trip into a new draft — useful for next season.', '复制会将行程复制为新草稿——适合下一季复用。')}</li>
        </ol>
      </CardHelp>
    </div>
    <p className="portal-hint">{t('Slots shown follow the 14-day hold rule: awaiting deposit, recorded, verified and confirmed bookings all consume capacity.', '名额按 14 天保留规则计算：待付订金、已记录、已核实和已确认的预订均占用名额。')}</p>
    <a className="btn btn-primary portal-new-trip" href="/portal/trips/new">{t('New trip', '新建行程')}</a>
    {trips.length === 0 ? <div className="portal-empty"><h3>{t('No trips yet', '暂无行程')}</h3><p>{t('Create your first trip to get started.', '创建第一个行程即可开始。')}</p></div> : <table className="portal-table portal-trips-table">
      <thead><tr>
        <th>{t('Trip', '行程')}</th>
        <th>{t('Status', '状态')}</th>
        <th>{t('Dates', '日期')}</th>
        <th>{t('Slots', '名额')}</th>
        <th>{t('Actions', '操作')}</th>
      </tr></thead>
      <tbody>{trips.map(trip => {
        const state = tripDisplayState(trip, trip.consumed, trip.capacity)
        return <tr key={trip.id}>
          <td data-label={t('Trip', '行程')}>
            <strong>{locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn}</strong>
            {trip.sample && badge(t('Sample', '示例'), 'neutral')}
            <span className="portal-row-sub">{trip.slug}</span>
          </td>
          <td data-label={t('Status', '状态')}>{badge(t(state.en, state.zh), state.tone)}</td>
          <td data-label={t('Dates', '日期')}>{date(trip.travelStart)} – {date(trip.travelEnd)}</td>
          <td data-label={t('Slots', '名额')}>{trip.consumed} / {trip.capacity}{trip.bookingCount > trip.consumed ? ` · ${trip.bookingCount} ${t('bookings', '预订')}` : ''}</td>
          <td data-label={t('Actions', '操作')}>
            <div className="portal-trip-actions">
              <a className="btn btn-secondary" href={`/portal/trips/${trip.id}`}>{t('Edit', '编辑')}</a>
              <form action={duplicateTrip}>
                <input type="hidden" name="tripId" value={trip.id} />
                <button className="btn btn-secondary">{t('Duplicate', '复制')}</button>
              </form>
            </div>
          </td>
        </tr>
      })}</tbody>
    </table>}
  </section>
}
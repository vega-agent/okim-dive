'use client'

// M6 i18n fix (owner: "Chinese text is leaking over again"): the diver-updates
// section was server-rendered with hardcoded "EN / 中文" literals. It now lives
// in a client component on the portal's locale hook — one language at a time.
// Portal display hardening (2026-11-21): the card used to render every audit
// row raw (UUID entity ids, ISO timestamps, one equipment row per booking).
// Now: newest 5 + "show all", readable times, diver/trip names, sample badges.
import type { ReactNode } from 'react'
import { useLocale } from '@/lib/use-locale'
import EquipmentSummary from '@/components/equipment-summary'

type Context = { customerName: string; tripTitle: { en: string; zh: string } | null; sample: boolean }
type Alert = { id: string; entityId: string; action: string; actorName: string; at: string; context: Context | null; old: unknown; new: unknown }
type BookingRow = { id: string; equipment: unknown; customerName: string; tripTitle: { en: string; zh: string } | null; sample: boolean }

const labels: Record<string, [string, string]> = {
  diver_eligibility_review_required: ['Eligibility needs review', '资格需重新审核'],
  diver_declarations_changed: ['Certification or dive count updated', '认证或潜水次数已更新'],
  diver_equipment_profile_changed: ['Equipment ownership/preferences changed; booking unchanged', '装备资料已变更，预订快照未变'],
  booking_equipment_saved: ['Booking equipment changed', '预订装备已变更'],
}

const CAP = 5

export default function DiverUpdates({ alerts, bookings }: { alerts: Alert[]; bookings: BookingRow[] }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const when = (iso: string) => new Date(iso).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const tripName = (c: Context | null) => c?.tripTitle ? t(c.tripTitle.en, c.tripTitle.zh) : null
  const sampleBadge = (sample: boolean) => sample ? <span className="status-badge tone-neutral">{t('Sample', '示例')}</span> : null

  const alertRow = (a: Alert) => {
    const name = a.context?.customerName || a.actorName || t('Diver', '潜水员')
    const trip = tripName(a.context)
    const ref = a.entityId.startsWith('BKG-') ? a.entityId : null
    return <details key={a.id}>
      <summary>
        {ref && <><strong>{ref}</strong> · </>}
        {!ref && !a.context && <>{a.entityId} · </>}
        {name}{trip ? ` · ${trip}` : ''} · {labels[a.action] ? t(labels[a.action][0], labels[a.action][1]) : a.action} · {when(a.at)} {sampleBadge(a.context?.sample ?? false)}
      </summary>
      {a.action === 'diver_eligibility_review_required'
        ? <p>{t('Certification and logged dives changed; eligibility pending Iris review.', '认证与累计潜水次数已变更，等待 Iris 审核。')}</p>
        : a.action === 'diver_declarations_changed'
          ? <p>{t('Certification or dive count updated; upcoming booking declarations refreshed. Self-declared under the truthfulness disclaimer.', '认证或潜水次数已更新；即将出行的预订申报资料已同步。资料按真实性声明由潜水员自行申报。')}</p>
          : <>
            <h4>{t('Before', '变更前')}</h4>
            <EquipmentSummary value={a.old} />
            <h4>{t('After', '变更后')}</h4>
            <EquipmentSummary value={a.new} />
          </>}
    </details>
  }

  const bookingRow = (b: BookingRow) => <details key={b.id}>
    <summary>{b.id.startsWith('BKG-') && <><strong>{b.id}</strong> · </>}{b.customerName}{b.tripTitle ? ` · ${t(b.tripTitle.en, b.tripTitle.zh)}` : ''} {sampleBadge(b.sample)}</summary>
    <EquipmentSummary value={b.equipment} />
  </details>

  const more = (total: number, label: string, rows: ReactNode) => total > CAP
    ? <details><summary>{label}</summary>{rows}</details>
    : null

  // Default view shows real diver activity only; sample/test rows stay
  // reachable but folded away (owner rule: actionable items first, and the
  // shared DB retains labelled test fixtures — they must not flood the top).
  const real = alerts.filter(a => a.context && !a.context.sample)
  const sample = alerts.filter(a => a.context?.sample)
  const archived = alerts.filter(a => !a.context)
  const realBookings = bookings.filter(b => !b.sample)
  const sampleBookings = bookings.filter(b => b.sample)

  return <section className="portal-card">
    <h2>{t('Diver updates', '潜水员更新')}</h2>
    <p className="portal-hint">{t('Newest first · durable change history', '最新在前 · 持久变更记录')}</p>
    {real.length === 0 && sample.length === 0 && archived.length === 0 && <p className="portal-hint">{t('No diver updates yet. Profile and equipment changes appear here.', '暂无潜水员更新。资料与装备变更将显示在此处。')}</p>}
    {real.slice(0, CAP).map(alertRow)}
    {more(real.length, t(`Show all ${real.length} updates`, `显示全部 ${real.length} 条更新`), real.slice(CAP).map(alertRow))}
    {sample.length > 0 && <details>
      <summary>{t(`Sample updates (${sample.length})`, `示例更新（${sample.length}）`)}</summary>
      {sample.map(alertRow)}
    </details>}
    {archived.length > 0 && <details>
      <summary>{t(`Archived updates (${archived.length})`, `归档更新（${archived.length}）`)}</summary>
      {archived.map(alertRow)}
    </details>}
    {realBookings.length > 0 && <>
      <h3 className="portal-subhead">{t('Equipment planning', '装备计划')}</h3>
      {realBookings.slice(0, CAP).map(bookingRow)}
      {more(realBookings.length, t(`Show all ${realBookings.length} bookings`, `显示全部 ${realBookings.length} 个预订`), realBookings.slice(CAP).map(bookingRow))}
    </>}
    {sampleBookings.length > 0 && <details>
      <summary>{t(`Sample equipment planning (${sampleBookings.length})`, `示例装备计划（${sampleBookings.length}）`)}</summary>
      {sampleBookings.map(bookingRow)}
    </details>}
  </section>
}
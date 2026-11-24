'use client'

// M6 i18n fix (owner: "Chinese text is leaking over again"): the diver-updates
// section was server-rendered with hardcoded "EN / 中文" literals. It now lives
// in a client component on the portal's locale hook — one language at a time.
// Portal display hardening (2026-11-21): newest 5 + "show all", readable times,
// diver/trip names, sample badges.
// Portal v2 (2026-11-22, PORTAL-REDESIGN-V2-PLAN V3/V10): alerts-only history,
// rendered inside the Trips tab's collapsed "Diver updates" fold — the card
// chrome comes from the fold. Equipment planning moved to the trip cards.
import type { ReactNode } from 'react'
import { useLocale } from '@/lib/use-locale'
import EquipmentSummary from '@/components/equipment-summary'

type Context = { customerName: string; tripTitle: { en: string; zh: string } | null; sample: boolean }
type Alert = { id: string; entityId: string; action: string; actorName: string; at: string; context: Context | null; old: unknown; new: unknown }

const labels: Record<string, [string, string]> = {
  booking_acknowledgment: ['Booking email failed','预订邮件发送失败'],
  booking_acknowledgment_not_attempted: ['Booking email has no recorded attempt','尚无预订邮件发送记录'],
  booking_acknowledgment_unconfirmed: ['Booking email status unconfirmed','预订邮件发送情况尚未确认'],
  diver_eligibility_review_required: ['Eligibility needs review', '资格需重新审核'],
  diver_declarations_changed: ['Certification or dive count updated', '认证或潜水次数已更新'],
  diver_equipment_profile_changed: ['Equipment ownership/preferences changed; booking unchanged', '装备资料已变更，预订快照未变'],
  booking_equipment_saved: ['Booking equipment changed', '预订装备已变更'],
}

const CAP = 5

export default function DiverUpdates({ alerts }: { alerts: Alert[] }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const when = (iso: string) => new Date(iso).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const tripName = (c: Context | null) => c?.tripTitle ? t(c.tripTitle.en, c.tripTitle.zh) : null
  const sampleBadge = (sample: boolean) => sample ? <span className="status-badge tone-neutral">{t('Sample', '示例')}</span> : null

  const alertRow = (a: Alert) => {
    const name = a.context?.customerName || a.actorName || t('Diver', '潜水员')
    const trip = tripName(a.context)
    const ref = a.entityId.startsWith('BKG-') ? a.entityId : null
    return <details key={a.id} className="portal-update-row">
      <summary>
        {ref && <><strong>{ref}</strong> · </>}
        {!ref && !a.context && <>{a.entityId} · </>}
        {name}{trip ? ` · ${trip}` : ''} · {labels[a.action] ? t(labels[a.action][0], labels[a.action][1]) : a.action} · {when(a.at)} {sampleBadge(a.context?.sample ?? false)}
      </summary>
      {a.action.startsWith('booking_acknowledgment')
        ? <p>{t('The booking is saved. Contact the diver directly if they need their payment schedule.', '预订已保存。如潜水员需要付款安排，请直接联系对方。')}</p>
        : a.action === 'diver_eligibility_review_required'
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

  const more = (total: number, label: string, rows: ReactNode) => total > CAP
    ? <details className="portal-update-more"><summary>{label}</summary>{rows}</details>
    : null

  // Default view shows real diver activity only; sample/test rows stay
  // reachable but folded away (owner rule: actionable items first, and the
  // shared DB retains labelled test fixtures — they must not flood the top).
  const real = alerts.filter(a => a.context && !a.context.sample)
  const sample = alerts.filter(a => a.context?.sample)
  const archived = alerts.filter(a => !a.context)

  return <div className="portal-updates">
    <p className="portal-hint">{t('Newest first · durable change history · equipment planning now lives on each trip card', '最新在前 · 持久变更记录 · 装备计划已移至各行程卡片')}</p>
    {real.length === 0 && sample.length === 0 && archived.length === 0 && <p className="portal-hint">{t('No diver updates yet. Profile and equipment changes appear here.', '暂无潜水员更新。资料与装备变更将显示在此处。')}</p>}
    {real.slice(0, CAP).map(alertRow)}
    {more(real.length, t(`Show all ${real.length} updates`, `显示全部 ${real.length} 条更新`), real.slice(CAP).map(alertRow))}
    {sample.length > 0 && <details className="portal-update-more">
      <summary>{t(`Sample updates (${sample.length})`, `示例更新（${sample.length}）`)}</summary>
      {sample.map(alertRow)}
    </details>}
    {archived.length > 0 && <details className="portal-update-more">
      <summary>{t(`Archived updates (${archived.length})`, `归档更新（${archived.length}）`)}</summary>
      {archived.map(alertRow)}
    </details>}
  </div>
}
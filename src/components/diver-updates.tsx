'use client'

// M6 i18n fix (owner: "Chinese text is leaking over again"): the diver-updates
// section was server-rendered with hardcoded "EN / 中文" literals. It now lives
// in a client component on the portal's locale hook — one language at a time.
import { useLocale } from '@/lib/use-locale'
import EquipmentSummary from '@/components/equipment-summary'

type Alert = { id: string; entityId: string; action: string; actorName: string; at: string; old: unknown; new: unknown }

const labels: Record<string, [string, string]> = {
  diver_eligibility_review_required: ['Eligibility needs review', '资格需重新审核'],
  diver_equipment_profile_changed: ['Equipment ownership/preferences changed; booking unchanged', '装备资料已变更，预订快照未变'],
  booking_equipment_saved: ['Booking equipment changed', '预订装备已变更'],
}

export default function DiverUpdates({ alerts, bookings }: { alerts: Alert[]; bookings: { id: string; equipment: unknown }[] }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  return <section className="portal-card">
    <h2>{t('Diver updates', '潜水员更新')}</h2>
    <p className="portal-hint">{t('Newest first · durable change history', '最新在前 · 持久变更记录')}</p>
    {alerts.map(a => <details key={a.id}>
      <summary>{a.entityId} · {labels[a.action] ? t(labels[a.action][0], labels[a.action][1]) : a.action} · {a.actorName || t('Diver', '潜水员')} · {a.at}</summary>
      {a.action === 'diver_eligibility_review_required'
        ? <p>{t('Certification and logged dives changed; eligibility pending Iris review.', '认证与累计潜水次数已变更，等待 Iris 审核。')}</p>
        : <>
          <h4>{t('Before', '变更前')}</h4>
          <EquipmentSummary value={a.old} />
          <h4>{t('After', '变更后')}</h4>
          <EquipmentSummary value={a.new} />
        </>}
    </details>)}
    {bookings.map(b => <details key={b.id}>
      <summary>{b.id} · {t('Equipment planning', '装备计划')}</summary>
      <EquipmentSummary value={b.equipment} />
    </details>)}
  </section>
}
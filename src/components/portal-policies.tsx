'use client'
import { useLocale } from '@/lib/use-locale'
import CardHelp from '@/components/portal-card-help'

export type PortalPolicy = { kind: string; version: number; effectiveAt: string; createdBy: string | null }

const KIND_LABELS: Record<string, { en: string; zh: string }> = {
  refund: { en: 'Refund policy', zh: '退款政策' },
  privacy: { en: 'Privacy policy', zh: '隐私政策' },
  terms: { en: 'Terms of booking', zh: '预订条款' },
}

export default function PortalPolicies({ policies }: { policies: PortalPolicy[] }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

  return <section id="policies" className="portal-card">
    <div className="portal-card-head">
      <h2>{t('Policies', '政策版本')}</h2>
      <CardHelp id="policies-help" label={t('Help: policies', '帮助：政策版本')}>
        <p>{t('Refund, privacy and terms are versioned. Every edit publishes a NEW version in both languages at once.', '退款、隐私与条款均有版本。每次编辑都会同时以两种语言发布新版本。')}</p>
        <ol>
          <li>{t('Existing bookings keep the exact version the diver accepted — new versions apply to new bookings only.', '已有预订保留潜水员接受时的版本——新版本仅适用于新预订。')}</li>
          <li>{t('Versions are immutable: corrections are published as the next version, never edited in place.', '版本不可更改：更正以新版本发布，绝不就地修改。')}</li>
          <li>{t('Version 1 wording is demo-approved; publish the final wording once Iris confirms it.', '第 1 版文案为演示批准版；Iris 确认最终文案后请发布新版本。')}</li>
        </ol>
      </CardHelp>
    </div>
    <ul className="portal-list">
      {['refund', 'privacy', 'terms'].map(kind => {
        const current = policies.filter(p => p.kind === kind).sort((a, b) => b.version - a.version)[0]
        const label = KIND_LABELS[kind]
        return <li key={kind} className="portal-row">
          <div className="portal-row-main">
            <strong>{t(label.en, label.zh)}</strong>
            {current ? <span className="status-badge tone-ok">v{current.version}</span> : <span className="status-badge tone-bad">{t('Missing', '缺失')}</span>}
            <span className="portal-row-sub">{current ? `${t('Effective', '生效')} ${date(current.effectiveAt)} · ${current.createdBy ?? '—'}` : t('No version seeded', '未初始化版本')}</span>
          </div>
          <a className="btn btn-secondary" href={`/portal/policies/${kind}`}>{t('Edit', '编辑')}</a>
        </li>
      })}
    </ul>
  </section>
}
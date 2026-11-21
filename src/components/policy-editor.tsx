'use client'
import { useState } from 'react'
import { useLocale } from '@/lib/use-locale'
import { publishPolicyVersion } from '@/lib/policy-actions'
import type { PolicyKind } from '@/lib/policy-kinds'
import CardHelp from '@/components/portal-card-help'

export type PolicyVersion = { id: string; version: number; bodyEn: string; bodyZh: string; effectiveAt: string; createdBy: string | null }

const KIND_LABELS: Record<PolicyKind, { en: string; zh: string }> = {
  refund: { en: 'Refund policy', zh: '退款政策' },
  privacy: { en: 'Privacy policy', zh: '隐私政策' },
  terms: { en: 'Terms of booking', zh: '预订条款' },
}

export default function PolicyEditor({ kind, versions, published }: { kind: PolicyKind; versions: PolicyVersion[]; published: number | null }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [notice, setNotice] = useState<string | null>(null)
  const current = versions[0]
  const label = KIND_LABELS[kind]
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

  // Both textareas stay mounted (inactive one hidden) so switching language
  // never loses edits, and one submit publishes BOTH languages together (§11).
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    if (!String(fd.get('bodyEn') ?? '').trim() || !String(fd.get('bodyZh') ?? '').trim()) {
      e.preventDefault()
      setNotice(t('Both English and Chinese text are required before publishing.', '发布前英文与中文内容均须填写。'))
    }
  }

  return <main className="ocean-journey portal trip-editor" data-locale-managed><div className="container">
    <header className="trip-editor-head">
      <div className="trip-editor-title">
        <h1>{t(label.en, label.zh)}</h1>
        {current && <span className="status-badge tone-ok">v{current.version}</span>}
      </div>
      <nav className="portal-nav trip-editor-nav" aria-label={t('Policy editor sections', '政策编辑栏目')}>
        <a href="/portal#policies">{t('← Portal', '← 返回工作台')}</a>
      </nav>
    </header>

    {published !== null && <p className="portal-success" role="status">
      {t(`Version ${published} published — live for new bookings. Existing bookings keep the version they accepted.`,
        `第 ${published} 版已发布——对新预订生效。已有预订保留其接受的版本。`)}
    </p>}

    <section className="portal-card">
      <div className="portal-card-head">
        <h2>{t('Edit wording', '编辑文案')}</h2>
        <CardHelp id="policy-edit-help" label={t('Help: policy editing', '帮助：政策编辑')}>
          <p>{t('One language at a time — never mixed. Publishing creates a new immutable version with BOTH languages.', '每次只编辑一种语言——绝不混排。发布会以两种语言创建新的不可变版本。')}</p>
          <ol>
            <li>{t('Edit the English text, switch to 中文, edit the Chinese text, then publish once.', '先编辑英文，切换到中文编辑中文文案，然后一次发布。')}</li>
            <li>{t('Divers accept a specific version at booking; it is stored with their booking forever.', '潜水员在预订时接受特定版本；该版本随预订永久保存。')}</li>
            <li>{t('Version 1 is demo-approved wording — publish the final version once Iris confirms it.', '第 1 版为演示批准文案——Iris 确认后请发布最终版本。')}</li>
          </ol>
        </CardHelp>
      </div>
      <div className="kind-pills content-lang-card" role="group" aria-label={t('Editing language', '编辑语言')}>
        {(['en', 'zh'] as const).map(l => <button key={l} type="button" className={`kind-pill content-lang-pill${lang === l ? ' active' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
          <span>{l === 'en' ? 'English' : '中文'}</span>
        </button>)}
      </div>
      <form action={publishPolicyVersion} onSubmit={onSubmit} key={current?.version ?? 0} className="booking-form portal-form policy-form">
        <input type="hidden" name="kind" value={kind} />
        <div className="form-group span-2" hidden={lang !== 'en'}>
          <label htmlFor="policy-body-en">{t('Policy text (English)', '政策文案（英文）')} *</label>
          <textarea id="policy-body-en" name="bodyEn" rows={14} maxLength={50000} defaultValue={current?.bodyEn ?? ''} placeholder={t('Full policy wording in English…', '完整英文政策文案…')} />
        </div>
        <div className="form-group span-2" hidden={lang !== 'zh'}>
          <label htmlFor="policy-body-zh">{t('Policy text (Chinese)', '政策文案（中文）')} *</label>
          <textarea id="policy-body-zh" name="bodyZh" rows={14} maxLength={50000} defaultValue={current?.bodyZh ?? ''} placeholder={t('完整中文政策文案…', '完整中文政策文案…')} />
        </div>
        {notice && <p className="form-status form-status-error span-2" role="alert">{notice}</p>}
        <div className="portal-field span-2">
          <span className="portal-field-label" id="policy-confirm-label">{t('Confirmation', '确认')}</span>
          <div className="kind-pills" role="group" aria-labelledby="policy-confirm-label">
            <label className="kind-pill"><input type="checkbox" name="confirm" required /><span>{t('I confirm this wording is final in both languages', '我确认两种语言的文案均为最终版本')}</span></label>
          </div>
        </div>
        <button className="btn btn-primary span-2">{t(`Publish as version ${(current?.version ?? 0) + 1}`, `发布为第 ${(current?.version ?? 0) + 1} 版`)}</button>
      </form>
    </section>

    <section className="portal-card">
      <h2>{t('Version history (immutable)', '版本历史（不可更改）')}</h2>
      <p className="portal-hint">{t('Read-only. Corrections are published as the next version — existing versions are never edited or deleted.', '只读。更正以新版本发布——已有版本绝不修改或删除。')}</p>
      <ul className="portal-list policy-history">
        {versions.map(v => <li key={v.id}>
          <details>
            <summary>v{v.version} · {date(v.effectiveAt)} · {v.createdBy ?? '—'}{v.version === current?.version ? ` · ${t('current', '当前')}` : ''}</summary>
            <div className="policy-history-body">{lang === 'zh' ? v.bodyZh : v.bodyEn}</div>
          </details>
        </li>)}
      </ul>
    </section>
  </div></main>
}
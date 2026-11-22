'use client'
import { useState } from 'react'
import { useLocale, pick } from '@/lib/use-locale'
import { publishMessage, editMessage, deleteMessage } from '@/lib/message-actions'
import CardHelp from '@/components/portal-card-help'

export type TripMessage = {
  id: string
  label: string
  subjectEn: string
  subjectZh: string
  bodyEn: string
  bodyZh: string
  audience: string
  publishedAt: string
  updatedAt: string
}

/**
 * Trip messages composer + outbox (TRIP-MESSAGES-SPEC): Subject + Label + Body,
 * EN|CN switch (both mounted, one visible), manual publish only, on-platform
 * delivery. Publish = approval; edits/deletes audited server-side.
 */
export default function TripMessages({ tripId, messages, seen, published, edited }: {
  tripId: string
  messages: TripMessage[]
  seen: Record<string, { seen: number; total: number }>
  published: boolean
  edited: boolean
}) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [lang, setLang] = useState<'en' | 'zh'>('en')
  const [editing, setEditing] = useState<TripMessage | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  const labels = Array.from(new Set(messages.map(m => m.label)))
  const visible = filter ? messages.filter(m => m.label === filter) : messages
  const audienceLabel = (a: string) => a === 'all_active' ? t('All active bookings', '所有有效预订') : t('Confirmed divers', '已确认潜水员')

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const fd = new FormData(e.currentTarget)
    const missing = ['subjectEn', 'subjectZh', 'bodyEn', 'bodyZh'].some(k => !String(fd.get(k) ?? '').trim())
    if (missing) {
      e.preventDefault()
      setNotice(t('Subject and body are required in both languages before publishing.', '发布前英文与中文的标题和正文均须填写。'))
    }
  }

  return <div className="trip-messages">
    {(published || edited) && <p className="portal-success" role="status">
      {published ? t('Message published — divers see it in My Okim now.', '消息已发布——潜水员现在可在「我的 Okim」中看到。') : t('Message updated — divers see the new version.', '消息已更新——潜水员将看到新版本。')}
    </p>}

    <section className="portal-card">
      <div className="portal-card-head">
        <h2>{editing ? t('Edit message', '编辑消息') : t('New message', '新消息')}</h2>
        <CardHelp id="messages-help" label={t('Help: trip messages', '帮助：行程消息')}>
          <p>{t('Messages appear in divers\' My Okim feed for this trip — no emails are sent. As departure approaches, release briefings, bring-lists and updates.', '消息会显示在本行程潜水员的「我的 Okim」信息流中——不发送电子邮件。临近出发时，陆续发布简报、物品清单和更新。')}</p>
          <ol>
            <li>{t('Write both languages (EN | 中文 switch), add a label for sorting, choose the audience, then Publish. Publishing is your approval — nothing sends automatically.', '填写两种语言（EN | 中文 切换），加上便于分类的标签，选择接收对象，然后发布。发布即代表你的批准——不会自动发送。')}</li>
            <li>{t('Confirmed divers = deposit verified or confirmed. All active bookings also includes divers still paying their deposit.', '已确认潜水员＝订金已核实或已确认。所有有效预订还包括仍在支付订金的潜水员。')}</li>
            <li>{t('Divers who book later still see earlier messages matching their status. Seen counts tell you who has read each message.', '之后预订的潜水员仍能看到与其状态匹配的早前消息。已读计数告诉你谁读过每条消息。')}</li>
          </ol>
        </CardHelp>
      </div>
      <form action={editing ? editMessage : publishMessage} onSubmit={onSubmit} key={editing?.id ?? 'new'} className="booking-form portal-form policy-form">
        <input type="hidden" name="tripId" value={tripId} />
        {editing && <input type="hidden" name="messageId" value={editing.id} />}
        <label>{t('Label (for sorting)', '标签（用于分类）')}
          <input name="label" required maxLength={40} defaultValue={editing?.label ?? ''} placeholder={t('e.g. Briefing, Checklist, Weather', '例如：简报、物品清单、天气')} />
        </label>
        <div className="portal-field">
          <span className="portal-field-label" id="msg-audience-label">{t('Audience', '接收对象')}</span>
          <div className="kind-pills" role="radiogroup" aria-labelledby="msg-audience-label">
            {[['confirmed', 'Confirmed divers', '已确认潜水员'], ['all_active', 'All active bookings', '所有有效预订']].map(([value, en, zh]) =>
              <label key={value} className="kind-pill"><input type="radio" name="audience" value={value} defaultChecked={(editing?.audience ?? 'confirmed') === value} /><span>{t(en, zh)}</span></label>)}
          </div>
        </div>
        <div className="kind-pills span-2" role="group" aria-label={t('Editing language', '编辑语言')}>
          {(['en', 'zh'] as const).map(l => <button key={l} type="button" className={`kind-pill content-lang-pill${lang === l ? ' active' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
            <span>{l === 'en' ? 'English' : '中文'}</span>
          </button>)}
        </div>
        <div className="form-group span-2" hidden={lang !== 'en'}>
          <label htmlFor="msg-subject-en">{t('Subject (English)', '标题（英文）')} *</label>
          <input id="msg-subject-en" name="subjectEn" maxLength={200} defaultValue={editing?.subjectEn ?? ''} placeholder={t('e.g. Meeting point and boat schedule', '例如：集合地点与船期')} />
          <label htmlFor="msg-body-en">{t('Body (English)', '正文（英文）')} *</label>
          <textarea id="msg-body-en" name="bodyEn" rows={8} maxLength={20000} defaultValue={editing?.bodyEn ?? ''} placeholder={t('Everything divers need to know…', '潜水员需要知道的一切…')} />
        </div>
        <div className="form-group span-2" hidden={lang !== 'zh'}>
          <label htmlFor="msg-subject-zh">{t('Subject (Chinese)', '标题（中文）')} *</label>
          <input id="msg-subject-zh" name="subjectZh" maxLength={200} defaultValue={editing?.subjectZh ?? ''} placeholder={t('例如：集合地点与船期', '例如：集合地点与船期')} />
          <label htmlFor="msg-body-zh">{t('Body (Chinese)', '正文（中文）')} *</label>
          <textarea id="msg-body-zh" name="bodyZh" rows={8} maxLength={20000} defaultValue={editing?.bodyZh ?? ''} placeholder={t('潜水员需要知道的一切…', '潜水员需要知道的一切…')} />
        </div>
        {notice && <p className="form-status form-status-error span-2" role="alert">{notice}</p>}
        <div className="trip-editor-actions span-2">
          <button className="btn btn-primary">{editing ? t('Save changes', '保存更改') : t('Publish to divers', '发布给潜水员')}</button>
          {editing && <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>{t('Cancel edit', '取消编辑')}</button>}
        </div>
      </form>
    </section>

    <section className="portal-card">
      <h2>{t('Outbox', '已发布消息')}</h2>
      <p className="portal-hint">{t('Newest first. Seen counts are against current confirmed divers. Edits and deletes are audit-logged.', '按时间倒序。已读计数以当前已确认潜水员为准。编辑与删除均记录审计。')}</p>
      {labels.length > 0 && <div className="kind-pills msg-filter" role="group" aria-label={t('Filter by label', '按标签筛选')}>
        <button type="button" className={`kind-pill content-lang-pill${filter === null ? ' active' : ''}`} aria-pressed={filter === null} onClick={() => setFilter(null)}><span>{t('All', '全部')}</span></button>
        {labels.map(l => <button key={l} type="button" className={`kind-pill content-lang-pill${filter === l ? ' active' : ''}`} aria-pressed={filter === l} onClick={() => setFilter(l)}><span>{l}</span></button>)}
      </div>}
      {visible.length === 0 ? <div className="portal-empty"><h3>{t('No messages yet', '暂无消息')}</h3><p>{t('Publish the first briefing as the trip approaches.', '临近行程时发布第一条简报。')}</p></div> : <ul className="portal-list msg-outbox">
        {visible.map(m => {
          const s = seen[m.id] ?? { seen: 0, total: 0 }
          return <li key={m.id} className="portal-row msg-row">
            <div className="portal-row-main">
              <strong>{pick(locale, m.subjectEn, m.subjectZh)}</strong>
              <span className="status-badge tone-neutral">{m.label}</span>
              <span className="portal-row-sub">{audienceLabel(m.audience)} · {date(m.publishedAt)} · {t(`Seen by ${s.seen} of ${s.total}`, `${s.total} 人中 ${s.seen} 人已读`)}{m.updatedAt !== m.publishedAt ? ` · ${t('edited', '已编辑')}` : ''}</span>
            </div>
            <div className="portal-trip-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setEditing(m); setNotice(null); window.scrollTo({ top: 0 }) }}>{t('Edit', '编辑')}</button>
              {confirmDelete === m.id ? <>
                <form action={deleteMessage}>
                  <input type="hidden" name="messageId" value={m.id} />
                  <button className="btn btn-primary">{t('Confirm delete', '确认删除')}</button>
                </form>
                <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>{t('Keep', '保留')}</button>
              </> : <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(m.id)}>{t('Delete', '删除')}</button>}
            </div>
          </li>
        })}
      </ul>}
    </section>
  </div>
}
'use client'
import { useRef, useState } from 'react'
import { useLocale } from '@/lib/use-locale'
import { updateTripContent } from '@/lib/trip-actions'
import { DERIVED_FIELDS, DIFFICULTY_OPTIONS, contentCompleteness, deriveDisplay, publishBlockers, type DerivedDisplay, type Locale, type SerializedTrip } from '@/lib/trip-display'
import TripEditorNav from '@/components/trip-editor-nav'
import CardHelp from '@/components/portal-card-help'
import ListEditor from '@/components/list-editor'
import TranslateButton from '@/components/translate-button'
import IconAction, { icons } from '@/components/icon-action'

const FIELD_LABELS: Record<keyof DerivedDisplay, { en: string; zh: string }> = {
  travelDates: { en: 'Travel dates', zh: '行程日期' },
  duration: { en: 'Duration', zh: '时长' },
  costDisplay: { en: 'Cost display', zh: '价格展示' },
  costBasis: { en: 'Cost basis', zh: '价格说明' },
  depositText: { en: 'Deposit line', zh: '订金文案' },
  balanceText: { en: 'Balance line', zh: '尾款文案' },
  groupSize: { en: 'Group size', zh: '团队规模' },
}

function DerivedField({ field, derived }: { field: keyof DerivedDisplay; derived: string }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  return <div className="derived-field">
    <span className="portal-field-label">{t(FIELD_LABELS[field].en, FIELD_LABELS[field].zh)}</span>
    <p className="derived-preview">{derived || t('Set the facts in Settings first', '请先在设置页填写事实信息')}</p>
  </div>
}

export default function TripContentEditor({ trip, consumed, deposits }: { trip: SerializedTrip; consumed: number; deposits: { amount: string; dueDate: string | null }[] }) {
  const uiLocale = useLocale()
  const t = (en: string, zh: string) => uiLocale === 'zh' ? zh : en
  const [lang, setLang] = useState<Locale>('en')
  const formRef = useRef<HTMLFormElement>(null)
  const suffix = lang === 'zh' ? 'Zh' : 'En'
  const otherSuffix = lang === 'zh' ? 'En' : 'Zh'
  const otherVal = (field: string): string => ((trip as unknown as Record<string, unknown>)[`${field}${otherSuffix}`] as string | null) ?? ''
  const otherList = (field: string): string[] => ((trip as unknown as Record<string, unknown>)[`${field}${otherSuffix}`] as string[] | null) ?? []
  const fillText = (field: string, v: string) => {
    if (!v) return
    const el = formRef.current?.elements.namedItem(field) as HTMLInputElement | HTMLTextAreaElement | null
    if (el) el.value = v
  }
  const otherLang: Locale = lang === 'zh' ? 'en' : 'zh'
  // Per-row translate (#47): the icon sits in the row, right of × / +, and
  // pulls the matching line from the other language instead of the whole list.
  const rowTranslate = (field: string) => ({ from: otherLang, to: lang, textFor: (i: number) => otherList(field)[i] ?? '' })
  const cancelled = trip.status === 'cancelled'
  const derived = deriveDisplay(trip, lang, deposits)
  const completeness = contentCompleteness(trip, lang)
  const val = (field: string): string => ((trip as unknown as Record<string, unknown>)[`${field}${suffix}`] as string | null) ?? ''
  const listVal = (field: string): string[] => ((trip as unknown as Record<string, unknown>)[`${field}${suffix}`] as string[] | null) ?? []
  const difficultyCurrent = DIFFICULTY_OPTIONS.find(o => o[lang] === val('difficulty'))?.value ?? ''
  const blockers = publishBlockers(trip, deposits)
  const cflag = (field: string) => {
    const hits = blockers.filter(b => b.fields?.includes(`content:${field}:${lang}`))
    return { cls: hits.length ? ' field-blocked' : '', tip: hits.length ? hits.map(b => t(b.en, b.zh)).join(' · ') : undefined }
  }
  const fSummary = cflag('summary')

  return <main className="ocean-journey portal trip-editor" data-locale-managed><div className="container">
    <TripEditorNav trip={trip} active="content" consumed={consumed} actions={cancelled ? undefined :
      <IconAction type="submit" form="trip-content-form" tip={t('Save content', '保存内容')}>{icons.save}</IconAction>} />

    <div className="portal-card content-lang-card">
      <div className="portal-card-head">
        <h2>{t('Editing language', '编辑语言')}</h2>
        <CardHelp id="content-help" label={t('Help: content editing', '帮助：内容编辑')}>
          <p>{t('One language at a time — never mixed. Publishing requires both languages complete.', '每次只编辑一种语言——绝不混排。发布要求两种语言均完整。')}</p>
          <p>{t('Display lines (dates, price, deposit…) are auto-written from Settings in both languages.', '展示文案（日期、价格、订金等）由设置页自动生成两种语言。')}</p>
        </CardHelp>
      </div>
      <div className="kind-pills" role="group" aria-label={t('Editing language', '编辑语言')}>
        {(['en', 'zh'] as const).map(l => <button key={l} type="button" className={`kind-pill content-lang-pill${lang === l ? ' active' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
          <span>{l === 'en' ? 'English' : '中文'}</span>
        </button>)}
      </div>
      {completeness.missingRequired.length > 0 && <p className="portal-hint">{t('Required fields still empty in this language — publishing stays blocked until both languages are complete.', '此语言仍有必填项为空——两种语言都完整后才能发布。')}</p>}
    </div>

    <form id="trip-content-form" action={updateTripContent} ref={formRef} key={`${lang}-${trip.updatedAt}`} className="trip-editor-form">
      <input type="hidden" name="tripId" value={trip.id} />
      <input type="hidden" name="locale" value={lang} />
      <fieldset disabled={cancelled} className="trip-editor-fieldset">

        <section className="portal-card">
          <h2>{lang === 'zh' ? '行程内容（中文）' : 'Trip content (English)'}</h2>
          <p className="portal-hint">{t('Trip name', '行程名称')}: <strong>{lang === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn}</strong> · {t('edit the name in Settings', '名称请在设置页编辑')}</p>
          <div className="booking-form portal-form">
            <div className={`translate-field ta span-2${fSummary.cls}`} data-tip={fSummary.tip}>
              <label htmlFor="content-summary"><span>{t('Summary', '简介')}{fSummary.tip && <span className="blocker-dot" aria-hidden="true" />}</span></label>
              <textarea id="content-summary" name="summary" rows={3} defaultValue={val('summary')} maxLength={4000} placeholder={t('Two or three warm sentences about the trip…', '用两三句温暖的话介绍行程…')} />
              <TranslateButton from={otherLang} to={lang} getTexts={() => [otherVal('summary')]} onResults={([v]) => fillText('summary', v)} />
            </div>
            <ListEditor name="highlights" label={t('Highlights', '亮点')} items={listVal('highlights')} placeholder={t('One highlight per line', '每行一个亮点')} addLabel={t('Add highlight', '添加亮点')} removeLabel={t('Remove highlight', '删除亮点')} translate={rowTranslate('highlights')} flagTip={cflag('highlights').tip} />
            <ListEditor name="itinerary" label={t('Itinerary', '行程安排')} items={listVal('itinerary')} placeholder={t('Day 1: …', '第 1 天：…')} addLabel={t('Add day', '添加一天')} removeLabel={t('Remove day', '删除当天')} translate={rowTranslate('itinerary')} flagTip={cflag('itinerary').tip} />
            <ListEditor name="included" label={t('Included', '费用包含')} items={listVal('included')} placeholder={t('One included item per line', '每行一个包含项目')} addLabel={t('Add item', '添加项目')} removeLabel={t('Remove item', '删除项目')} translate={rowTranslate('included')} flagTip={cflag('included').tip} />
            <ListEditor name="additionalCosts" label={t('Additional costs', '额外费用')} items={listVal('additionalCosts')} placeholder={t('One cost per line', '每行一项费用')} addLabel={t('Add cost', '添加费用')} removeLabel={t('Remove cost', '删除费用')} translate={rowTranslate('additionalCosts')} />
            <div className="translate-field ta span-2">
              <label htmlFor="content-notes">{t('Notes', '备注')}</label>
              <textarea id="content-notes" name="notes" rows={2} defaultValue={val('notes')} maxLength={4000} placeholder={t('Anything divers should know…', '潜水员需要知道的其他事项…')} />
              <TranslateButton from={otherLang} to={lang} getTexts={() => [otherVal('notes')]} onResults={([v]) => fillText('notes', v)} />
            </div>
            <div className="translate-field ta span-2">
              <label htmlFor="content-requirements">{t('Requirements text', '要求说明')}</label>
              <textarea id="content-requirements" name="requirementsText" rows={2} defaultValue={val('requirementsText')} maxLength={2000} placeholder={t('Certification and experience expectations…', '证书与经验要求…')} />
              <TranslateButton from={otherLang} to={lang} getTexts={() => [otherVal('requirementsText')]} onResults={([v]) => fillText('requirementsText', v)} />
            </div>
            <div className="translate-field">
              <label htmlFor="content-inquiry">{t('Inquiry button label', '咨询按钮文案')}</label>
              <input id="content-inquiry" name="inquiryLabel" defaultValue={val('inquiryLabel')} maxLength={100} placeholder={t('Ask about this trip', '咨询此行程')} />
              <TranslateButton from={otherLang} to={lang} getTexts={() => [otherVal('inquiryLabel')]} onResults={([v]) => fillText('inquiryLabel', v)} />
            </div>
            <div className="portal-field">
              <span className="portal-field-label" id="difficulty-label">{t('Difficulty', '难度')}</span>
              <div className="kind-pills" role="radiogroup" aria-labelledby="difficulty-label">
                {DIFFICULTY_OPTIONS.map(o => <label key={o.value} className="kind-pill"><input type="radio" name="difficulty" value={o.value} defaultChecked={difficultyCurrent === o.value} /><span>{o[lang]}</span></label>)}
              </div>
            </div>
          </div>
        </section>

        <section className="portal-card">
          <div className="portal-card-head">
            <h2>{t('Display lines (auto from Settings)', '展示文案（由设置自动生成）')}</h2>
            <CardHelp id="derived-help" label={t('Help: display lines', '帮助：展示文案')}>
              <p>{t('Read-only preview of what divers see, written from the trip facts in both languages. To change a line, edit the facts in Settings — there is no custom wording here, so the two languages can never disagree.', '只读预览潜水员所见内容，由行程事实自动生成两种语言。如需修改，请到设置页编辑事实——此处无自定义文案，两种语言绝不会不一致。')}</p>
            </CardHelp>
          </div>
          <div className="derived-grid">
            {DERIVED_FIELDS.map(field => <DerivedField key={`${lang}-${field}`} field={field} derived={derived[field]} />)}
          </div>
        </section>
      </fieldset>
    </form>
  </div></main>
}
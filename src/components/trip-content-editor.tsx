'use client'
import { useState } from 'react'
import { useLocale } from '@/lib/use-locale'
import { updateTripContent } from '@/lib/trip-actions'
import { DERIVED_FIELDS, DIFFICULTY_OPTIONS, contentCompleteness, deriveDisplay, type DerivedDisplay, type Locale, type SerializedTrip } from '@/lib/trip-display'
import TripEditorNav from '@/components/trip-editor-nav'
import CardHelp from '@/components/portal-card-help'
import ListEditor from '@/components/list-editor'

const DEMO: Record<Locale, {
  title: string; location: string; summary: string
  highlights: string[]; itinerary: string[]; included: string[]; additionalCosts: string[]
  notes: string; requirementsText: string; inquiryLabel: string; difficulty: string
}> = {
  en: {
    title: 'Tioman Reef Weekend (demo)',
    location: 'Tioman Island, Malaysia',
    summary: 'A relaxed two-day reef escape: gentle currents, healthy coral gardens, and plenty of surface time between dives. Demo content — replace with the real trip before publishing.',
    highlights: ['Three guided reef dives', 'Small groups, patient pacing', 'Beachfront stay steps from the jetty'],
    itinerary: ['Day 1: Arrival, check-in, two afternoon reef dives', 'Day 2: Morning dive, free afternoon, sunset beach walk', 'Day 3: Breakfast and ferry home'],
    included: ['2 nights accommodation', '3 guided dives with tanks and weights', 'Breakfast and lunch on dive days'],
    additionalCosts: ['Ferry tickets', 'Marine park fee', 'Dinner and personal expenses'],
    notes: 'Demo trip — facts and wording are illustrative until Iris confirms them.',
    requirementsText: 'Open Water certified or above; comfortable in mild current.',
    inquiryLabel: 'Ask about this trip',
    difficulty: 'intermediate',
  },
  zh: {
    title: '刁曼岛珊瑚礁周末（演示）',
    location: '马来西亚刁曼岛',
    summary: '轻松的两日珊瑚礁之旅：水流平缓、珊瑚花园生机盎然，潜水之间有充足的休息时间。演示内容——发布前请替换为真实行程。',
    highlights: ['三次导潜珊瑚礁潜水', '小团出行，节奏从容', '海滩住宿，步行即达码头'],
    itinerary: ['第 1 天：抵达、入住，下午两次珊瑚礁潜水', '第 2 天：上午潜水，下午自由活动，傍晚海滩漫步', '第 3 天：早餐后乘船返程'],
    included: ['两晚住宿', '三次导潜（含气瓶与配重）', '潜水日早餐与午餐'],
    additionalCosts: ['船票', '海洋公园费', '晚餐及个人消费'],
    notes: '演示行程——在 Iris 确认前，事实与文案均为示例。',
    requirementsText: '须持开放水域潜水员或以上证书；能适应平缓水流。',
    inquiryLabel: '咨询此行程',
    difficulty: 'intermediate',
  },
}

const FIELD_LABELS: Record<keyof DerivedDisplay, { en: string; zh: string }> = {
  travelDates: { en: 'Travel dates', zh: '行程日期' },
  duration: { en: 'Duration', zh: '时长' },
  costDisplay: { en: 'Cost display', zh: '价格展示' },
  costBasis: { en: 'Cost basis', zh: '价格说明' },
  depositText: { en: 'Deposit line', zh: '订金文案' },
  balanceText: { en: 'Balance line', zh: '尾款文案' },
  groupSize: { en: 'Group size', zh: '团队规模' },
}

function DerivedField({ field, derived, current, disabled }: { field: keyof DerivedDisplay; derived: string; current: string; disabled: boolean }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const [overrideOn, setOverrideOn] = useState(Boolean(current && current !== derived))
  const [value, setValue] = useState(overrideOn ? current : '')
  return <div className="derived-field">
    <div className="derived-field-head">
      <span className="portal-field-label">{t(FIELD_LABELS[field].en, FIELD_LABELS[field].zh)}</span>
      <label className="derived-override-toggle"><input type="checkbox" name={`useOverride_${field}`} checked={overrideOn} disabled={disabled}
        onChange={e => { setOverrideOn(e.target.checked); if (!e.target.checked) setValue('') }} />{t('Override', '自定义')}</label>
    </div>
    {overrideOn
      ? <input name={`${field}Override`} value={value} onChange={e => setValue(e.target.value)} maxLength={500} disabled={disabled} placeholder={t('Custom wording…', '自定义文案…')} />
      : <p className="derived-preview">{derived || t('Set the facts in Settings first', '请先在设置页填写事实信息')}</p>}
  </div>
}

export default function TripContentEditor({ trip, consumed }: { trip: SerializedTrip; consumed: number }) {
  const uiLocale = useLocale()
  const t = (en: string, zh: string) => uiLocale === 'zh' ? zh : en
  const [lang, setLang] = useState<Locale>('en')
  const [demo, setDemo] = useState(false)
  const suffix = lang === 'zh' ? 'Zh' : 'En'
  const cancelled = trip.status === 'cancelled'
  const derived = deriveDisplay(trip, lang)
  const completeness = contentCompleteness(trip, lang)
  const source = demo ? DEMO[lang] : null
  const val = (field: string): string => source ? (source as unknown as Record<string, string>)[field] ?? '' : ((trip as unknown as Record<string, unknown>)[`${field}${suffix}`] as string | null) ?? ''
  const listVal = (field: string): string[] => source ? (source as unknown as Record<string, string[]>)[field] : ((trip as unknown as Record<string, unknown>)[`${field}${suffix}`] as string[] | null) ?? []
  const currentDisplay = (field: keyof DerivedDisplay): string => ((trip as unknown as Record<string, unknown>)[`${field}${suffix}`] as string | null) ?? ''
  const difficultyCurrent = demo ? DEMO[lang].difficulty : (DIFFICULTY_OPTIONS.find(o => o[lang] === val('difficulty'))?.value ?? '')

  return <main className="ocean-journey portal trip-editor" data-locale-managed><div className="container">
    <TripEditorNav trip={trip} active="content" consumed={consumed} />

    <div className="portal-card content-lang-card">
      <div className="portal-card-head">
        <h2>{t('Editing language', '编辑语言')}</h2>
        <CardHelp id="content-help" label={t('Help: content editing', '帮助：内容编辑')}>
          <p>{t('One language at a time — never mixed. Publishing requires both languages complete.', '每次只编辑一种语言——绝不混排。发布要求两种语言均完整。')}</p>
          <ol>
            <li>{t('Display lines (dates, price, deposit…) are auto-written from Settings in both languages. Use Override only for custom wording.', '展示文案（日期、价格、订金等）由设置页自动生成两种语言。仅需自定义措辞时使用“自定义”。')}</li>
            <li>{t('“Fill with example” inserts demo content and labels the trip Sample — never publish demo content as a real offer.', '“填入示例”会插入演示内容并将行程标注为示例——切勿将演示内容作为真实产品发布。')}</li>
          </ol>
        </CardHelp>
      </div>
      <div className="kind-pills" role="group" aria-label={t('Editing language', '编辑语言')}>
        {(['en', 'zh'] as const).map(l => <button key={l} type="button" className={`kind-pill content-lang-pill${lang === l ? ' active' : ''}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
          <span>{l === 'en' ? 'English' : '中文'}</span>
        </button>)}
      </div>
      {completeness.missingRequired.length > 0 && <p className="portal-hint">{t('Required fields still empty in this language — publishing stays blocked until both languages are complete.', '此语言仍有必填项为空——两种语言都完整后才能发布。')}</p>}
    </div>

    <form action={updateTripContent} key={`${lang}-${trip.updatedAt}-${demo}`} className="trip-editor-form">
      <input type="hidden" name="tripId" value={trip.id} />
      <input type="hidden" name="locale" value={lang} />
      <input type="hidden" name="demoFill" value={demo ? '1' : '0'} />
      <fieldset disabled={cancelled} className="trip-editor-fieldset">

        <section className="portal-card">
          <h2>{lang === 'zh' ? '行程内容（中文）' : 'Trip content (English)'}</h2>
          <div className="booking-form portal-form">
            <label className="span-2">{t('Title', '标题')}<input name="title" defaultValue={val('title')} maxLength={200} placeholder={t('e.g. Tioman Reef Weekend', '例如：刁曼岛珊瑚礁周末')} /></label>
            <label className="span-2">{t('Location', '地点')}<input name="location" defaultValue={val('location')} maxLength={200} placeholder={t('e.g. Tioman Island, Malaysia', '例如：马来西亚刁曼岛')} /></label>
            <label className="span-2">{t('Summary', '简介')}<textarea name="summary" rows={3} defaultValue={val('summary')} maxLength={4000} placeholder={t('Two or three warm sentences about the trip…', '用两三句温暖的话介绍行程…')} /></label>
            <ListEditor name="highlights" label={t('Highlights', '亮点')} items={listVal('highlights')} placeholder={t('One highlight per line', '每行一个亮点')} addLabel={t('Add highlight', '添加亮点')} removeLabel={t('Remove highlight', '删除亮点')} />
            <ListEditor name="itinerary" label={t('Itinerary', '行程安排')} items={listVal('itinerary')} placeholder={t('Day 1: …', '第 1 天：…')} addLabel={t('Add day', '添加一天')} removeLabel={t('Remove day', '删除当天')} />
            <ListEditor name="included" label={t('Included', '费用包含')} items={listVal('included')} placeholder={t('One included item per line', '每行一个包含项目')} addLabel={t('Add item', '添加项目')} removeLabel={t('Remove item', '删除项目')} />
            <ListEditor name="additionalCosts" label={t('Additional costs', '额外费用')} items={listVal('additionalCosts')} placeholder={t('One cost per line', '每行一项费用')} addLabel={t('Add cost', '添加费用')} removeLabel={t('Remove cost', '删除费用')} />
            <label className="span-2">{t('Notes', '备注')}<textarea name="notes" rows={2} defaultValue={val('notes')} maxLength={4000} placeholder={t('Anything divers should know…', '潜水员需要知道的其他事项…')} /></label>
            <label className="span-2">{t('Requirements text', '要求说明')}<textarea name="requirementsText" rows={2} defaultValue={val('requirementsText')} maxLength={2000} placeholder={t('Certification and experience expectations…', '证书与经验要求…')} /></label>
            <label>{t('Inquiry button label', '咨询按钮文案')}<input name="inquiryLabel" defaultValue={val('inquiryLabel')} maxLength={100} placeholder={t('Ask about this trip', '咨询此行程')} /></label>
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
              <p>{t('These lines are written from the trip facts in both languages. Override only when you need custom wording; clearing the override returns to the automatic line.', '这些文案由行程事实自动生成两种语言。仅在需要自定义措辞时使用“自定义”；清除自定义即恢复自动文案。')}</p>
            </CardHelp>
          </div>
          <div className="derived-grid">
            {DERIVED_FIELDS.map(field => <DerivedField key={`${lang}-${field}-${trip.updatedAt}`} field={field} derived={derived[field]} current={currentDisplay(field)} disabled={cancelled} />)}
          </div>
        </section>

        {!cancelled && <div className="trip-editor-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setDemo(true)} disabled={demo}>{demo ? t('Demo content filled — trip labelled Sample', '已填入演示内容——行程标注为示例') : t('Fill with example (demo)', '填入示例（演示）')}</button>
          <button className="btn btn-primary">{t('Save content', '保存内容')}</button>
        </div>}
      </fieldset>
    </form>
  </div></main>
}
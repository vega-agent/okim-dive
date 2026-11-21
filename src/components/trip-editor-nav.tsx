'use client'
import { useLocale } from '@/lib/use-locale'
import { contentCompleteness, tripDisplayState, type SerializedTrip } from '@/lib/trip-display'

/** Persistent trip header linking Settings ↔ Content with completion badges. */
export default function TripEditorNav({ trip, active, consumed }: { trip: SerializedTrip; active: 'settings' | 'content'; consumed: number }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const state = tripDisplayState(trip, consumed, trip.capacity)
  const en = contentCompleteness(trip, 'en')
  const zh = contentCompleteness(trip, 'zh')
  const badge = (text: string, tone: string) => <span className={`status-badge tone-${tone}`}>{text}</span>
  return <header className="trip-editor-head">
    <div className="trip-editor-title">
      <h1>{locale === 'zh' ? trip.titleZh || trip.titleEn : trip.titleEn || t('Untitled trip', '未命名行程')}</h1>
      {badge(t(state.en, state.zh), state.tone)}
      {trip.sample && badge(t('Sample', '示例'), 'neutral')}
    </div>
    <nav className="portal-nav trip-editor-nav" aria-label={t('Trip editor sections', '行程编辑栏目')}>
      <a href="/portal">{t('← Portal', '← 返回工作台')}</a>
      <a href={`/portal/trips/${trip.id}`} aria-current={active === 'settings' ? 'page' : undefined}>{t('Settings', '设置')}</a>
      <a href={`/portal/trips/${trip.id}/content`} aria-current={active === 'content' ? 'page' : undefined}>
        {t('Content', '内容')}
        <span className="completion-badges">
          <span className={`completion-badge${en.missingRequired.length ? ' incomplete' : ''}`}>EN {en.done}/{en.total}</span>
          <span className={`completion-badge${zh.missingRequired.length ? ' incomplete' : ''}`}>中文 {zh.done}/{zh.total}</span>
        </span>
      </a>
    </nav>
  </header>
}
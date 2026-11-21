'use client'
import { useLocale } from '@/lib/use-locale'
import { createTrip } from '@/lib/trip-actions'

export default function TripNewForm() {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  return <main className="ocean-journey portal trip-editor" data-locale-managed><div className="container">
    <header className="trip-editor-head">
      <div className="trip-editor-title"><h1>{t('New trip', '新建行程')}</h1></div>
      <nav className="portal-nav trip-editor-nav" aria-label={t('Trip editor sections', '行程编辑栏目')}>
        <a href="/portal">{t('← Portal', '← 返回工作台')}</a>
      </nav>
    </header>
    <section className="portal-card">
      <h2>{t('Start with a name', '从名称开始')}</h2>
      <p className="portal-hint">{t('The trip is created as a draft. Next: fill Settings (dates, price, capacity), then English and Chinese content. Publishing unlocks when both languages are complete.', '行程将以草稿创建。接下来：填写设置（日期、价格、名额），再填英文和中文内容。两种语言都完整后即可发布。')}</p>
      <form action={createTrip} className="booking-form portal-form">
        <label className="span-2">{t('Trip name (English)', '行程名称（英文）')}
          <input name="titleEn" required maxLength={200} placeholder={t('e.g. Tioman Reef Weekend', '例如：Tioman Reef Weekend')} />
        </label>
        <button className="btn btn-primary span-2">{t('Create draft', '创建草稿')}</button>
      </form>
    </section>
  </div></main>
}
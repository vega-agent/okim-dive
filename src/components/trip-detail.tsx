'use client'

// M4: bilingual trip detail (data-driven surface — renders EN/CN from DB columns
// via useLocale, unlike the DOM-dictionary marketing pages). Reuses the audited
// trip-section presentation classes from the M2 dialog port.
import Link from 'next/link'
import { useLocale, pick } from '@/lib/use-locale'

export type TripDetailData = {
  slug: string
  status: string
  sample: boolean
  currency: string
  titleEn: string; titleZh: string | null
  locationEn: string | null; locationZh: string | null
  summaryEn: string | null; summaryZh: string | null
  travelDatesEn: string | null; travelDatesZh: string | null
  durationEn: string | null; durationZh: string | null
  difficultyEn: string | null; difficultyZh: string | null
  groupSizeEn: string | null; groupSizeZh: string | null
  costDisplayEn: string | null; costDisplayZh: string | null
  costBasisEn: string | null; costBasisZh: string | null
  highlightsEn: string[] | null; highlightsZh: string[] | null
  itineraryEn: string[] | null; itineraryZh: string[] | null
  includedEn: string[] | null; includedZh: string[] | null
  additionalCostsEn: string[] | null; additionalCostsZh: string[] | null
  depositTextEn: string | null; depositTextZh: string | null
  balanceTextEn: string | null; balanceTextZh: string | null
  cancellationTextEn: string | null; cancellationTextZh: string | null
  requirementsTextEn: string | null; requirementsTextZh: string | null
  notesEn: string | null; notesZh: string | null
}

const L = {
  travelDates: ['Travel dates', '出发日期'],
  duration: ['Duration', '时长'],
  difficulty: ['Difficulty', '难度'],
  groupSize: ['Group size', '团体人数'],
  cost: ['Cost', '费用'],
  highlights: ['Highlights', '亮点'],
  itinerary: ['Itinerary', '行程安排'],
  sampleItinerary: ['Sample itinerary', '示例行程'],
  included: ['Included', '费用包含'],
  additionalCosts: ['Additional costs', '额外费用'],
  planning: ['Planning details', '安排详情'],
  samplePlanning: ['Sample planning details', '示例安排详情'],
  deposit: ['Deposit:', '订金：'],
  balance: ['Balance:', '尾款：'],
  cancellation: ['Cancellation:', '取消政策：'],
  requirements: ['Requirements:', '报名要求：'],
  book: ['Book this trip', '预订此行程'],
  ask: ['Ask about this trip', '咨询此行程'],
  back: ['← All trips', '← 全部行程'],
  sampleBadge: ['Sample trip', '示例行程'],
  openBadge: ['Open', '开放预订'],
  onRequestBadge: ['On request', '按需安排'],
} as const

function Section({ title, items, className = '' }: { title: string; items: string[] | null; className?: string }) {
  if (!items?.length) return null
  return (
    <section className={`trip-dialog-section ${className}`}>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}

export default function TripDetail({ trip }: { trip: TripDetailData }) {
  const locale = useLocale()
  const t = (pair: readonly [string, string]) => pick(locale, pair[0], pair[1])
  const badge = trip.sample ? t(L.sampleBadge)
    : trip.status === 'open' ? t(L.openBadge)
    : trip.status === 'on_request' ? t(L.onRequestBadge)
    : trip.status
  const bookable = trip.status === 'open'

  return (
    <>
      <section className="page-hero trips-hero">
        <div className="hero-bg"></div>
        <div className="hero-content">
          <span className="trip-badge">{badge}</span>
          <h1 className="hero-title">{pick(locale, trip.titleEn, trip.titleZh)}</h1>
          <p className="hero-subtitle">{pick(locale, trip.locationEn, trip.locationZh)}</p>
        </div>
      </section>

      <main className="ocean-journey">
        <section className="trips-section">
          <div className="container">
            <p className="section-lede">{pick(locale, trip.summaryEn, trip.summaryZh)}</p>
            <div className="trip-dialog-sections">
              <dl className="trip-facts trip-dialog-section trip-dialog-section-facts">
                <div><dt>{t(L.travelDates)}</dt><dd>{pick(locale, trip.travelDatesEn, trip.travelDatesZh)}</dd></div>
                <div><dt>{t(L.duration)}</dt><dd>{pick(locale, trip.durationEn, trip.durationZh)}</dd></div>
                <div><dt>{t(L.difficulty)}</dt><dd>{pick(locale, trip.difficultyEn, trip.difficultyZh)}</dd></div>
                <div><dt>{t(L.groupSize)}</dt><dd>{pick(locale, trip.groupSizeEn, trip.groupSizeZh)}</dd></div>
                <div><dt>{t(L.cost)}</dt><dd>{pick(locale, trip.costDisplayEn, trip.costDisplayZh)} <small>{pick(locale, trip.costBasisEn, trip.costBasisZh)}</small></dd></div>
              </dl>
              <Section title={t(L.highlights)} items={pick(locale, trip.highlightsEn, trip.highlightsZh)} />
              <Section title={trip.sample ? t(L.sampleItinerary) : t(L.itinerary)} items={pick(locale, trip.itineraryEn, trip.itineraryZh)} />
              <Section title={t(L.included)} items={pick(locale, trip.includedEn, trip.includedZh)} />
              <Section title={t(L.additionalCosts)} items={pick(locale, trip.additionalCostsEn, trip.additionalCostsZh)} className="trip-dialog-section-costs" />
              <section className="trip-dialog-section trip-dialog-section-rules">
                <h3>{trip.sample ? t(L.samplePlanning) : t(L.planning)}</h3>
                <ul className="trip-rules">
                  <li><strong>{t(L.deposit)}</strong> {pick(locale, trip.depositTextEn, trip.depositTextZh)}</li>
                  <li><strong>{t(L.balance)}</strong> {pick(locale, trip.balanceTextEn, trip.balanceTextZh)}</li>
                  <li><strong>{t(L.cancellation)}</strong> {pick(locale, trip.cancellationTextEn, trip.cancellationTextZh)}</li>
                  <li><strong>{t(L.requirements)}</strong> {pick(locale, trip.requirementsTextEn, trip.requirementsTextZh)}</li>
                </ul>
              </section>
            </div>
            <div className="trip-dialog-footer">
              <p className={`trip-note${trip.sample ? ' trip-note-sample' : ''}`}>{pick(locale, trip.notesEn, trip.notesZh)}</p>
              {bookable
                ? <Link className="btn btn-primary" href={`/book/${trip.slug}`}>{t(L.book)}</Link>
                : <Link className="btn btn-primary" href="/contact">{t(L.ask)}</Link>}
            </div>
            <p style={{ marginTop: '1.5rem' }}><Link className="text-link" href="/trips">{t(L.back)}</Link></p>
          </div>
        </section>
      </main>
    </>
  )
}
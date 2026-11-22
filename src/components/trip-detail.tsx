'use client'

// M4: bilingual trip detail (data-driven surface — renders EN/CN from DB columns
// via useLocale, unlike the DOM-dictionary marketing pages). Reuses the audited
// trip-section presentation classes from the M2 dialog port.
import Link from 'next/link'
import { useLocale, pick } from '@/lib/use-locale'
import { registerInterest } from '@/lib/seamless-actions'

export type TripDetailData = {
  id: string
  slug: string
  status: string
  sample: boolean
  currency: string
  capacity: number
  consumed: number
  interestState: 'registered' | 'error' | null
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
  fullBadge: ['Full', '已满'],
  interestTitle: ['Register interest', '登记意向'],
  interestIntro: ['This trip is full. Leave your details and Iris will contact you if a slot opens or she adds seats.', '此行程已满。留下你的联系方式，如有空位或增加名额，Iris 会联系你。'],
  interestName: ['Your name', '你的姓名'],
  interestEmail: ['Email', '电子邮箱'],
  interestWhatsapp: ['WhatsApp (optional)', 'WhatsApp（选填）'],
  interestConsent: ['I agree to be contacted about this trip (PDPA).', '我同意就此行程与我联系（PDPA）。'],
  interestSubmit: ['Register interest', '登记意向'],
  interestRegistered: ['Interest registered — Iris will be in touch if a slot opens.', '意向已登记——如有空位，Iris 会与你联系。'],
  interestError: ['Please check your name, email and consent, then try again.', '请检查姓名、邮箱与同意项后重试。'],
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
  const bookable = trip.status === 'open'
  const full = bookable && trip.consumed >= trip.capacity
  const badge = trip.sample ? t(L.sampleBadge)
    : full ? t(L.fullBadge)
    : trip.status === 'open' ? t(L.openBadge)
    : trip.status === 'on_request' ? t(L.onRequestBadge)
    : trip.status

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
              {trip.interestState === 'registered' && <p role="status" className="trip-note">{t(L.interestRegistered)}</p>}
              {trip.interestState === 'error' && <p role="alert" className="trip-note">{t(L.interestError)}</p>}
              {full
                ? <section className="trip-interest">
                    <h3>{t(L.interestTitle)}</h3>
                    <p className="trip-note">{t(L.interestIntro)}</p>
                    <form action={registerInterest} className="booking-form">
                      <input type="hidden" name="tripId" value={trip.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <label>{t(L.interestName)}<input name="name" required minLength={2} maxLength={200} placeholder={t(L.interestName)} /></label>
                      <label>{t(L.interestEmail)}<input name="email" type="email" required maxLength={200} placeholder="you@example.com" /></label>
                      <label>{t(L.interestWhatsapp)}<input name="whatsapp" maxLength={40} placeholder="+60…" /></label>
                      <label className="span-2 portal-consent"><input type="checkbox" name="consent" required /> {t(L.interestConsent)}</label>
                      <button className="btn btn-primary span-2">{t(L.interestSubmit)}</button>
                    </form>
                  </section>
                : bookable
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
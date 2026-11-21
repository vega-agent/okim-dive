'use client'

// M6 My Okim view — read-only (MVP-SPEC §10): no forms, no mutation actions.
// Owner revision 2026-11-21: tabbed layout — Upcoming trips is the default after
// login; Past trips (compact rows, capped with show-all) and Points live on their
// own tabs so the page stays short as history grows.
// Self-localized via useLocale, pinned to the customer's stored locale (§11);
// the global toggle persists the choice through setCustomerLocale.
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useLocale, pick, type Locale } from '@/lib/use-locale'
import { setCustomerLocale } from '@/lib/booking-actions'
import DiverProfile from '@/components/diver-profile'
import BookingEquipment from '@/components/booking-equipment'
import type { Equipment } from '@/lib/diver-equipment'

type Receipt = { id: string; receiptNo: string; kind: string; amount: string; currency: string }
type Booking = {
  id: string; status: string; eligibilityStatus: string; currency: string
  depositAmount: string | null; balanceAmount: string | null; pointsDiscountAmount: string | null
  createdAt: string; balanceDue: string | null; invoiceNumber: string | null
  trip: { slug: string; titleEn: string; titleZh: string; travelDatesEn: string | null; travelDatesZh: string | null; sample: boolean } | null
  equipment: { initial: Equipment | null; editable: boolean; cutoffAt: string | null; timezone: string | null } | null
  receipts: Receipt[]
}
type LedgerEntry = { id: string; type: string; points: number; rmAmount: string | null; rateSnapshot: string | null; bookingId: string | null; expiresAt: string | null; createdAt: string }
type Data = {
  customer: { id: string; name: string; email: string; phone: string | null; locale: Locale; diverProfile: Record<string, unknown> | null }
  totalPoints: number
  availablePoints: number
  bookings: Booking[]
  ledger: LedgerEntry[]
}

type Tone = 'pending' | 'ok' | 'bad' | 'neutral'
const bookingStatus: Record<string, { en: string; zh: string; tone: Tone }> = {
  awaiting_deposit: { en: 'Awaiting deposit', zh: '待付订金', tone: 'pending' },
  payment_claimed: { en: 'Payment recorded', zh: '已记录付款', tone: 'pending' },
  deposit_verified: { en: 'Deposit verified', zh: '订金已核实', tone: 'ok' },
  confirmed: { en: 'Confirmed', zh: '已确认', tone: 'ok' },
  completed: { en: 'Completed', zh: '已完成', tone: 'ok' },
  refund_flagged: { en: 'Refund review', zh: '退款审核', tone: 'bad' },
  cancelled: { en: 'Cancelled', zh: '已取消', tone: 'neutral' },
  eligibility_declined: { en: 'Eligibility declined', zh: '资格未通过', tone: 'bad' },
}
const eligibilityStatus: Record<string, { en: string; zh: string; tone: Tone }> = {
  pending: { en: 'Eligibility pending', zh: '资格待审', tone: 'pending' },
  approved: { en: 'Eligible', zh: '资格已批', tone: 'ok' },
  declined: { en: 'Eligibility declined', zh: '资格未通过', tone: 'bad' },
}
const ledgerType: Record<string, { en: string; zh: string; tone: Tone }> = {
  earned: { en: 'Earned', zh: '已累积', tone: 'ok' },
  redeemed: { en: 'Redeemed', zh: '已抵扣', tone: 'pending' },
  expired: { en: 'Expired', zh: '已过期', tone: 'neutral' },
  reversed: { en: 'Reversed', zh: '已冲正', tone: 'neutral' },
}

// Bookings still needing attention (payment, confirmation, refund review) stay
// on Upcoming; only completed and cancelled bookings move to Past trips.
const PAST_STATUSES = ['completed', 'cancelled']
const PAST_LIMIT = 5

type Tab = 'upcoming' | 'past' | 'points' | 'profile'

// (?) help toggle per card — same pattern as the portal.
function CardHelp({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <>
    <button type="button" className="portal-help-toggle" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen(v => !v)}>?</button>
    <div id={id} className="portal-help" role="note" hidden={!open}>{children}</div>
  </>
}

export default function MyOkimView({ data }: { data: Data }) {
  const locale = useLocale(data.customer.locale, next => void setCustomerLocale(next))
  const [tab, setTab] = useState<Tab>('upcoming')
  const [showAllPast, setShowAllPast] = useState(false)
  // Deep link (/myokim#profile) opens the Profile tab.
  useEffect(() => { if (window.location.hash === '#profile') setTab('profile') }, [])
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const label = (m: Record<string, { en: string; zh: string }>, key: string) => { const v = m[key]; return v ? t(v.en, v.zh) : key }
  const tone = (m: Record<string, { tone: Tone }>, key: string) => m[key]?.tone ?? 'neutral'
  const money = (currency: string, amount: string) => `${currency} ${Number(amount).toFixed(2)}`
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const badge = (text: string, tn: Tone) => <span className={`status-badge tone-${tn}`}>{text}</span>
  const tripName = (b: Booking) => b.trip ? pick(locale, b.trip.titleEn, b.trip.titleZh) : b.id
  const tripDates = (b: Booking) => b.trip ? pick(locale, b.trip.travelDatesEn, b.trip.travelDatesZh) ?? date(b.createdAt) : date(b.createdAt)
  const guidance = (b: Booking): string => {
    switch (b.status) {
      case 'awaiting_deposit': return t(`Pay the deposit by bank transfer using ${b.id} as the reference, then send the screenshot to Iris on WhatsApp.`, `请以 ${b.id} 为转账备注支付订金，并将转账截图通过 WhatsApp 发送给 Iris。`)
      case 'payment_claimed': return t('Iris has recorded your payment and is checking it against the bank record.', 'Iris 已记录你的付款，正在核对银行记录。')
      case 'deposit_verified': return t('Deposit verified — Iris is confirming your slot.', '订金已核实——Iris 正在确认你的名额。')
      case 'confirmed': return Number(b.balanceAmount ?? 0) > 0
        ? t('Your slot is confirmed. Pay the balance by the due date.', '名额已确认。请在截止日期前支付尾款。')
        : t('Your slot is confirmed. See you underwater.', '名额已确认。水下见。')
      case 'refund_flagged': return t('A refund is under review — Iris will contact you.', '退款正在审核中——Iris 会与你联系。')
      case 'eligibility_declined': return t('Eligibility was not approved — contact Iris to discuss options.', '资格未获批准——请联系 Iris 商量其他方案。')
      default: return ''
    }
  }

  const upcoming = data.bookings.filter(b => !PAST_STATUSES.includes(b.status))
  const past = data.bookings.filter(b => PAST_STATUSES.includes(b.status))
  const visiblePast = showAllPast ? past : past.slice(0, PAST_LIMIT)
  const tabs: [Tab, string, string, number | null][] = [
    ['upcoming', 'Upcoming trips', '即将出行', upcoming.length],
    ['past', 'Past trips', '往期行程', past.length],
    ['points', 'Points', '我的积分', null],
    ['profile', 'Profile', '个人资料', null],
  ]
  const equipmentCutoff = (eq: NonNullable<Booking['equipment']>) => eq.cutoffAt
    ? `${new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: eq.timezone ?? undefined, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(eq.cutoffAt))}${eq.timezone ? ` (${eq.timezone})` : ''}`
    : t('Contact Iris', '请联系 Iris')
  const onTabKey = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0]
    setTab(next)
    document.getElementById(`my-tab-${next}`)?.focus()
  }

  return <div className="container">
    <header className="my-head">
      <h1>{t('My Okim', '我的 Okim')}</h1>
      <p className="my-lede">{t('Your bookings and Okim Points in one place. Bookings and points are read-only — contact Iris to make changes; profile details are self-declared.', '你的预订与 Okim 积分尽在于此。预订与积分只读——如需更改请联系 Iris；个人资料为自行申报。')}</p>
    </header>
    <div className="my-tabs" role="tablist" aria-label={t('My Okim sections', '我的 Okim 栏目')}>
      {tabs.map(([id, en, zh, count], i) => <button
        key={id} type="button" role="tab" id={`my-tab-${id}`} className="my-tab"
        aria-selected={tab === id} aria-controls={`my-panel-${id}`} tabIndex={tab === id ? 0 : -1}
        onClick={() => setTab(id)} onKeyDown={e => onTabKey(e, i)}>
        {t(en, zh)}{count !== null && <span className="my-tab-count">{count}</span>}
      </button>)}
    </div>
    <p className="portal-hint my-readonly">{t('Read-only — to change or cancel a booking,', '本页面为只读——如需更改或取消预订，请')} <a href="/contact">{t('contact Iris', '联系 Iris')}</a>{t('.', '。')}</p>

    <section id="my-panel-upcoming" role="tabpanel" aria-labelledby="my-tab-upcoming" className="portal-card" hidden={tab !== 'upcoming'}>
      <div className="portal-card-head">
        <h2>{t('Upcoming trips', '即将出行')}</h2>
        <CardHelp id="trips-help" label={t('Help: Upcoming trips', '帮助：即将出行')}>
          <p>{t('Each booking moves through these stages:', '每个预订会经历以下阶段：')}</p>
          <ol>
            <li>{t('Awaiting deposit — pay by bank transfer with your booking ID as the reference, then send the screenshot to Iris on WhatsApp.', '待付订金——以预订编号为转账备注付款，再将截图通过 WhatsApp 发送给 Iris。')}</li>
            <li>{t('Confirmed — Iris verified your deposit against the bank record and re-checked availability. Your slot is held.', '已确认——Iris 已核对银行到账并复查名额，你的名额已保留。')}</li>
            <li>{t('Completed trips move to the Past trips tab; their points unlock on the Points tab.', '已完成的行程会移入「往期行程」标签；其积分在「我的积分」标签解锁。')}</li>
            <li>{t('Changes and cancellations are handled by Iris personally — use the contact link above.', '更改与取消由 Iris 亲自处理——请使用上方联系链接。')}</li>
          </ol>
        </CardHelp>
      </div>
      {upcoming.length === 0 ? <div className="portal-empty">
        <h3>{t('No upcoming trips', '暂无即将出行的行程')}</h3>
        <p>{t('Your bookings will appear here after you book a trip.', '预订行程后，将显示在此处。')}</p>
        <a className="btn btn-primary" href="/trips">{t('Browse trips', '浏览行程')}</a>
      </div> : upcoming.map(b => <div key={b.id} className="my-booking-group">
        <article className="portal-booking my-booking">
        <div className="portal-booking-head">
          <h3>{tripName(b)}</h3>
          {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
          {badge(label(eligibilityStatus, b.eligibilityStatus), tone(eligibilityStatus, b.eligibilityStatus))}
          {b.trip?.sample && badge(t('Sample trip', '示例行程'), 'neutral')}
        </div>
        <p className="portal-row-sub">{b.id} · {tripDates(b)}</p>
        <dl className="my-amounts">
          <div><dt>{t('Deposit', '订金')}</dt><dd>{money(b.currency, b.depositAmount ?? '0')}</dd></div>
          <div><dt>{t('Balance', '尾款')}</dt><dd>{money(b.currency, b.balanceAmount ?? '0')}</dd></div>
          {Number(b.pointsDiscountAmount ?? 0) > 0 && <div><dt>{t('Points discount', '积分抵扣')}</dt><dd>−{money(b.currency, b.pointsDiscountAmount as string)}</dd></div>}
          {Number(b.balanceAmount ?? 0) > 0 && b.balanceDue && ['awaiting_deposit', 'confirmed'].includes(b.status) && <div><dt>{t('Balance due', '尾款截止')}</dt><dd>{date(b.balanceDue)}</dd></div>}
        </dl>
        <p className="my-guidance">{guidance(b)}</p>
        <ul className="portal-receipts my-links">
          {b.invoiceNumber && <li><a href={`/invoice/${encodeURIComponent(b.id)}`}>{t('Invoice', '发票')} {b.invoiceNumber}</a></li>}
          {b.receipts.map(r => <li key={r.id}><a href={`/receipt/${encodeURIComponent(r.id)}`}>{r.kind === 'refund' ? t('Refund record', '退款记录') : t('Receipt', '收据')} {r.receiptNo} · {money(r.currency, r.amount)}</a></li>)}
        </ul>
        </article>
        {b.equipment && <BookingEquipment id={b.id} initial={b.equipment.initial} profile={data.customer.diverProfile?.equipment} editable={b.equipment.editable} cutoff={equipmentCutoff(b.equipment)} locale={locale} />}
      </div>)}
    </section>

    <section id="my-panel-past" role="tabpanel" aria-labelledby="my-tab-past" className="portal-card" hidden={tab !== 'past'}>
      <div className="portal-card-head">
        <h2>{t('Past trips', '往期行程')}</h2>
      </div>
      <p className="portal-hint">{t('Completed and cancelled bookings, newest first. Invoice and receipt records stay available.', '已完成与已取消的预订，按时间倒序。发票与收据记录随时可查。')}</p>
      {past.length === 0 ? <div className="portal-empty">
        <h3>{t('No past trips yet', '暂无往期行程')}</h3>
        <p>{t('Trips appear here after they are completed or cancelled.', '行程完成或取消后将显示在此处。')}</p>
      </div> : <>
        <ul className="my-past-list">
          {visiblePast.map(b => <li key={b.id} className="my-past-row">
            <div className="my-past-main">
              <strong>{tripName(b)}</strong>
              <span className="portal-row-sub">{b.id} · {tripDates(b)}</span>
            </div>
            {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
            {b.trip?.sample && badge(t('Sample', '示例'), 'neutral')}
            <span className="my-past-links">
              {b.invoiceNumber && <a href={`/invoice/${encodeURIComponent(b.id)}`} aria-label={`${t('Invoice', '发票')} ${b.invoiceNumber}`}>{t('Invoice', '发票')}</a>}
              {b.receipts.map(r => <a key={r.id} href={`/receipt/${encodeURIComponent(r.id)}`} aria-label={`${r.kind === 'refund' ? t('Refund record', '退款记录') : t('Receipt', '收据')} ${r.receiptNo} · ${money(r.currency, r.amount)}`}>{r.receiptNo}</a>)}
            </span>
          </li>)}
        </ul>
        {past.length > PAST_LIMIT && <button type="button" className="btn btn-secondary my-show-all" onClick={() => setShowAllPast(v => !v)}>
          {showAllPast ? t('Show fewer', '收起') : t(`Show all ${past.length} past trips`, `显示全部 ${past.length} 条往期行程`)}
        </button>}
      </>}
    </section>

    <section id="my-panel-points" role="tabpanel" aria-labelledby="my-tab-points" className="portal-card" hidden={tab !== 'points'}>
      <div className="portal-card-head">
        <h2>{t('My Rewards', '我的积分')}</h2>
        <CardHelp id="rewards-help" label={t('Help: My Rewards', '帮助：我的积分')}>
          <p>{t('How Okim Points work:', 'Okim 积分规则：')}</p>
          <ol>
            <li>{t('Earn points on every verified payment: 1 point per RM1, using the trip rate snapshot.', '每笔核实付款自动累积积分：每 RM1 得 1 分，按行程汇率快照计算。')}</li>
            <li>{t('Points unlock only after that trip is completed, and expire 12 months after verification.', '积分仅在对应行程完成后可用，自核实起 12 个月后过期。')}</li>
            <li>{t('Iris applies your points at invoice time, up to 20% of the trip price — ask her when booking.', 'Iris 会在开具发票时为你抵扣积分，最高为行程价格的 20%——预订时向她提出即可。')}</li>
            <li>{t('Refunds reverse the related points; the history below is append-only, so corrections appear as reversal entries.', '退款会冲正相关积分；下方明细只增不改，更正以冲正记录呈现。')}</li>
          </ol>
        </CardHelp>
      </div>
      <div className="my-stats">
        <div className="my-stat">
          <span className="my-stat-value">{data.totalPoints}</span>
          <span className="my-stat-label">{t('Total balance', '积分总额')}</span>
        </div>
        <div className="my-stat">
          <span className="my-stat-value">{data.availablePoints}</span>
          <span className="my-stat-label">{t('Available to redeem', '可用积分')}</span>
        </div>
      </div>
      <p className="portal-hint">{t('Points unlock after a trip is completed and expire 12 months after verification. Iris applies them at invoice time (up to 20% of the trip price).', '积分在行程完成后可用，自核实起 12 个月后过期。Iris 会在开具发票时为你抵扣（最高为行程价格的 20%）。')}</p>
      {data.ledger.length === 0 ? <div className="portal-empty">
        <h3>{t('No points activity yet', '暂无积分记录')}</h3>
        <p>{t('Verified payments earn points automatically.', '核实付款后自动累积积分。')}</p>
      </div> : <table className="portal-table">
        <thead><tr>
          <th>{t('Date', '日期')}</th>
          <th>{t('Type', '类型')}</th>
          <th>{t('Points', '积分')}</th>
          <th>{t('RM amount', 'RM 金额')}</th>
          <th>{t('Rate snapshot', '汇率快照')}</th>
          <th>{t('Booking', '预订')}</th>
        </tr></thead>
        <tbody>{data.ledger.map(e => <tr key={e.id}>
          <td data-label={t('Date', '日期')}>
            <span className="my-date-cell">
              {date(e.createdAt)}
              {e.type === 'earned' && e.expiresAt && <span className="my-expiry">{t('Expires', '有效期至')} {date(e.expiresAt)}</span>}
            </span>
          </td>
          <td data-label={t('Type', '类型')}>{badge(label(ledgerType, e.type), tone(ledgerType, e.type))}</td>
          <td data-label={t('Points', '积分')}>{e.points > 0 ? `+${e.points}` : e.points}</td>
          <td data-label={t('RM amount', 'RM 金额')}>{e.rmAmount != null ? `RM ${Number(e.rmAmount).toFixed(2)}` : '—'}</td>
          <td data-label={t('Rate snapshot', '汇率快照')}>{e.rateSnapshot ?? '—'}</td>
          <td data-label={t('Booking', '预订')}>{e.bookingId ?? '—'}</td>
        </tr>)}</tbody>
      </table>}
    </section>

    <section id="my-panel-profile" role="tabpanel" aria-labelledby="my-tab-profile" hidden={tab !== 'profile'}>
      <DiverProfile customer={{ ...data.customer, locale }} />
    </section>
  </div>
}
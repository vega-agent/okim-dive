'use client'

// M6 My Okim view — read-only (MVP-SPEC §10): no forms, no mutation actions.
// Owner revision 2026-11-21: tabbed layout — Upcoming trips is the default after
// login; Past trips (compact rows, capped with show-all) and Points live on their
// own tabs so the page stays short as history grows.
// Self-localized via useLocale, following the browsing language (#33);
// the global toggle persists the choice through setCustomerLocale (emails).
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useLocale, pick, type Locale } from '@/lib/use-locale'
import { setCustomerLocale } from '@/lib/booking-actions'
import DiverProfile from '@/components/diver-profile'
import { useEquipmentValue, EquipmentSizes } from '@/components/equipment-editor'
import EquipmentBoard from '@/components/equipment-board'
import { saveBookingEquipment } from '@/lib/diver-actions'
import { markMessageRead } from '@/lib/message-actions'
import { RENTAL_NOTICE, equipmentFromProfile, type Equipment } from '@/lib/diver-equipment'

type Receipt = { id: string; receiptNo: string; kind: string; amount: string; currency: string }
type BookingMessage = { id: string; label: string; subjectEn: string; subjectZh: string; bodyEn: string; bodyZh: string; publishedAt: string; seen: boolean }
type Booking = {
  id: string; status: string; eligibilityStatus: string; currency: string
  depositAmount: string | null; balanceAmount: string | null; pointsDiscountAmount: string | null
  createdAt: string; balanceDue: string | null; invoiceNumber: string | null
  trip: { slug: string; titleEn: string; titleZh: string; travelDatesEn: string | null; travelDatesZh: string | null; sample: boolean } | null
  equipment: { initial: Equipment | null; editable: boolean; cutoffAt: string | null; timezone: string | null } | null
  receipts: Receipt[]
  messages: BookingMessage[]
}
type LedgerEntry = { id: string; type: string; points: number; rmAmount: string | null; rateSnapshot: string | null; bookingId: string | null; expiresAt: string | null; createdAt: string }
type Data = {
  customer: { id: string; name: string; email: string; phone: string | null; diverProfile: Record<string, unknown> | null }
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
  eligibility_declined: { en: 'Withdrawn', zh: '已退出', tone: 'neutral' },
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

type T = (en: string, zh: string) => string

const label = (m: Record<string, { en: string; zh: string }>, key: string, t: T) => { const v = m[key]; return v ? t(v.en, v.zh) : key }
const tone = (m: Record<string, { tone: Tone }>, key: string) => m[key]?.tone ?? 'neutral'

function guidanceFor(b: Booking, t: T): string {
  switch (b.status) {
    case 'awaiting_deposit': return t(`Pay the deposit by bank transfer using ${b.id} as the reference, then send the screenshot to Iris on WhatsApp.`, `请以 ${b.id} 为转账备注支付订金，并将转账截图通过 WhatsApp 发送给 Iris。`)
    case 'payment_claimed': return t('Iris has recorded your payment and is checking it against the bank record.', 'Iris 已记录你的付款，正在核对银行记录。')
    case 'deposit_verified': return t('Deposit verified — Iris is confirming your slot.', '订金已核实——Iris 正在确认你的名额。')
    case 'confirmed': return Number(b.balanceAmount ?? 0) > 0
      ? t('Your slot is confirmed. Pay the balance by the due date.', '名额已确认。请在截止日期前支付尾款。')
      : t('Your slot is confirmed. See you underwater.', '名额已确认。水下见。')
    case 'refund_flagged': return t('A refund is under review — Iris will contact you.', '退款正在审核中——Iris 会与你联系。')
    case 'eligibility_declined': return t('This booking was withdrawn — contact Iris to discuss options.', '此预订已退出——请联系 Iris 商量其他方案。')
    default: return ''
  }
}

// Owner revision 2026-11-21: each upcoming booking reads as three sub-cards —
// Trip information / Equipment / Sizes & fit — closing with a small disclaimer.
// The booking reference is explained once, where it first appears.
function BookingGroup({ b, profile, locale }: { b: Booking; profile: Record<string, unknown> | null; locale: Locale }) {
  const t: T = (en, zh) => locale === 'zh' ? zh : en
  const money = (currency: string, amount: string) => `${currency} ${Number(amount).toFixed(2)}`
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const badge = (text: string, tn: Tone) => <span className={`status-badge tone-${tn}`}>{text}</span>
  const { value, update } = useEquipmentValue(b.equipment?.initial ?? undefined, profile?.equipment)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  // Trip messages feed (TRIP-MESSAGES-SPEC): static unread dot until opened;
  // opening marks the message seen (instructor-only seen counts).
  const [seenIds, setSeenIds] = useState<string[]>(() => b.messages.filter(m => m.seen).map(m => m.id))
  const unreadCount = b.messages.filter(m => !seenIds.includes(m.id)).length
  const openMessage = (id: string, open: boolean) => {
    if (!open || seenIds.includes(id)) return
    setSeenIds(ids => [...ids, id])
    void markMessageRead(id)
  }
  const editable = b.equipment?.editable ?? false
  const cutoff = b.equipment?.cutoffAt
    ? `${new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: b.equipment.timezone ?? undefined, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(b.equipment.cutoffAt))}${b.equipment.timezone ? ` (${b.equipment.timezone})` : ''}`
    : t('contact Iris', '联系 Iris')
  const save = async () => {
    setPending(true)
    const r = await saveBookingEquipment(b.id, value)
    setNotice(r === 'saved' ? t('Saved for Iris review.', '已保存供 Iris 查看。') : t('Not saved. Contact Iris.', '未保存，请联系 Iris。'))
    setPending(false)
  }
  return <div className="my-booking-group">
    <section className="my-subcard">
      <header className="my-subcard-head"><h3><img src="/assets/icons/ui-compass.webp" alt="" width={20} height={20} />{t('Trip information', '行程信息')}</h3></header>
      <div className="my-subcard-body">
        <p className="my-trip-title">{b.trip ? pick(locale, b.trip.titleEn, b.trip.titleZh) : b.id}</p>
        <p className="my-meta">{b.trip ? pick(locale, b.trip.travelDatesEn, b.trip.travelDatesZh) ?? date(b.createdAt) : date(b.createdAt)}{b.trip?.sample ? ` · ${t('Sample trip', '示例行程')}` : ''}</p>
        <p className="my-meta">{t('Booking reference', '预订编号')} <strong>{b.id}</strong> — {t('use it as your bank transfer reference.', '银行转账时请以此作为备注。')}</p>
        <div className="my-badges">
          {badge(label(bookingStatus, b.status, t), tone(bookingStatus, b.status))}
        </div>
        <dl className="my-amounts">
          <div><dt>{t('Deposit', '订金')}</dt><dd>{money(b.currency, b.depositAmount ?? '0')}</dd></div>
          <div><dt>{t('Balance', '尾款')}</dt><dd>{money(b.currency, b.balanceAmount ?? '0')}</dd></div>
          {Number(b.pointsDiscountAmount ?? 0) > 0 && <div><dt>{t('Points discount', '积分抵扣')}</dt><dd>−{money(b.currency, b.pointsDiscountAmount as string)}</dd></div>}
          {Number(b.balanceAmount ?? 0) > 0 && b.balanceDue && ['awaiting_deposit', 'confirmed'].includes(b.status) && <div><dt>{t('Balance due', '尾款截止')}</dt><dd>{date(b.balanceDue)}</dd></div>}
        </dl>
        <p className="my-guidance">{guidanceFor(b, t)}</p>
        <ul className="portal-receipts my-links">
          {b.invoiceNumber && <li><a href={`/invoice/${encodeURIComponent(b.id)}`}>{t('Invoice', '发票')} {b.invoiceNumber}</a></li>}
          {b.receipts.map(r => <li key={r.id}><a href={`/receipt/${encodeURIComponent(r.id)}`}>{r.kind === 'refund' ? t('Refund record', '退款记录') : t('Receipt', '收据')} {r.receiptNo} · {money(r.currency, r.amount)}</a></li>)}
        </ul>
      </div>
    </section>
    {b.messages.length > 0 && <section className="my-subcard my-messages" id={`messages-${b.id}`}>
      <header className="my-subcard-head">
        <h3><img src="/assets/icons/ui-contact.webp" alt="" width={20} height={20} />{t('Messages from Iris', '来自 Iris 的消息')}{unreadCount > 0 && <span className="status-badge tone-pending">{t(`${unreadCount} new`, `${unreadCount} 条新消息`)}</span>}</h3>
      </header>
      <div className="my-subcard-body">
        <ul className="msg-feed">
          {b.messages.map(m => {
            const unread = !seenIds.includes(m.id)
            return <li key={m.id}>
              <details onToggle={e => openMessage(m.id, (e.currentTarget as HTMLDetailsElement).open)}>
                <summary>
                  {unread && <span className="msg-unread-dot" aria-label={t('Unread', '未读')} />}
                  <span className="status-badge tone-neutral">{m.label}</span>
                  <strong>{pick(locale, m.subjectEn, m.subjectZh)}</strong>
                  <span className="my-meta msg-date">{date(m.publishedAt)}</span>
                </summary>
                <div className="msg-feed-body">{pick(locale, m.bodyEn, m.bodyZh)}</div>
              </details>
            </li>
          })}
        </ul>
      </div>
    </section>}
    {b.equipment && <>
      <section className="my-subcard" id={`equipment-${b.id}`}>
        <header className="my-subcard-head"><h3><img src="/assets/icons/eq-bring-mask.webp" alt="" width={20} height={20} />{t('Equipment', '装备')}</h3>
          <button type="button" className="eq-icon-btn" aria-label={t('Reset from profile', '从资料重置')} data-tip={t('Auto-fill from your profile list', '按你的资料自动填充')} disabled={!editable || pending} onClick={() => update(equipmentFromProfile(profile?.equipment))}>
            <img src="/assets/icons/eq-reset-bubbles.webp" alt="" width={24} height={24} />
          </button>
        </header>
        <div className="my-subcard-body">
          <p className="my-meta">{t('Tell Iris what you bring and what you need to rent.', '告诉 Iris 哪些装备自带、哪些需要租赁。')}</p>
          <EquipmentBoard value={value} update={update} profile={profile?.equipment} locale={locale} disabled={!editable || pending} idPrefix={b.id} />
        </div>
      </section>
      <section className="my-subcard" id={`sizes-${b.id}`}>
        <header className="my-subcard-head"><h3><img src="/assets/icons/ui-wetsuit.webp" alt="" width={20} height={20} />{t('Sizes & fit', '尺码与合身')}</h3></header>
        <div className="my-subcard-body">
          <EquipmentSizes value={value} update={update} locale={locale} disabled={!editable || pending} grid />
          <div className="my-save-row">
            <p role="status">{notice}</p>
            <button type="button" className="btn btn-primary" disabled={!editable || pending} onClick={save}>{t('Save booking equipment', '保存预订装备')}</button>
          </div>
        </div>
      </section>
      <p className="my-disclaimer">
        {t('Equipment and sizes are self-declared; Iris reviews suitability before the trip.', '装备与尺码为自行申报；Iris 会在行程前审核适宜性。')}
        {editable
          ? ` ${t('You can edit until', '可编辑至')} ${cutoff}. ${t('After that, contact Iris.', '此后请联系 Iris。')}`
          : ` ${t('Editing is closed — contact Iris for changes.', '编辑已关闭——如需更改请联系 Iris。')}`}
        {' '}{RENTAL_NOTICE[locale === 'zh' ? 1 : 0]}
        {' '}{t('Rental cost and payment are arranged at the dive shop on the trip, outside your invoice, balance and points.', '租赁费用与付款在行程期间于潜店安排，不计入发票、余额或积分。')}
      </p>
    </>}
  </div>
}

export default function MyOkimView({ data }: { data: Data }) {
  const locale = useLocale(undefined, next => void setCustomerLocale(next))
  const [tab, setTab] = useState<Tab>('upcoming')
  const [showAllPast, setShowAllPast] = useState(false)
  // Deep link (/myokim#profile) opens the Profile tab.
  useEffect(() => { if (window.location.hash === '#profile') setTab('profile') }, [])
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const money = (currency: string, amount: string) => `${currency} ${Number(amount).toFixed(2)}`
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const badge = (text: string, tn: Tone) => <span className={`status-badge tone-${tn}`}>{text}</span>
  const tripName = (b: Booking) => b.trip ? pick(locale, b.trip.titleEn, b.trip.titleZh) : b.id
  const tripDates = (b: Booking) => b.trip ? pick(locale, b.trip.travelDatesEn, b.trip.travelDatesZh) ?? date(b.createdAt) : date(b.createdAt)

  const upcoming = data.bookings.filter(b => !PAST_STATUSES.includes(b.status))
  const past = data.bookings.filter(b => PAST_STATUSES.includes(b.status))
  const visiblePast = showAllPast ? past : past.slice(0, PAST_LIMIT)
  const tabs: [Tab, string, string, number | null, string][] = [
    ['upcoming', 'Upcoming trips', '即将出行', upcoming.length, '/assets/icons/ui-dive-flag.webp'],
    ['past', 'Past trips', '往期行程', past.length, '/assets/icons/ui-anchor.webp'],
    ['points', 'Points', '我的积分', null, '/assets/icons/ui-pearl.webp'],
    ['profile', 'Profile', '个人资料', null, '/assets/icons/ui-diver.webp'],
  ]
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
      {tabs.map(([id, en, zh, count, icon], i) => <button
        key={id} type="button" role="tab" id={`my-tab-${id}`} className="my-tab"
        aria-selected={tab === id} aria-controls={`my-panel-${id}`} tabIndex={tab === id ? 0 : -1}
        onClick={() => setTab(id)} onKeyDown={e => onTabKey(e, i)}>
        <img className="my-tab-icon" src={icon} alt="" width={20} height={20} />
        {t(en, zh)}{count !== null && <span className="my-tab-count">{count}</span>}
      </button>)}
    </div>
    <p className="portal-hint my-readonly">{t('Read-only — to change or cancel a booking,', '本页面为只读——如需更改或取消预订，请')} <a href="/contact">{t('contact Iris', '联系 Iris')}</a>{t('.', '。')}</p>

    <section id="my-panel-upcoming" role="tabpanel" aria-labelledby="my-tab-upcoming" className="portal-card" hidden={tab !== 'upcoming'}>
      <div className="portal-card-head">
        <h2><img src="/assets/icons/ui-dive-flag.webp" alt="" width={20} height={20} />{t('Upcoming trips', '即将出行')}</h2>
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
      </div> : upcoming.map(b => <BookingGroup key={b.id} b={b} profile={data.customer.diverProfile} locale={locale} />)}
    </section>

    <section id="my-panel-past" role="tabpanel" aria-labelledby="my-tab-past" className="portal-card" hidden={tab !== 'past'}>
      <div className="portal-card-head">
        <h2><img src="/assets/icons/ui-anchor.webp" alt="" width={20} height={20} />{t('Past trips', '往期行程')}</h2>
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
            {badge(label(bookingStatus, b.status, t), tone(bookingStatus, b.status))}
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
        <h2><img src="/assets/icons/ui-pearl.webp" alt="" width={20} height={20} />{t('My Rewards', '我的积分')}</h2>
        <CardHelp id="rewards-help" label={t('Help: My Rewards', '帮助：我的积分')}>
          <p>{t('How Okim Points work:', 'Okim 积分规则：')}</p>
          <ol>
            <li>{t('Points are awarded once when Iris completes your individual booking: 1 point per RM1 of net verified cash, using payment rate snapshots. Payments alone earn nothing.', 'Iris 确认你的个人预订完成后，按净核实现金付款一次性发放积分：每 RM1 得 1 分，使用付款汇率快照。付款本身不获积分。')}</li>
            <li>{t('New awards are immediately usable and expire 12 calendar months from individual completion. Legacy entries retain their original rules and expiry.', '新积分发放后即可使用，自个人预订完成日起 12 个日历月后过期。旧记录保留原规则及到期日。')}</li>
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
      <p className="portal-hint">{t('Not yet awarded before individual completion. No points for no-shows, withdrawals, cancelled or declined bookings. Iris applies available points at invoice time (up to 20% of the trip price).', '个人预订完成前尚未发放积分。未出席、退出、取消或被拒的预订不获积分。Iris 在开具发票时抵扣可用积分（最高为行程价格的 20%）。')}</p>
      {data.ledger.length === 0 ? <div className="portal-empty">
        <h3>{t('No points activity yet', '暂无积分记录')}</h3>
        <p>{t('Points are not yet awarded until Iris completes your individual booking.', 'Iris 确认个人预订完成前，积分尚未发放。')}</p>
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
          <td data-label={t('Type', '类型')}>{badge(label(ledgerType, e.type, t), tone(ledgerType, e.type))}</td>
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
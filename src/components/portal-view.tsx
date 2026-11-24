'use client'

// Portal v2 (2026-11-22, owner decisions in OPC/PORTAL-REDESIGN-V2-PLAN.md):
// trip-centric regroup of the v1 4-tab portal — Actions / Trips / Money /
// Settings. Folding cards keep pages short (open only when actionable);
// one-time actions and viewing functions run in a native <dialog> pre-filled
// from the card (never re-enter known data). Buttons restyled portal-scoped:
// Deep Sea primary, white secondary, coral only on destructive confirms.
// Identifiers explained once; payment UUIDs never displayed (§13/§14).
import AccountHeading from './account-heading'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocale } from '@/lib/use-locale'
import { completeBooking, handleInquiry } from '@/lib/portal-actions'
import BookingLifecycleForm, {type PendingDateChange} from './booking-lifecycle-form'
import CardHelp from '@/components/portal-card-help'
import PortalTrips, { type PortalTrip, type PortalBookingRow } from '@/components/portal-trips'
import PortalSettings, { type PortalSettingsData } from '@/components/portal-settings'
import PortalPolicies, { type PortalPolicy } from '@/components/portal-policies'
import PortalDialog from '@/components/portal-dialog'
import BookingPointsForm, { type Redemption } from './booking-points-form'
import FinancialActionForm from './financial-action-form'
import RecordPaymentDialog from './record-payment-dialog'
import PaymentSchedule from './payment-schedule'
import type { BookingPaymentSummary } from '@/lib/payment-schedule'
import EquipmentSummary from '@/components/equipment-summary'

type Booking = PortalBookingRow & { redemption: Redemption | null; pendingChange:PendingDateChange|null; eligibilityStatus: string; balanceAmount: string | null; holdExpiresAt: string | null; paymentToday: string | null; summary: BookingPaymentSummary | null; declarations: Record<string, unknown> }
type Inquiry = { id: string; name: string; message: string; status: string; interest: string; tripTitle: { en: string; zh: string } | null }
type Data = {
  manifest: Booking[]
  receipts: { id: string; bookingId: string; number: number; paidOn: string | null; refundableMinor: number; amount: string; currency: string; kind: string }[]
  queue: Inquiry[]
  ledger: { id: string; customerId: string; customerName: string; type: string; points: number; rmAmount: string; rateSnapshot: string }[]
  trips: PortalTrip[]
  settings: PortalSettingsData
  policies: PortalPolicy[]
}

type Tone = 'pending' | 'ok' | 'bad' | 'neutral'
type Tab = 'actions' | 'trips' | 'money' | 'settings'
type DialogState =
  | { kind: 'amount'; booking: Booking }
  | { kind: 'postponement'; booking: Booking }
  | { kind: 'withdraw'; booking: Booking }
  | { kind: 'complete'; booking: Booking }
  | { kind: 'refund'|'correction'; booking: Booking }
  | { kind: 'redeem'; bookingId?: string }
  | { kind: 'declarations'; booking: Booking }
  | { kind: 'equipment'; booking: Booking }
  | null

const bookingStatus: Record<string, { en: string; zh: string; tone: Tone }> = {
  awaiting_deposit: { en: 'Awaiting deposit', zh: '待付订金', tone: 'pending' },
  payment_claimed: { en: 'Payment recorded', zh: '已记录付款', tone: 'pending' },
  deposit_verified: { en: 'Deposit verified', zh: '订金已核实', tone: 'ok' },
  confirmed: { en: 'Confirmed', zh: '已确认', tone: 'ok' },
  completed: { en: 'Completed', zh: '已完成', tone: 'ok' },
  refund_flagged: { en: 'Refund review', zh: '退款审核', tone: 'bad' },
  cancelled: { en: 'Cancelled', zh: '已取消', tone: 'neutral' },
  eligibility_declined: { en: 'Withdrawn', zh: '已退出', tone: 'neutral' },
  expired: { en: 'Expired', zh: '已过期', tone: 'neutral' },
}
const ledgerTone: Record<string, Tone> = { earned: 'ok', redeemed: 'pending', expired: 'neutral', reversed: 'neutral' }
const paymentKind: Record<string, { en: string; zh: string }> = {
  deposit: { en: 'Deposit', zh: '订金' }, balance: { en: 'Balance', zh: '尾款' }, full: { en: 'Full', zh: '全款' }, refund: { en: 'Refund', zh: '退款' },
}
const declarationLabels: Record<string, [string, string]> = {
  certAgency: ['Certification agency', '认证机构'],
  certLevel: ['Certification level', '认证级别'],
  agencyOther: ['Other agency', '其他机构'],
  levelOther: ['Other level', '其他级别'],
  loggedDives: ['Logged dives', '累计潜水次数'],
  insurance: ['Insurance', '保险'],
  medical: ['Medical conditions', '健康状况'],
  emergencyName: ['Emergency contact', '紧急联系人'],
  emergencyPhone: ['Emergency phone', '紧急联系电话'],
  dob: ['Date of birth', '出生日期'],
  whatsapp: ['WhatsApp', 'WhatsApp'],
  termsVersionId: ['Terms version', '条款版本'],
  locale: ['Language', '语言'],
}
const PAST_STATUSES = ['completed', 'cancelled', 'eligibility_declined', 'expired']
const CAP = 5
const BOOKINGS_CAP = 10
const HASH_TAB: Record<string, Tab> = {
  requests: 'actions', record: 'actions', verify: 'actions', inquiries: 'actions', refunds: 'actions', completions: 'actions',
  bookings: 'trips', trips: 'trips',
  finance: 'money', points: 'money', receipts: 'money',
  policies: 'settings', settings: 'settings',
}

function Fold({ id, icon, title, count, open, help, children }: { id?: string; icon?: string; title: string; count?: number; open?: boolean; help?: ReactNode; children: ReactNode }) {
  return <details id={id} className="portal-fold" open={open}>
    <summary className="portal-fold-head">
      {icon && <img className="portal-fold-icon" src={icon} alt="" width={20} height={20} />}
      <h2>{title}</h2>
      {count ? <span className="portal-fold-count">{count}</span> : null}
      <span className="portal-fold-chevron" aria-hidden="true" />
    </summary>
    <div className="portal-fold-body">
      {help && <div className="portal-fold-help">{help}</div>}
      {children}
    </div>
  </details>
}

export default function PortalView({ data, updates }: { data: Data; updates?: ReactNode }) {
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('actions')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'past' | 'all'>('active')
  const [tripFilter, setTripFilter] = useState('all')
  const [showAllBookings, setShowAllBookings] = useState(false)
  const [showAllLedger, setShowAllLedger] = useState(false)
  const [savedReceipt, setSavedReceipt] = useState<{ bookingId: string; url: string } | null>(null)
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const label = (m: Record<string, { en: string; zh: string }>, key: string) => { const v = m[key]; return v ? t(v.en, v.zh) : key }
  const tone = (m: Record<string, { tone: Tone }>, key: string) => m[key]?.tone ?? 'neutral'
  const money = (currency: string, amount: string) => `${currency} ${Number(amount).toFixed(2)}`
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const tripName = (b: { tripTitle: { en: string; zh: string } | null; productId?: string }) => b.tripTitle ? t(b.tripTitle.en, b.tripTitle.zh) : (b.productId ?? '')
  const diverName = (bookingId: string) => data.manifest.find(b => b.id === bookingId)?.customerName ?? bookingId
  const bookingOption = (b: Booking) => `${b.customerName} · ${tripName(b)} · ${b.id}`
  const closeDialog = () => setDialog(null)
  const requests = data.manifest.flatMap(booking => {
    const summary = booking.summary
    const next = summary?.stages.find(s => s.id === summary.nextStageId)
    return ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed'].includes(booking.status) &&
      booking.eligibilityStatus !== 'declined' && summary && next?.dueDate ? [{ booking, summary, next, dueDate: next.dueDate }] : []
  }).sort((a, b) => Number(b.next.state === 'overdue') - Number(a.next.state === 'overdue') ||
    a.dueDate.localeCompare(b.dueDate) || a.booking.id.localeCompare(b.booking.id))
  const redemptionOptions = data.manifest.flatMap(b => b.redemption ? [{ id: b.id, label: bookingOption(b), currency: b.currency, redemption: b.redemption }] : [])
  const correctionSources = data.receipts.filter(p => p.kind !== 'refund' && p.refundableMinor > 0)
  const receiptLink = (p: Data['receipts'][number]) => <a href={'/receipt/' + encodeURIComponent(p.id)}>{p.kind === 'refund' ? t('Refund', '退款') : t('Payment', '收款')} · {p.paidOn && p.paidOn + ' · '}{p.kind === 'refund' ? '−' : ''}{money(p.currency, p.amount)} · {t('Receipt', '凭证')} {p.number}</a>
  const newInquiries = data.queue.filter(i => i.status === 'new')
  const refundBookings = data.manifest.filter(b => (b.summary?.refundOutstandingMinor??0)>0)
  const now = Date.now()
  const completionTrips = data.trips
    .filter(tr => tr.travelEnd && new Date(tr.travelEnd).getTime() <= now && !['draft', 'cancelled'].includes(tr.status))
    .map(tr => ({ trip: tr, divers: data.manifest.filter(b => b.productId === tr.id && b.status === 'confirmed' && b.eligibilityStatus !== 'declined') }))
    .filter(g => g.divers.length > 0)
  const completionsCount = completionTrips.reduce((s, g) => s + g.divers.length, 0)
  const actionsCount = requests.length + newInquiries.length + refundBookings.length + completionsCount
  const upcomingTrips = data.trips.filter(tr => !tr.travelEnd || new Date(tr.travelEnd).getTime() > now)
  const activeBookings = data.manifest.filter(b => !PAST_STATUSES.includes(b.status))
  const filteredBookings = data.manifest.filter(b =>
    (statusFilter === 'all' || (statusFilter === 'past' ? PAST_STATUSES.includes(b.status) : !PAST_STATUSES.includes(b.status))) &&
    (tripFilter === 'all' || b.productId === tripFilter))
  const visibleBookings = showAllBookings ? filteredBookings : filteredBookings.slice(0, BOOKINGS_CAP)
  const visibleLedger = showAllLedger ? data.ledger : data.ledger.slice(0, CAP)
  const empty = (en: string, zh: string, subEn: string, subZh: string) => <div className="portal-empty"><h3>{t(en, zh)}</h3><p>{t(subEn, subZh)}</p></div>
  const badge = (text: string, tn: Tone) => <span className={`status-badge tone-${tn}`}>{text}</span>
  const declarationValue = (v: unknown) => typeof v === 'boolean' ? t(v ? 'Yes' : 'No', v ? '是' : '否') : v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)

  // Deep links (/portal#verify etc.) open the owning tab, then scroll.
  useEffect(() => {
    const h = window.location.hash.replace('#', '')
    if (HASH_TAB[h]) {
      setTab(HASH_TAB[h])
      requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView())
    }
  }, [])

  const tabs: [Tab, string, string, number | null, string][] = [
    ['actions', 'Actions', '待办事项', actionsCount, '/assets/icons/ui-dive-flag.webp'],
    ['trips', 'Trips', '行程', upcomingTrips.length, '/assets/icons/ui-compass.webp'],
    ['money', 'Money', '财务', null, '/assets/icons/ui-pearl.webp'],
    ['settings', 'Settings', '设置', null, '/assets/icons/ui-anchor.webp'],
  ]
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0]
    setTab(next)
    document.getElementById(`portal-tab-${next}`)?.focus()
  }

  // One compact row per booking — shared by trip manifests and the All
  // bookings list. Viewing (Info / Equipment) and one-time actions (Complete /
  // Withdraw) open dialogs; the row itself stays a single line + meta.
  const bookingRow = (row: PortalBookingRow, anchor = false) => {
    const b = row as Booking
    return <article key={b.id} id={anchor === true ? `booking-${b.id}` : undefined} className="portal-booking-compact">
    <div className="portal-booking-compact-head">
      <h3>{b.customerName}</h3>
      {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
      {b.sample && badge(t('Sample', '示例'), 'neutral')}
      <span className="portal-row-buttons">
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => setDialog({ kind: 'declarations', booking: b })}>{t('Info', '资料')}</button>
        {b.equipment ? <button type="button" className="btn btn-secondary btn-compact" onClick={() => setDialog({ kind: 'equipment', booking: b })}>{t('Equipment', '装备')}</button> : null}
        {b.redemption && <button type="button" className="btn btn-secondary btn-compact" onClick={() => setDialog({ kind: 'redeem', bookingId: b.id })}>{t('Apply points', '抵扣积分')}</button>}
        {completionTrips.some(group => group.divers.some(diver => diver.id === b.id)) && <button type="button" className="btn btn-secondary btn-compact" disabled={b.summary?.outstandingMinor!==0||!!b.pendingChange} onClick={() => setDialog({ kind: 'complete', booking: b })}>{b.pendingChange?t('Date decision pending','待确认改期'):b.summary?.outstandingMinor ? t('Unpaid','待付')+' '+money(b.currency,String(b.summary.outstandingMinor/100)):t('Complete','完成')}</button>}
        {b.status==='completed'&&correctionSources.some(p=>p.bookingId===b.id)&&<button type="button" className="btn btn-secondary btn-compact" onClick={()=>setDialog({kind:'correction',booking:b})}>{t('Record a correction refund','登记更正退款')}</button>}
        {b.pendingChange&&!PAST_STATUSES.includes(b.status)&&<button type="button" className="btn btn-secondary btn-compact" onClick={()=>setDialog({kind:'postponement',booking:b})}>{t('Record date decision','记录改期选择')}</button>}
        {!PAST_STATUSES.includes(b.status) && <button type="button" className="btn btn-secondary btn-compact" onClick={() => setDialog({ kind: 'withdraw', booking: b })}>{t('Cancel booking', '取消预订')}</button>}
      </span>
    </div>
    <p className="portal-booking-meta">{tripName(b)} · {b.id}</p>
    {b.summary && <details className="portal-payment-history"><summary>{t('Payment schedule', '付款安排')} · {b.status === 'completed' ? t('Net received', '实收净额') : t('Outstanding', '待付')} {money(b.currency, String((b.status === 'completed' ? b.summary.netReceivedMinor : b.summary.outstandingMinor) / 100))}</summary>
      <PaymentSchedule summary={b.summary} locale={locale} completed={b.status === 'completed'} />
      <ul className="portal-list portal-receipts">{data.receipts.filter(p => p.bookingId === b.id).map(p => <li key={p.id}>{receiptLink(p)}</li>)}</ul>
      <a className="text-link" href={'/invoice/' + encodeURIComponent(b.id)}>{t('View invoice', '查看发票')}</a>
    </details>}
  </article>
  }

  const dialogTitle = dialog === null ? '' : ({
    amount: t('Record payment', '登记收款'),
    postponement:t('Record a postponement decision','记录改期选择'),
    correction:t('Record a correction refund','登记更正退款'),
    withdraw: t('Cancel booking', '取消预订'),
    complete: t('Mark completed', '标记完成'),
    refund: t('Record external refund', '记录外部退款'),
    redeem: t('Redeem Okim Points', '抵扣 Okim 积分'),
    declarations: t('Self-declared information', '自行申报资料'),
    equipment: t('Equipment planning', '装备计划'),
  } as Record<string, string>)[dialog.kind]

  const dialogContext = (b: Booking) => <p className="portal-dialog-context">{b.customerName} · {tripName(b)} · {b.id}</p>

  return <main className="ocean-journey portal" data-locale-managed><div className="container">
    <header className="portal-head">
      <AccountHeading title={t('Instructor portal', '教练工作台')} logoutLabel={t('Log out', '退出登录')} />
    </header>
    <div className="portal-tabs" role="tablist" aria-label={t('Portal sections', '工作台栏目')}>
      {tabs.map(([id, en, zh, count, icon], i) => <button
        key={id} type="button" role="tab" id={`portal-tab-${id}`} className="portal-tab"
        aria-selected={tab === id} aria-controls={`portal-panel-${id}`} tabIndex={tab === id ? 0 : -1}
        onClick={() => setTab(id)} onKeyDown={e => onTabKey(e, i)}>
        <img className="portal-tab-icon" src={icon} alt="" width={20} height={20} />
        {t(en, zh)}{count !== null && <span className="portal-tab-count">{count}</span>}
      </button>)}
    </div>

    {savedReceipt && <p className="portal-payment-confirmation" role="status">{t('Payment recorded', '收款已登记')} · {savedReceipt.bookingId} · <a className="text-link" href={savedReceipt.url}>{t('View receipt', '查看收据')}</a></p>}
    {/* ---------- ACTIONS ---------- */}
    <section id="portal-panel-actions" role="tabpanel" aria-labelledby="portal-tab-actions" hidden={tab !== 'actions'}>
      {actionsCount === 0 ? empty('All caught up', '全部处理完毕', 'No payments, refunds, completions or inquiries waiting for you.', '暂无待处理的付款、退款、完成标记或咨询。') : <>
        <Fold id="requests" icon="/assets/icons/ui-dive-flag.webp" title={t('Payments to receive', '待收款项')} count={requests.length} open={requests.length > 0}>
          {requests.length === 0 ? <p className="portal-hint">{t('No outstanding payments.', '暂无待收款项。')}</p> : requests.map(({ booking: b, summary, next }) => {
            return <article key={b.id} className="portal-booking-compact portal-request">
              <div className="portal-booking-compact-head">
                <h3>{b.customerName}</h3>
                {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
                {b.sample && badge(t('Sample', '示例'), 'neutral')}
              </div>
              <p className="portal-booking-meta">{tripName(b)} · {b.id}</p>
              <PaymentSchedule summary={summary} locale={locale} />
              <p className="portal-booking-meta">{t('Next payment', '下一笔应付')} · {next.kind === 'final' ? t('Final payment', '尾款') : t('Deposit ', '订金 ') + next.position} · {money(b.currency, (next.outstandingMinor / 100).toFixed(2))} · {next.dueDate}{next.state === 'overdue' && <> · {t('Overdue', '已逾期')}</>}</p>
              <div className="portal-request-actions">
                <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'amount', booking: b })}>{t('Record payment', '登记收款')}</button>
                {b.redemption && <button type="button" className="btn btn-secondary btn-compact" onClick={() => setDialog({ kind: 'redeem', bookingId: b.id })}>{t('Apply points', '抵扣积分')}</button>}
                <button type="button" className="btn btn-secondary btn-compact" onClick={() => setDialog({ kind: 'withdraw', booking: b })}>{t('Cancel booking', '取消预订')}</button>
              </div>
            </article>
          })}
        </Fold>

        {refundBookings.length > 0 && <Fold id="refunds" title={t('Refunds to record', '待记录退款')} count={refundBookings.length} open
          help={<CardHelp id="refunds-help" label={t('Help: refunds', '帮助：退款')}>
            <p>{t('These cancelled bookings have a refund outstanding. Record the amount here after the bank transfer.', '这些已取消的预订尚需退款。完成银行转账后，请在此登记金额。')}</p>
          </CardHelp>}>
          {refundBookings.map(b => {
            return <article key={b.id} className="portal-booking-compact">
              <div className="portal-booking-compact-head">
                <h3>{b.customerName}</h3>
                {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
                {b.sample && badge(t('Sample', '示例'), 'neutral')}
                <span className="portal-row-buttons">
                  <button type="button" className="btn btn-primary btn-compact" onClick={() => setDialog({ kind: 'refund', booking:b })}>{t('Record refund', '记录退款')}</button>
                </span>
              </div>
              <p className="portal-booking-meta">{tripName(b)} · {b.id}</p>
              <PaymentSchedule summary={b.summary!} locale={locale} />
              <p>{t('Deposits retained', '保留订金')} {money(b.currency, String((b.summary!.netReceivedMinor - b.summary!.refundOutstandingMinor) / 100))}</p>
            </article>
          })}
        </Fold>}

        {completionTrips.length > 0 && <Fold id="completions" title={t('Completions to mark', '待标记完成')} count={completionsCount} open
          help={<CardHelp id="completions-help" label={t('Help: completions', '帮助：完成标记')}>
            <p>{t('These trips have ended. Mark each diver who actually participated — points award once on individual completion (1 per RM1 net verified cash). Closing the trip itself awards nothing.', '这些行程已结束。为实际参加的潜水员逐一标记完成——积分在个人完成时一次性发放（每 RM1 净核实现金 1 分）。结束行程本身不发放积分。')}</p>
          </CardHelp>}>
          {completionTrips.map(({ trip, divers }) => <section key={trip.id} className="portal-completion-group">
            <h3>{t(trip.titleEn, trip.titleZh)} <span className="portal-completion-meta">{date(trip.travelStart!)} – {date(trip.travelEnd!)} · {trip.completedCount}/{trip.bookingCount} {t('completed', '已完成')}</span></h3>
            {divers.map(b => <div key={b.id} className="portal-completion-row">
              <span>{b.customerName} · {b.id}</span>
              <button type="button" className="btn btn-secondary btn-compact" disabled={b.summary?.outstandingMinor!==0||!!b.pendingChange} onClick={() => setDialog({ kind: 'complete', booking: b })}>{b.pendingChange?t('Date decision pending','待确认改期'):b.summary?.outstandingMinor ? t('Unpaid','待付')+' '+money(b.currency,String(b.summary.outstandingMinor/100)):t('Mark completed','标记完成')}</button>
            </div>)}
          </section>)}
        </Fold>}

        <Fold id="inquiries" icon="/assets/icons/ui-contact.webp" title={t('Inquiries & interest', '咨询与意向')} count={newInquiries.length} open={newInquiries.length > 0}
          help={<CardHelp id="inquiries-help" label={t('Help: inquiries', '帮助：咨询')}>
            <p>{t('Messages from the website contact form, plus Register-interest entries when a trip is full.', '来自网站联系表单的留言，以及行程满员时的「登记意向」。')}</p>
            <ol>
              <li>{t('Read the message and reply to the diver by email or WhatsApp.', '阅读留言，通过电子邮件或 WhatsApp 回复潜水员。')}</li>
              <li>{t('Once answered, press mark handled to clear it from this queue.', '回复后，按下标记已处理，将其从此队列清除。')}</li>
            </ol>
          </CardHelp>}>
          {newInquiries.length === 0 ? <p className="portal-hint">{t('Inbox zero — no new contact-form inquiries.', '咨询已清空——暂无新的联系表单咨询。')}</p> : <ul className="portal-list">
            {newInquiries.map(i => <li key={i.id}><form action={handleInquiry} className="portal-row portal-inquiry">
              <div className="portal-row-main">
                <strong>{i.name}</strong>
                {i.interest === 'trip' && i.tripTitle && badge(t(`Interested in: ${t(i.tripTitle.en, i.tripTitle.zh)}`, `有意参加：${t(i.tripTitle.en, i.tripTitle.zh)}`), 'pending')}
                {i.interest === 'course' && badge(t('Course inquiry', '课程咨询'), 'neutral')}
                <span className="portal-row-sub">{i.message}</span>
              </div>
              <input type="hidden" name="inquiryId" value={i.id} />
              <button className="btn btn-secondary">{t('Mark handled', '标记已处理')}</button>
            </form></li>)}
          </ul>}
        </Fold>


      </>}
    </section>

    {/* ---------- TRIPS ---------- */}
    <section id="portal-panel-trips" role="tabpanel" aria-labelledby="portal-tab-trips" hidden={tab !== 'trips'}>
      <PortalTrips trips={data.trips} manifest={data.manifest} renderBooking={bookingRow} />

      <Fold id="bookings" icon="/assets/icons/ui-diver.webp" title={t('All bookings', '全部预订')} count={activeBookings.length}
        help={<CardHelp id="bookings-help" label={t('Help: all bookings', '帮助：全部预订')}>
          <p>{t('Look up bookings across trips. Info opens the diver’s self-declared details.', '在此查询各行程的预订。「资料」可查看潜水员自行申报的信息。')}</p>
        </CardHelp>}>
        <p className="portal-hint">{t('Booking references (BKG-…) double as the bank transfer reference. Information is self-declared under the diver\u2019s truthfulness disclaimer.', '预订编号（BKG-…）同时用作银行转账备注。资料由潜水员按真实性声明自行申报。')}</p>
        <div className="portal-bookings-filters">
          <div className="kind-pills" role="radiogroup" aria-label={t('Filter bookings by status', '按状态筛选预订')}>
            {([['active', 'Active', '进行中'], ['past', 'Past', '已结束'], ['all', 'All', '全部']] as const).map(([value, en, zh]) => <label key={value} className="kind-pill"><input type="radio" name="booking-status-filter" checked={statusFilter === value} onChange={() => { setStatusFilter(value); setShowAllBookings(false) }} /><span>{t(en, zh)}</span></label>)}
          </div>
          <label className="portal-trip-filter">{t('Trip', '行程')}
            <select value={tripFilter} onChange={e => { setTripFilter(e.target.value); setShowAllBookings(false) }}>
              <option value="all">{t('All trips', '全部行程')}</option>
              {data.trips.map(tr => <option key={tr.id} value={tr.id}>{t(tr.titleEn, tr.titleZh)}</option>)}
            </select>
          </label>
        </div>
        {filteredBookings.length === 0 ? empty('No bookings here', '此筛选下暂无预订', 'Adjust the filters, or wait for divers to book.', '调整筛选条件，或等待潜水员预订。') : visibleBookings.map(b => bookingRow(b, true))}
        {filteredBookings.length > BOOKINGS_CAP && !showAllBookings && <button type="button" className="btn btn-secondary portal-show-all" onClick={() => setShowAllBookings(true)}>{t(`Show all ${filteredBookings.length} bookings`, `显示全部 ${filteredBookings.length} 个预订`)}</button>}
      </Fold>

      <Fold id="updates" title={t('Diver updates', '潜水员更新')}>
        {updates}
      </Fold>
    </section>

    {/* ---------- MONEY ---------- */}
    <section id="portal-panel-money" role="tabpanel" aria-labelledby="portal-tab-money" hidden={tab !== 'money'}>
      <Fold id="finance" icon="/assets/icons/ui-pearl.webp" title={t('Financial operations', '财务操作')} open
        help={<CardHelp id="finance-help" label={t('Help: financial operations', '帮助：财务操作')}>
          <p>{t('Two tools for the moments outside the one-click flow. Trip completion lives in Actions and on each trip card.', '两个工具，用于一键流程之外的节点。行程完成标记在「待办事项」及各行程卡片中。')}</p>
          <ol>
            <li>{t('External refund: after you have completed the refund in the bank, record it here against the original payment. Points earned on it are reversed proportionally.', '外部退款：在银行完成退款后，在此对应原付款记录。该付款累积的积分会按比例冲正。')}</li>
            <li>{t('Redeem points: before the diver pays, apply their available points (max 20% of the trip price; only points from completed, unexpired trips).', '抵扣积分：在潜水员付款前应用其可用积分（最高为行程价格的 20%；仅限已完成行程且未过期的积分）。')}</li>
          </ol>
        </CardHelp>}>
        <div className="portal-money-actions">
          <button type="button" className="btn btn-secondary" disabled={!redemptionOptions.length} onClick={() => setDialog({ kind: 'redeem' })}>{t('Redeem Okim Points', '抵扣 Okim 积分')}</button>
          {!redemptionOptions.length && <p className="portal-hint">{t('No bookings have points available to apply.', '目前没有可抵扣积分的预订。')}</p>}
        </div>
      </Fold>

      <Fold id="receipts" title={t('Payments and refunds', '收款与退款')} count={data.receipts.length}>
        {data.receipts.length === 0 ? <p className="portal-hint">{t('Receipts appear here after verification.', '核实付款后，收据将显示在此处。')}</p> : <ul className="portal-list portal-receipts">
          {data.receipts.map(p => <li key={p.id}>{p.bookingId} · {diverName(p.bookingId)} · {receiptLink(p)}</li>)}
        </ul>}
      </Fold>

      <Fold id="points" title={t('Okim Points ledger', 'Okim 积分明细')} count={data.ledger.length}
        help={<CardHelp id="points-help" label={t('Help: Okim Points ledger', '帮助：Okim 积分明细')}>
          <p>{t('Read-only audit trail — no action needed here unless a diver asks about their balance.', '只读的审计明细——除非潜水员查询余额，否则无需在此操作。')}</p>
          <ol>
            <li>{t('Award once on individual booking completion: 1 point per RM1 of net verified cash, excluding refunds and points discounts. Payment verification earns nothing.', '个人预订完成时一次性发放积分：每 RM1 净核实现金付款得 1 分，不含退款及积分抵扣。核实付款不获积分。')}</li>
            <li>{t('New awards are immediately usable and expire 12 calendar months from individual completion. Legacy history retains its original rules and expiry.', '新积分发放后即可使用，自个人预订完成日起 12 个日历月后过期。旧记录保留原规则及到期日。')}</li>
            <li>{t('The ledger is append-only: corrections appear as reversal entries, never edits.', '明细只增不改：更正以冲正记录呈现，绝不直接修改。')}</li>
          </ol>
        </CardHelp>}>
        <p className="portal-hint">{t('Append-only ledger. New awards are immediately usable and expire 12 calendar months from individual booking completion. Legacy points retain their original expiry dates.', '明细只增不改。新积分发放后即可使用，自个人预订完成之日起满 12 个日历月后过期。旧积分保留原到期日。')}</p>
        {data.ledger.length === 0 ? empty('No points activity yet', '暂无积分记录', 'Individual booking completion awards points once', '个人预订完成后一次性发放积分。') : <table className="portal-table">
          <thead><tr><th>{t('Customer', '客户')}</th><th>{t('Type', '类型')}</th><th>{t('Points', '积分')}</th><th>{t('RM amount', 'RM 金额')}</th><th>{t('Rate snapshot', '汇率快照')}</th></tr></thead>
          <tbody>{visibleLedger.map(e => <tr key={e.id}>
            <td data-label={t('Customer', '客户')}>{e.customerName}</td>
            <td data-label={t('Type', '类型')}>{badge(t(e.type, { earned: '已累积', redeemed: '已抵扣', expired: '已过期', reversed: '已冲正' }[e.type] ?? e.type), ledgerTone[e.type] ?? 'neutral')}</td>
            <td data-label={t('Points', '积分')}>{e.points}</td>
            <td data-label={t('RM amount', 'RM 金额')}>RM {Number(e.rmAmount).toFixed(2)}</td>
            <td data-label={t('Rate snapshot', '汇率快照')}>{e.rateSnapshot}</td>
          </tr>)}</tbody>
        </table>}
        {data.ledger.length > CAP && !showAllLedger && <button type="button" className="btn btn-secondary portal-show-all" onClick={() => setShowAllLedger(true)}>{t(`Show all ${data.ledger.length} entries`, `显示全部 ${data.ledger.length} 条记录`)}</button>}
      </Fold>
    </section>

    {/* ---------- SETTINGS ---------- */}
    <section id="portal-panel-settings" role="tabpanel" aria-labelledby="portal-tab-settings" hidden={tab !== 'settings'}>
      <PortalPolicies policies={data.policies} />
      <PortalSettings data={data.settings} />
    </section>

    {/* ---------- DIALOGS (one-time actions + viewing, V8) ---------- */}
    <PortalDialog open={dialog !== null} pending={paymentSaving} title={dialogTitle} closeLabel={t('Close', '关闭')} onClose={closeDialog}>
      {dialog?.kind === 'amount' && dialog.booking.summary && dialog.booking.paymentToday && <RecordPaymentDialog
        summary={dialog.booking.summary} today={dialog.booking.paymentToday} locale={locale}
        context={dialogContext(dialog.booking)} onSave={url => { setSavedReceipt({ bookingId: dialog.booking.id, url }); closeDialog() }} onClose={closeDialog} onPendingChange={setPaymentSaving} />}
      {dialog && (dialog.kind==='withdraw'||dialog.kind==='refund'||dialog.kind==='correction'||dialog.kind==='postponement') && dialog.booking.summary && <>
        {dialogContext(dialog.booking)}
        <BookingLifecycleForm key={dialog.kind+dialog.booking.id} mode={dialog.kind==='withdraw'?'cancel':dialog.kind} summary={dialog.booking.summary}
          change={dialog.booking.pendingChange} sources={correctionSources.filter(p=>p.bookingId===dialog.booking.id)} today={dialog.booking.paymentToday!}
          locale={locale} close={closeDialog} onPending={setPaymentSaving}/>
      </>}
      {dialog?.kind === 'complete' && <FinancialActionForm action={completeBooking} close={closeDialog} locale={locale}
        onPending={setPaymentSaving} confirm={t('Mark completed', '标记完成')}>
        <input type="hidden" name="bookingId" value={dialog.booking.id} />
        <div className="span-2">{dialogContext(dialog.booking)}</div>
        <p className="portal-hint span-2">{t('Points are awarded once for verified net payments when you confirm participation.', '确认参加后，系统会按已核实的净付款一次性发放积分。')}</p>
        <label className="portal-complete span-2"><input type="checkbox" name="participated" required />{t('This diver completed the trip', '这位潜水员已完成行程')}</label>
      </FinancialActionForm>}
      {dialog?.kind === 'redeem' && <BookingPointsForm options={redemptionOptions} bookingId={dialog.bookingId}
        locale={locale} close={closeDialog} onPending={setPaymentSaving} />}
      {dialog?.kind === 'declarations' && <div>
        {dialogContext(dialog.booking)}
        <dl className="portal-declarations-grid">{Object.entries(dialog.booking.declarations).map(([k, v]) => <div key={k}><dt>{declarationLabels[k] ? t(declarationLabels[k][0], declarationLabels[k][1]) : k}</dt><dd>{declarationValue(v)}</dd></div>)}</dl>
        <p className="portal-fineprint">{t('Self-declared by the diver under the truthfulness disclaimer — true, complete and accurate at registration; the diver must tell Iris immediately on change.', '由潜水员按真实性声明自行申报——登记时真实、完整、准确；如有变更须立即告知 Iris。')}</p>
      </div>}
      {dialog?.kind === 'equipment' && <div>
        {dialogContext(dialog.booking)}
        <EquipmentSummary value={dialog.booking.equipment} />
        <p className="portal-fineprint">{t('Indication only — subject to dive-shop availability. No reservations or pricing here.', '仅供参考——以潜店实际供应为准。此处不涉及预订或价格。')}</p>
      </div>}
    </PortalDialog>
  </div></main>
}
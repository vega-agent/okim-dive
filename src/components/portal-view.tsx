'use client'
// Portal redesign (2026-11-22, owner decisions in OPC/PORTAL-REDESIGN-PLAN.md):
// 4 action-first tabs replace the 9-section stack. Actions = the demo flow
// (queue first), Bookings = compact capped rows with filters, Money = receipts
// + financial ops + ledger, Manage = trips/policies/settings. Identifiers are
// explained once; payment UUIDs are never displayed (DESIGN-SYSTEM §13/§14).
import { useEffect, useState, type ReactNode } from 'react'
import { useLocale } from '@/lib/use-locale'
import { verifyPayment, withdrawBooking, completeBooking, handleInquiry, refundPayment, redeemPoints } from '@/lib/portal-actions'
import { confirmReceived, extendHold, releaseHold } from '@/lib/seamless-actions'
import CardHelp from '@/components/portal-card-help'
import PortalTrips, { type PortalTrip } from '@/components/portal-trips'
import PortalSettings, { type PortalSettingsData } from '@/components/portal-settings'
import PortalPolicies, { type PortalPolicy } from '@/components/portal-policies'

type Booking = { id: string; productId: string; status: string; eligibilityStatus: string; currency: string; depositAmount: string | null; balanceAmount: string | null; holdExpiresAt: string | null; balanceDueAt: string | null; customerName: string; tripTitle: { en: string; zh: string } | null; sample: boolean; declarations: Record<string, unknown> }
type Data = {
  manifest: Booking[]
  claims: { id: string; bookingId: string; amount: string; currency: string; status: string; kind: string; paidOn: string; reference: string }[]
  receipts: { id: string; bookingId: string; receiptNo: string | null; amount: string; currency: string; kind: string }[]
  queue: { id: string; name: string; message: string; status: string }[]
  ledger: { id: string; customerId: string; customerName: string; type: string; points: number; rmAmount: string; rateSnapshot: string }[]
  trips: PortalTrip[]
  settings: PortalSettingsData
  policies: PortalPolicy[]
}

type Tone = 'pending' | 'ok' | 'bad' | 'neutral'
type Tab = 'actions' | 'bookings' | 'money' | 'manage'
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
  requests: 'actions', record: 'actions', verify: 'actions', inquiries: 'actions',
  bookings: 'bookings', finance: 'money', points: 'money',
  trips: 'manage', policies: 'manage', settings: 'manage',
}

export default function PortalView({ data, updates }: { data: Data; updates?: ReactNode }) {
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('actions')
  const [statusFilter, setStatusFilter] = useState<'active' | 'past' | 'all'>('active')
  const [tripFilter, setTripFilter] = useState('all')
  const [showAllBookings, setShowAllBookings] = useState(false)
  const [showAllLedger, setShowAllLedger] = useState(false)
  const [operationKey] = useState(() => crypto.randomUUID())
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const label = (m: Record<string, { en: string; zh: string }>, key: string) => { const v = m[key]; return v ? t(v.en, v.zh) : key }
  const tone = (m: Record<string, { tone: Tone }>, key: string) => m[key]?.tone ?? 'neutral'
  const money = (currency: string, amount: string) => `${currency} ${Number(amount).toFixed(2)}`
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const tripName = (b: Booking) => b.tripTitle ? t(b.tripTitle.en, b.tripTitle.zh) : b.productId
  const diverName = (bookingId: string) => data.manifest.find(b => b.id === bookingId)?.customerName ?? bookingId
  const bookingOption = (b: Booking) => `${b.customerName} · ${tripName(b)} · ${b.id}`
  const pendingClaims = data.claims.filter(c => c.status === 'pending')
  // S1: the booking request itself carries the payment expectation. Expected =
  // remaining deposit, then remaining balance; bookings with a pending recorded
  // claim stay in the legacy verify queue instead (no double recording).
  const cashOf = (id: string) => data.receipts.filter(p => p.bookingId === id).reduce((s, p) => s + (p.kind === 'refund' ? -1 : 1) * Number(p.amount), 0)
  const expected = (b: Booking) => {
    const cash = cashOf(b.id)
    const deposit = Number(b.depositAmount ?? 0)
    const price = deposit + Number(b.balanceAmount ?? 0)
    return cash < deposit ? { kind: 'deposit', amount: deposit - cash } : { kind: 'balance', amount: price - cash }
  }
  const requests = data.manifest.filter(b => ['awaiting_deposit', 'payment_claimed', 'deposit_verified', 'confirmed'].includes(b.status)
    && expected(b).amount > 0 && !pendingClaims.some(c => c.bookingId === b.id)
    && (expected(b).kind === 'deposit' || (b.balanceDueAt && new Date(b.balanceDueAt) <= new Date())))
  const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
  const verifiedPayments = data.receipts.filter(p => p.kind !== 'refund')
  const newInquiries = data.queue.filter(i => i.status === 'new')
  const activeBookings = data.manifest.filter(b => !PAST_STATUSES.includes(b.status))
  const filteredBookings = data.manifest.filter(b =>
    (statusFilter === 'all' || (statusFilter === 'past' ? PAST_STATUSES.includes(b.status) : !PAST_STATUSES.includes(b.status))) &&
    (tripFilter === 'all' || b.productId === tripFilter))
  const visibleBookings = showAllBookings ? filteredBookings : filteredBookings.slice(0, BOOKINGS_CAP)
  const visibleLedger = showAllLedger ? data.ledger : data.ledger.slice(0, CAP)
  const kinds = [['deposit', 'Deposit', '订金'], ['balance', 'Balance', '尾款'], ['full', 'Full payment', '全款']] as const
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
    ['actions', 'Actions', '待办事项', requests.length + pendingClaims.length + newInquiries.length, '/assets/icons/ui-dive-flag.webp'],
    ['bookings', 'Bookings', '预订名单', activeBookings.length, '/assets/icons/ui-diver.webp'],
    ['money', 'Money', '财务', null, '/assets/icons/ui-pearl.webp'],
    ['manage', 'Manage', '管理', null, '/assets/icons/ui-compass.webp'],
  ]
  const onTabKey = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0]
    setTab(next)
    document.getElementById(`portal-tab-${next}`)?.focus()
  }

  const bookingRow = (b: Booking) => <article key={b.id} id={`booking-${b.id}`} className="portal-booking-compact">
    <div className="portal-booking-compact-head">
      <h3>{b.customerName}</h3>
      {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
      {b.sample && badge(t('Sample', '示例'), 'neutral')}
      {b.status === 'confirmed' && b.eligibilityStatus !== 'declined' && <form action={completeBooking} className="portal-complete">
        <input type="hidden" name="bookingId" value={b.id} />
        <label><input type="checkbox" name="participated" required />{t('This diver completed the booking', '此潜水员已完成个人预订')}</label>
        <button className="btn btn-secondary">{t('Complete individual booking', '完成个人预订')}</button>
      </form>}
      {!PAST_STATUSES.includes(b.status) && <form action={withdrawBooking} className="portal-withdraw">
        <input type="hidden" name="bookingId" value={b.id} />
        <button className="btn btn-secondary">{t('Withdraw', '退出')}</button>
      </form>}
    </div>
    <p className="portal-booking-meta">{tripName(b)} · {b.id}{b.depositAmount ? ` · ${t('Deposit', '订金')} ${money(b.currency, b.depositAmount)}` : ''}</p>
    <details>
      <summary>{t('Self-declared information', '自行申报资料')}</summary>
      <dl className="portal-declarations-grid">{Object.entries(b.declarations).map(([k, v]) => <div key={k}><dt>{declarationLabels[k] ? t(declarationLabels[k][0], declarationLabels[k][1]) : k}</dt><dd>{declarationValue(v)}</dd></div>)}</dl>
    </details>
  </article>

  return <main className="ocean-journey portal" data-locale-managed><div className="container">
    <header className="portal-head">
      <h1>{t('Instructor portal', '教练工作台')}</h1>
      <p className="portal-lede">{t('Confirm payments with one click, manage bookings, and track Okim Points. Evidence stays in WhatsApp.', '一键确认付款、管理预订、追踪 Okim 积分。付款凭证保留在 WhatsApp。')}</p>
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

    {/* ---------- ACTIONS ---------- */}
    <section id="portal-panel-actions" role="tabpanel" aria-labelledby="portal-tab-actions" hidden={tab !== 'actions'}>
      <section id="requests" className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Booking requests', '预订请求')}</h2>
          <CardHelp id="requests-help" label={t('Help: booking requests', '帮助：预订请求')}>
            <p>{t('Each booking holds a slot for 14 days and emails the diver the transfer details. When the money matches your bank app, one click confirms it.', '每个预订保留名额 14 天，系统已邮件通知潜水员转账信息。款项与银行记录吻合后，一键确认。')}</p>
            <ol>
              <li>{t('The diver transfers externally and sends the screenshot via WhatsApp (evidence stays there).', '潜水员通过外部方式转账，并通过 WhatsApp 发送截图（凭证保留在 WhatsApp）。')}</li>
              <li>{t('Match the transfer in your bank app by reference (the booking ID) and amount.', '在银行应用中按转账备注（预订编号）与金额核对款项。')}</li>
              <li>{t('Press Received — the payment is recorded and verified in one act, capacity is re-checked, and the diver gets a confirmation email with the receipt.', '按下「确认到账」——记录与核实一次完成，重新检查名额，潜水员随即收到确认邮件与收据。')}</li>
              <li>{t('Partial or combined payment? Use Different amount. Need more time? Extend. Diver withdrew? Release.', '部分付款或合并付款？用「其他金额」。需要延期？延长。潜水员退出？释放名额。')}</li>
            </ol>
          </CardHelp>
        </div>
        <p className="portal-hint">{t('Received = your bank match. The slot confirms only on this click; if the trip filled meanwhile, the booking is flagged for refund.', '「确认到账」代表你已核对银行记录。名额仅此点击后确认；若期间行程已满，预订将标记退款。')}</p>
        {requests.length === 0 ? empty('All caught up', '全部处理完毕', 'No booking requests waiting for payment.', '暂无待付款的预订请求。') : requests.map(b => {
          const exp = expected(b)
          return <article key={b.id} className="portal-booking-compact portal-request">
            <div className="portal-booking-compact-head">
              <h3>{b.customerName}</h3>
              {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
              {b.sample && badge(t('Sample', '示例'), 'neutral')}
            </div>
            <p className="portal-booking-meta">{tripName(b)} · {b.id} · {label(paymentKind, exp.kind)} {money(b.currency, String(exp.amount))}</p>
            {b.holdExpiresAt && <p className="portal-booking-meta">{t('Transfer by', '转账截止')} {date(b.holdExpiresAt)} · {daysLeft(b.holdExpiresAt)} {t('days left', '天后到期')}</p>}
            <div className="portal-request-actions">
              <form action={confirmReceived}>
                <input type="hidden" name="bookingId" value={b.id} />
                <input type="hidden" name="operationKey" value={`recv-${operationKey}-${b.id}`} />
                <button className="btn btn-primary">{t('Received', '确认到账')}</button>
              </form>
              {b.holdExpiresAt && <form action={extendHold} className="portal-hold-extend">
                <input type="hidden" name="bookingId" value={b.id} />
                <button name="days" value="7" className="btn btn-secondary">+7 {t('days', '天')}</button>
                <button name="days" value="14" className="btn btn-secondary">+14 {t('days', '天')}</button>
              </form>}
            </div>
            <details>
              <summary>{t('Different amount', '其他金额')}</summary>
              <form action={confirmReceived} className="booking-form portal-form">
                <input type="hidden" name="bookingId" value={b.id} />
                <input type="hidden" name="operationKey" value={`recv-esc-${operationKey}-${b.id}`} />
                <label>{t('Amount', '金额')}<input name="amount" type="number" min="0.01" step="0.01" required placeholder={exp.amount.toFixed(2)} /></label>
                <label>{t('Payment kind', '付款类型')}
                  <select name="kind" defaultValue={exp.kind}>
                    {kinds.map(([value, en, zh]) => <option key={value} value={value}>{t(en, zh)}</option>)}
                  </select>
                </label>
                <label>{t('Date paid', '付款日期')}<input name="paidOn" type="date" required max={new Date().toISOString().slice(0, 10)} /></label>
                <button className="btn btn-secondary">{t('Confirm this amount', '确认此金额')}</button>
              </form>
            </details>
            <details>
              <summary>{t('Release slot', '释放名额')}</summary>
              <form action={releaseHold} className="booking-form portal-form">
                <input type="hidden" name="bookingId" value={b.id} />
                <label className="span-2">{t('Reason', '原因')}<input name="reason" required maxLength={200} placeholder={t('e.g. diver withdrew', '例如：潜水员退出')} /></label>
                <button className="btn btn-secondary span-2">{t('Release and email the diver', '释放并邮件通知潜水员')}</button>
              </form>
            </details>
          </article>
        })}
      </section>

      {pendingClaims.length > 0 && <section id="verify" className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Recorded claims', '已记录的付款')}</h2>
          <CardHelp id="verify-help" label={t('Help: recorded claims', '帮助：已记录的付款')}>
            <p>{t('Payments recorded before the one-click flow, awaiting your bank match. Verifying re-checks capacity and issues a receipt.', '一键流程之前记录的付款，等待银行核对。核实时会重新检查名额并开具收据。')}</p>
          </CardHelp>
        </div>
        <ul className="portal-list">
          {pendingClaims.map(c => <li key={c.id}><form action={verifyPayment} className="portal-row">
            <div className="portal-row-main">
              <strong>{diverName(c.bookingId)}</strong>
              {badge(label(paymentKind, c.kind), 'pending')}
              <span className="portal-amount">{money(c.currency, c.amount)}</span>
              <span className="portal-row-sub">{c.bookingId} · {t('Paid', '付款日')} {date(c.paidOn)}{c.reference !== c.bookingId ? ` · ${c.reference}` : ''}</span>
            </div>
            <input type="hidden" name="claimId" value={c.id} />
            <button className="btn btn-secondary">{t('Verify against bank record', '核对银行记录后确认')}</button>
          </form></li>)}
        </ul>
      </section>}

      <section id="inquiries" className="portal-card">
        <div className="portal-card-head">
          <h2>{t('New inquiries', '新咨询')}</h2>
          <CardHelp id="inquiries-help" label={t('Help: new inquiries', '帮助：新咨询')}>
            <p>{t('Messages from the website contact form.', '来自网站联系表单的留言。')}</p>
            <ol>
              <li>{t('Read the message and reply to the diver by email or WhatsApp.', '阅读留言，通过电子邮件或 WhatsApp 回复潜水员。')}</li>
              <li>{t('Once answered, press mark handled to clear it from this queue.', '回复后，按下标记已处理，将其从此队列清除。')}</li>
            </ol>
          </CardHelp>
        </div>
        {newInquiries.length === 0 ? <p className="portal-hint">{t('Inbox zero — no new contact-form inquiries.', '咨询已清空——暂无新的联系表单咨询。')}</p> : <ul className="portal-list">
          {newInquiries.map(i => <li key={i.id}><form action={handleInquiry} className="portal-row portal-inquiry">
            <div className="portal-row-main"><strong>{i.name}</strong><span className="portal-row-sub">{i.message}</span></div>
            <input type="hidden" name="inquiryId" value={i.id} />
            <button className="btn btn-secondary">{t('Mark handled', '标记已处理')}</button>
          </form></li>)}
        </ul>}
      </section>

      {/* Diver updates renders INSIDE main.portal (§14 stacking rule). */}
      {updates}
    </section>

    {/* ---------- BOOKINGS ---------- */}
    <section id="portal-panel-bookings" role="tabpanel" aria-labelledby="portal-tab-bookings" hidden={tab !== 'bookings'}>
      <section id="bookings" className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Trip manifests and eligibility', '行程名单与资格审核')}</h2>
          <CardHelp id="bookings-help" label={t('Help: trip manifests', '帮助：行程名单')}>
            <p>{t('One compact row per booking. Divers self-declare their information under a truthfulness disclaimer — there is no approval step.', '每个预订一行紧凑列表。潜水员按真实性声明自行申报资料——无需审批步骤。')}</p>
            <ol>
              <li>{t('Open a row to read the self-declared information: certification, dive count, medical, and emergency contact (instructor-only).', '展开行查看自行申报资料：证书、潜水次数、健康状况和紧急联系人（仅教练可见）。')}</li>
              <li>{t('Withdraw removes a booking — the diver withdrew or Iris rejects. Paid bookings enter full-refund review; unpaid bookings cancel.', '「退出」移除预订——潜水员退出或 Iris 拒绝。已付款预订进入全额退款审核；未付款预订取消。')}</li>
              <li>{t('Filter by Active/Past or by trip; the list shows 10 rows at a time.', '按进行中/已结束或行程筛选；列表每次显示 10 行。')}</li>
            </ol>
          </CardHelp>
        </div>
        <p className="portal-hint">{t('Booking references (BKG-…) double as the bank transfer reference. Information is self-declared under the diver\u2019s truthfulness disclaimer. Withdraw removes a booking — paid bookings enter refund review.', '预订编号（BKG-…）同时用作银行转账备注。资料由潜水员按真实性声明自行申报。「退出」移除预订——已付款预订进入退款审核。')}</p>
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
        {filteredBookings.length === 0 ? empty('No bookings here', '此筛选下暂无预订', 'Adjust the filters, or wait for divers to book.', '调整筛选条件，或等待潜水员预订。') : visibleBookings.map(bookingRow)}
        {filteredBookings.length > BOOKINGS_CAP && !showAllBookings && <button type="button" className="btn btn-secondary portal-show-all" onClick={() => setShowAllBookings(true)}>{t(`Show all ${filteredBookings.length} bookings`, `显示全部 ${filteredBookings.length} 个预订`)}</button>}
      </section>
    </section>

    {/* ---------- MONEY ---------- */}
    <section id="portal-panel-money" role="tabpanel" aria-labelledby="portal-tab-money" hidden={tab !== 'money'}>
      <section id="finance" className="portal-card portal-finance">
        <div className="portal-card-head">
          <h2>{t('Financial operations', '财务操作')}</h2>
          <CardHelp id="finance-help" label={t('Help: financial operations', '帮助：财务操作')}>
            <p>{t('Two tools for the moments outside the one-click flow. Trip completion lives in Manage → Trips.', '两个工具，用于一键流程之外的节点。行程完成在「管理 → 行程」操作。')}</p>
            <ol>
              <li>{t('External refund: after you have completed the refund in the bank, record it here against the original payment. Points earned on it are reversed proportionally.', '外部退款：在银行完成退款后，在此对应原付款记录。该付款累积的积分会按比例冲正。')}</li>
              <li>{t('Redeem points: before the diver pays, apply their available points (max 20% of the trip price; only points from completed, unexpired trips).', '抵扣积分：在潜水员付款前应用其可用积分（最高为行程价格的 20%；仅限已完成行程且未过期的积分）。')}</li>
            </ol>
          </CardHelp>
        </div>
        <h3 className="portal-subhead span-2">{t('Verified receipts', '已核实收据')}</h3>
        {verifiedPayments.filter(p => p.receiptNo).length === 0 ? <p className="portal-hint span-2">{t('Receipts appear here after verification.', '核实付款后，收据将显示在此处。')}</p> : <ul className="portal-list portal-receipts span-2">
          {verifiedPayments.filter(p => p.receiptNo).map(p => <li key={p.id}><a href={`/receipt/${encodeURIComponent(p.id)}`}>{p.bookingId} · {diverName(p.bookingId)} · {p.receiptNo} · {money(p.currency, p.amount)}</a></li>)}
        </ul>}
        <form action={refundPayment} className="booking-form portal-form">
          <h3 className="span-2">{t('External refund', '外部退款')}</h3>
          <input type="hidden" name="operationKey" value={`refund-${operationKey}`} />
          <label className="span-2">{t('Original payment', '原付款')}
            <select name="paymentId" required defaultValue="">
              <option value="" disabled>{t('Choose a verified payment', '请选择已核实付款')}</option>
              {verifiedPayments.map(p => <option key={p.id} value={p.id}>{p.bookingId} · {diverName(p.bookingId)} · {money(p.currency, p.amount)} · {label(paymentKind, p.kind)}</option>)}
            </select>
          </label>
          <label>{t('Refund amount', '退款金额')}<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label>
          <label>{t('Refund reason', '退款原因')}<input name="reason" required maxLength={200} placeholder={t('e.g. trip filled before verification', '例如：核实前行程已满')} /></label>
          <button className="btn btn-secondary span-2">{t('Record completed external refund', '记录已完成的外部退款')}</button>
        </form>
        <form action={redeemPoints} className="booking-form portal-form">
          <h3 className="span-2">{t('Redeem Okim Points', '抵扣 Okim 积分')}</h3>
          <input type="hidden" name="operationKey" value={`redeem-${operationKey}`} />
          <label>{t('Booking', '预订')}
            <select name="bookingId" required defaultValue="">
              <option value="" disabled>{t('Choose a booking', '请选择预订')}</option>
              {data.manifest.map(b => <option key={b.id} value={b.id}>{bookingOption(b)}</option>)}
            </select>
          </label>
          <label>{t('Whole points to redeem', '抵扣整数积分')}<input name="points" type="number" min="1" step="1" required placeholder="0" /></label>
          <button className="btn btn-secondary span-2">{t('Apply points before payment', '付款前应用积分')}</button>
        </form>
      </section>

      <section id="points" className="portal-card">
        <div className="portal-card-head">
          <h2>{t('Okim Points ledger', 'Okim 积分明细')}</h2>
          <CardHelp id="points-help" label={t('Help: Okim Points ledger', '帮助：Okim 积分明细')}>
            <p>{t('Read-only audit trail — no action needed here unless a diver asks about their balance.', '只读的审计明细——除非潜水员查询余额，否则无需在此操作。')}</p>
            <ol>
              <li>{t('Award once on individual booking completion: 1 point per RM1 of net verified cash, excluding refunds and points discounts. Payment verification earns nothing.', '个人预订完成时一次性发放积分：每 RM1 净核实现金付款得 1 分，不含退款及积分抵扣。核实付款不获积分。')}</li>
              <li>{t('New awards are immediately usable and expire 12 calendar months from individual completion. Legacy history retains its original rules and expiry.', '新积分发放后即可使用，自个人预订完成日起 12 个日历月后过期。旧记录保留原规则及到期日。')}</li>
              <li>{t('The ledger is append-only: corrections appear as reversal entries, never edits.', '明细只增不改：更正以冲正记录呈现，绝不直接修改。')}</li>
            </ol>
          </CardHelp>
        </div>
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
      </section>
    </section>

    {/* ---------- MANAGE ---------- */}
    <section id="portal-panel-manage" role="tabpanel" aria-labelledby="portal-tab-manage" hidden={tab !== 'manage'}>
      <PortalTrips trips={data.trips} />
      <PortalPolicies policies={data.policies} />
      <PortalSettings data={data.settings} />
    </section>
  </div></main>
}

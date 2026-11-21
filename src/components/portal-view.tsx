'use client'
import { useState, type ReactNode } from 'react'
import { useLocale } from '@/lib/use-locale'
import { recordPayment, verifyPayment, reviewEligibility, handleInquiry, refundPayment, redeemPoints, completeBooking } from '@/lib/portal-actions'
import CardHelp from '@/components/portal-card-help'
import PortalTrips, { type PortalTrip } from '@/components/portal-trips'
import PortalSettings, { type PortalSettingsData } from '@/components/portal-settings'
import PortalPolicies, { type PortalPolicy } from '@/components/portal-policies'

type Booking = { id: string; productId: string; status: string; eligibilityStatus: string; currency: string; depositAmount: string | null; customerName: string; tripTitle: { en: string; zh: string } | null; declarations: Record<string, unknown> }
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
const ledgerTone: Record<string, Tone> = { earned: 'ok', redeemed: 'pending', expired: 'neutral', reversed: 'neutral' }

export default function PortalView({ data, updates }: { data: Data; updates?: ReactNode }) {
  const locale = useLocale()
  const [operationKey] = useState(() => crypto.randomUUID())
  const [recordBookingId, setRecordBookingId] = useState('')
  const [kind, setKind] = useState('deposit')
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const label = (m: Record<string, { en: string; zh: string }>, key: string) => { const v = m[key]; return v ? t(v.en, v.zh) : key }
  const tone = (m: Record<string, { tone: Tone }>, key: string) => m[key]?.tone ?? 'neutral'
  const money = (currency: string, amount: string) => `${currency} ${Number(amount).toFixed(2)}`
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const tripName = (b: Booking) => b.tripTitle ? t(b.tripTitle.en, b.tripTitle.zh) : b.productId
  const bookingOption = (b: Booking) => `${b.id} · ${tripName(b)} · ${b.customerName}`
  const selectedBooking = data.manifest.find(b => b.id === recordBookingId)
  const pendingClaims = data.claims.filter(c => c.status === 'pending')
  const verifiedPayments = data.receipts.filter(p => p.kind !== 'refund')
  const newInquiries = data.queue.filter(i => i.status === 'new')
  const kinds = [['deposit', 'Deposit', '订金'], ['balance', 'Balance', '尾款'], ['full', 'Full payment', '全款']] as const
  const nav = [
    ['#record', 'Record payment', '记录付款'],
    ['#verify', 'Verification', '核实付款'],
    ['#bookings', 'Bookings', '预订名单'],
    ['#finance', 'Financial ops', '财务操作'],
    ['#points', 'Points', '积分'],
    ['#inquiries', 'Inquiries', '咨询'],
    ['#trips', 'Trips', '行程管理'],
    ['#policies', 'Policies', '政策版本'],
    ['#settings', 'Settings', '设置'],
  ] as const
  const empty = (en: string, zh: string, subEn: string, subZh: string) => <div className="portal-empty"><h3>{t(en, zh)}</h3><p>{t(subEn, subZh)}</p></div>
  const badge = (text: string, tn: Tone) => <span className={`status-badge tone-${tn}`}>{text}</span>

  return <main className="ocean-journey portal" data-locale-managed><div className="container">
    <header className="portal-head">
      <h1>{t('Instructor portal', '教练工作台')}</h1>
      <p className="portal-lede">{t('Record and verify external payments, review diver eligibility, and track Okim Points. Evidence stays in WhatsApp.', '记录并核实外部付款、审核潜水员资格、追踪 Okim 积分。付款凭证保留在 WhatsApp。')}</p>
    </header>
    <nav className="portal-nav" aria-label={t('Portal sections', '工作台栏目')}>
      {nav.map(([href, en, zh]) => <a key={href} href={href}>{t(en, zh)}</a>)}
    </nav>
    {/* Diver updates must render INSIDE main.portal: the fixed watercolor
        ::before paints over any sibling placed before main. */}
    {updates}

    <section id="record" className="portal-card">
      <div className="portal-card-head">
        <h2>{t('Record external payment', '记录外部付款')}</h2>
        <CardHelp id="record-help" label={t('Help: record external payment', '帮助：记录外部付款')}>
          <p>{t('Use this card when a diver sends a transfer screenshot via WhatsApp.', '当潜水员通过 WhatsApp 发送转账截图时，在此卡片记录。')}</p>
          <ol>
            <li>{t('Choose the booking — its currency fills in automatically.', '选择预订——币种自动带入。')}</li>
            <li>{t('Pick the payment kind: deposit, balance, or full payment.', '选择付款类型：订金、尾款或全款。')}</li>
            <li>{t('Enter the amount, date paid, and transfer reference (the booking ID).', '输入金额、付款日期和转账备注（预订编号）。')}</li>
            <li>{t('Record it, then verify against the bank record in the queue below. Recording alone does not confirm a slot.', '记录后，在下方核实队列中核对银行记录。仅记录不会确认名额。')}</li>
          </ol>
        </CardHelp>
      </div>
      <p className="portal-hint">{t('Recording is not bank verification — verify against the bank record in the queue below.', '记录付款不代表已核实银行到账——请在下方核实队列中核对银行记录。')}</p>
      <form action={recordPayment} className="booking-form portal-form">
        <input type="hidden" name="operationKey" value={operationKey} />
        <label className="span-2">{t('Booking', '预订')}
          <select name="bookingId" required value={recordBookingId} onChange={e => setRecordBookingId(e.target.value)}>
            <option value="" disabled>{t('Choose a booking', '请选择预订')}</option>
            {data.manifest.map(b => <option key={b.id} value={b.id}>{bookingOption(b)} · {label(bookingStatus, b.status)}</option>)}
          </select>
        </label>
        <div className="portal-field span-2">
          <span className="portal-field-label" id="portal-kind-label">{t('Payment kind', '付款类型')}</span>
          <div className="kind-pills" role="radiogroup" aria-labelledby="portal-kind-label">
            {kinds.map(([value, en, zh]) => <label key={value} className="kind-pill"><input type="radio" name="kind" value={value} required checked={kind === value} onChange={() => setKind(value)} /><span>{t(en, zh)}</span></label>)}
          </div>
        </div>
        <label>{t('Amount', '金额')}<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label>
        <label>{t('Date paid', '付款日期')}<input name="paidOn" type="date" required max={new Date().toISOString().slice(0, 10)} /></label>
        <label className="span-2">{t('Transfer reference', '转账备注')}<input name="reference" required maxLength={120} placeholder={recordBookingId || t('Booking ID used as transfer reference', '以预订编号作为转账备注')} /></label>
        <input type="hidden" name="currency" value={selectedBooking?.currency ?? ''} />
        <p className="portal-currency span-2">{selectedBooking ? `${t('Currency', '币种')}: ${selectedBooking.currency} · ${t('Deposit', '订金')} ${money(selectedBooking.currency, selectedBooking.depositAmount ?? '0')}` : t('Choose a booking to set its currency automatically.', '选择预订后自动带入币种。')}</p>
        <button className="btn btn-primary span-2">{t('Record payment', '记录付款')}</button>
      </form>
    </section>

    <section id="verify" className="portal-card">
      <div className="portal-card-head">
        <h2>{t('Verification queue', '待核实付款')}</h2>
        <CardHelp id="verify-help" label={t('Help: verification queue', '帮助：待核实付款')}>
          <p>{t('This is the demo centerpiece: confirm money actually arrived before a slot is held.', '这是演示的核心：确认款项实际到账后才保留名额。')}</p>
          <ol>
            <li>{t('Open the bank record and find the transfer whose reference matches the booking ID.', '打开银行记录，找到转账备注与预订编号一致的款项。')}</li>
            <li>{t('Check the amount and date match the recorded claim, then press verify.', '核对金额与日期和记录的付款一致，然后按下核实。')}</li>
            <li>{t('Verification re-checks capacity: if the trip is still open the booking is confirmed; if it filled meanwhile, the booking is flagged for refund — contact the diver.', '核实时会重新检查名额：行程仍有名额则确认预订；若期间已满，则标记退款——请联系潜水员。')}</li>
            <li>{t('A receipt is issued and Okim Points are earned automatically. Receipt links appear below.', '系统自动开具收据并累积 Okim 积分。收据链接显示在下方。')}</li>
          </ol>
        </CardHelp>
      </div>
      <p className="portal-hint">{t('Confirm only after the bank record matches. Verification re-checks trip capacity and issues a receipt.', '仅在银行记录吻合后确认。核实时会重新检查行程名额并开具收据。')}</p>
      {pendingClaims.length === 0 ? empty('All caught up', '全部处理完毕', 'Nothing waiting for review.', '暂无待核实的付款。') : <ul className="portal-list">
        {pendingClaims.map(c => <li key={c.id}><form action={verifyPayment} className="portal-row">
          <div className="portal-row-main">
            <strong>{c.bookingId}</strong>
            {badge(label({ deposit: { en: 'Deposit', zh: '订金' }, balance: { en: 'Balance', zh: '尾款' }, full: { en: 'Full', zh: '全款' } }, c.kind), 'pending')}
            <span className="portal-amount">{money(c.currency, c.amount)}</span>
            <span className="portal-row-sub">{t('Paid', '付款日')} {date(c.paidOn)} · {c.reference}</span>
          </div>
          <input type="hidden" name="claimId" value={c.id} />
          <button className="btn btn-secondary">{t('Verify against bank record', '核对银行记录后确认')}</button>
        </form></li>)}
      </ul>}
      <h3 className="portal-subhead">{t('Verified receipts', '已核实收据')}</h3>
      {verifiedPayments.filter(p => p.receiptNo).length === 0 ? <p className="portal-hint">{t('Receipts appear here after verification.', '核实付款后，收据将显示在此处。')}</p> : <ul className="portal-list portal-receipts">
        {verifiedPayments.filter(p => p.receiptNo).map(p => <li key={p.id}><a href={`/receipt/${encodeURIComponent(p.id)}`}>{p.bookingId} · {p.receiptNo} · {money(p.currency, p.amount)}</a></li>)}
      </ul>}
    </section>

    <section id="bookings" className="portal-card">
      <div className="portal-card-head">
        <h2>{t('Trip manifests and eligibility', '行程名单与资格审核')}</h2>
        <CardHelp id="bookings-help" label={t('Help: trip manifests and eligibility', '帮助：行程名单与资格审核')}>
          <p>{t('Decide whether each diver is suitable for the trip — a separate gate from payment.', '判断每位潜水员是否适合该行程——与付款审核相互独立。')}</p>
          <ol>
            <li>{t('Open the instructor-only declarations: certification, dive count, medical, and emergency contact.', '打开仅教练可见的申报资料：证书、潜水次数、健康状况和紧急联系人。')}</li>
            <li>{t('Approve eligibility if the diver is suitable for this trip.', '若潜水员适合此行程，批准资格。')}</li>
            <li>{t('Decline if not suitable — a paid booking then enters full-refund review and any points are reversed.', '若不适合则不批准——已付款的预订将进入全额退款审核，相关积分会被冲正。')}</li>
            <li>{t('You decide suitability; the software never does.', '适宜性由教练判断，软件不作决定。')}</li>
          </ol>
        </CardHelp>
      </div>
      <p className="portal-hint">{t('Eligibility is a separate gate from payment — you decide dive suitability, never the software.', '资格审核与付款相互独立——潜水适宜性由教练判断，软件不作决定。')}</p>
      {data.manifest.length === 0 ? empty('No bookings yet', '暂无预订', 'Bookings appear here as divers submit them.', '潜水员提交预订后将显示在此处。') : data.manifest.map(b => <article key={b.id} className="portal-booking">
        <div className="portal-booking-head">
          <h3>{b.id}</h3>
          {badge(label(bookingStatus, b.status), tone(bookingStatus, b.status))}
          {badge(label(eligibilityStatus, b.eligibilityStatus), tone(eligibilityStatus, b.eligibilityStatus))}
        </div>
        <p className="portal-row-sub">{tripName(b)} · {b.customerName}{b.depositAmount ? ` · ${t('Deposit', '订金')} ${money(b.currency, b.depositAmount)}` : ''}</p>
        <details>
          <summary>{t('Instructor-only declarations', '仅教练可见的申报资料')}</summary>
          <dl className="portal-declarations">{Object.entries(b.declarations).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd></div>)}</dl>
        </details>
        <form action={reviewEligibility} className="portal-eligibility">
          <input type="hidden" name="bookingId" value={b.id} />
          <button name="decision" value="approved" className="btn btn-primary">{t('Approve eligibility', '批准资格')}</button>
          <button name="decision" value="declined" className="btn btn-secondary">{t('Decline: full refund review', '不批准：审核全额退款')}</button>
        </form>
      </article>)}
    </section>

    <section id="finance" className="portal-card portal-finance">
      <div className="portal-card-head">
        <h2>{t('Financial operations', '财务操作')}</h2>
        <CardHelp id="finance-help" label={t('Help: financial operations', '帮助：财务操作')}>
          <p>{t('Three tools, each for a specific moment in the booking lifecycle.', '三个工具，分别用于预订流程的不同节点。')}</p>
          <ol>
            <li>{t('External refund: after you have completed the refund in the bank, record it here against the original payment. Points earned on it are reversed proportionally.', '外部退款：在银行完成退款后，在此对应原付款记录。该付款累积的积分会按比例冲正。')}</li>
            <li>{t('Redeem points: before the diver pays, apply their available points (max 20% of the trip price; only points from completed, unexpired trips).', '抵扣积分：在潜水员付款前应用其可用积分（最高为行程价格的 20%；仅限已完成行程且未过期的积分）。')}</li>
            <li>{t('Trip completion: after the trip ends, mark a confirmed and eligibility-approved booking as completed — this unlocks its points for redemption.', '行程完成：行程结束后，将已确认且资格已批的预订标记为完成——此后其积分方可抵扣。')}</li>
          </ol>
        </CardHelp>
      </div>
      <form action={refundPayment} className="booking-form portal-form">
        <h3 className="span-2">{t('External refund', '外部退款')}</h3>
        <input type="hidden" name="operationKey" value={`refund-${operationKey}`} />
        <label className="span-2">{t('Original payment', '原付款')}
          <select name="paymentId" required defaultValue="">
            <option value="" disabled>{t('Choose a verified payment', '请选择已核实付款')}</option>
            {verifiedPayments.map(p => <option key={p.id} value={p.id}>{p.id} · {p.bookingId} · {money(p.currency, p.amount)}</option>)}
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
      <form action={completeBooking} className="booking-form portal-form">
        <h3 className="span-2">{t('Trip completion', '行程完成')}</h3>
        <label className="span-2">{t('Completed booking', '已完成预订')}
          <select name="bookingId" required defaultValue="">
            <option value="" disabled>{t('Choose a booking', '请选择预订')}</option>
            {data.manifest.map(b => <option key={b.id} value={b.id}>{bookingOption(b)}</option>)}
          </select>
        </label>
        <button className="btn btn-secondary span-2">{t('Record trip completion', '记录行程完成')}</button>
      </form>
    </section>

    <section id="points" className="portal-card">
      <div className="portal-card-head">
        <h2>{t('Okim Points ledger', 'Okim 积分明细')}</h2>
        <CardHelp id="points-help" label={t('Help: Okim Points ledger', '帮助：Okim 积分明细')}>
          <p>{t('Read-only audit trail — no action needed here unless a diver asks about their balance.', '只读的审计明细——除非潜水员查询余额，否则无需在此操作。')}</p>
          <ol>
            <li>{t('Points are earned automatically on payment verification: 1 point per RM1, using the trip rate snapshot.', '核实付款时自动累积积分：每 RM1 得 1 分，按行程汇率快照计算。')}</li>
            <li>{t('Points become usable only after the trip is completed, and expire 12 months after verification.', '积分仅在行程完成后可用，自核实起 12 个月后过期。')}</li>
            <li>{t('The ledger is append-only: corrections appear as reversal entries, never edits.', '明细只增不改：更正以冲正记录呈现，绝不直接修改。')}</li>
          </ol>
        </CardHelp>
      </div>
      <p className="portal-hint">{t('Append-only ledger. Points unlock after trip completion and expire 12 months after verification.', '只增不改的明细账。积分在行程完成后可用，自核实起 12 个月后过期。')}</p>
      {data.ledger.length === 0 ? empty('No points activity yet', '暂无积分记录', 'Verified payments earn points automatically.', '核实付款后自动累积积分。') : <table className="portal-table">
        <thead><tr><th>{t('Customer', '客户')}</th><th>{t('Type', '类型')}</th><th>{t('Points', '积分')}</th><th>{t('RM amount', 'RM 金额')}</th><th>{t('Rate snapshot', '汇率快照')}</th></tr></thead>
        <tbody>{data.ledger.map(e => <tr key={e.id}>
          <td data-label={t('Customer', '客户')}>{e.customerName}</td>
          <td data-label={t('Type', '类型')}>{badge(t(e.type, { earned: '已累积', redeemed: '已抵扣', expired: '已过期', reversed: '已冲正' }[e.type] ?? e.type), ledgerTone[e.type] ?? 'neutral')}</td>
          <td data-label={t('Points', '积分')}>{e.points}</td>
          <td data-label={t('RM amount', 'RM 金额')}>RM {Number(e.rmAmount).toFixed(2)}</td>
          <td data-label={t('Rate snapshot', '汇率快照')}>{e.rateSnapshot}</td>
        </tr>)}</tbody>
      </table>}
    </section>

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
      {newInquiries.length === 0 ? empty('Inbox zero', '咨询已清空', 'No new contact-form inquiries.', '暂无新的联系表单咨询。') : <ul className="portal-list">
        {newInquiries.map(i => <li key={i.id}><form action={handleInquiry} className="portal-row portal-inquiry">
          <div className="portal-row-main"><strong>{i.name}</strong><span className="portal-row-sub">{i.message}</span></div>
          <input type="hidden" name="inquiryId" value={i.id} />
          <button className="btn btn-secondary">{t('Mark handled', '标记已处理')}</button>
        </form></li>)}
      </ul>}
    </section>

    <PortalTrips trips={data.trips} />
    <PortalPolicies policies={data.policies} />
    <PortalSettings data={data.settings} />
  </div></main>
}
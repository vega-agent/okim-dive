'use client'

// M4: bilingual invoice document, print-ready (print CSS hides site chrome).
import { useLocale, pick } from '@/lib/use-locale'
import { setCustomerLocale } from '@/lib/booking-actions'

export type InvoiceViewProps = {
  locale: 'en' | 'zh'
  invoiceNumber: string
  issuedAt: string
  bookingId: string
  bookingStatus: string
  customerName: string
  customerEmail: string
  tripTitleEn: string
  tripTitleZh: string | null
  travelDatesEn: string | null
  travelDatesZh: string | null
  currency: string
  deposit: string
  balance: string
  discount: string
  balanceDue: string | null
  policyKind: string
  policyVersion: number
}

const L = {
  invoice: ['Invoice', '发票'],
  issued: ['Issued', '开具日期'],
  booking: ['Booking ID', '预订编号'],
  status: ['Booking status', '预订状态'],
  billedTo: ['Billed to', '客户'],
  trip: ['Trip', '行程'],
  dates: ['Travel dates', '出行日期'],
  description: ['Description', '项目'],
  amount: ['Amount', '金额'],
  tripFee: ['Trip fee', '行程费用'],
  pointsDiscount: ['Okim Points discount', 'Okim 积分抵扣'],
  deposit: ['Deposit (due now)', '订金（现在应付）'],
  balance: ['Balance', '尾款'],
  balanceDue: ['Balance due by', '尾款截止日期'],
  total: ['Total', '总计'],
  reference: ['Payment reference', '转账备注'],
  notice: ['Your slot is confirmed only after Iris verifies your deposit, subject to availability. Send your transfer screenshot to Iris via WhatsApp.', '只有在 Iris 核实订金后、且仍有名额时，名额才会确认。请通过 WhatsApp 将转账截图发给 Iris。'],
  policy: ['Accepted refund policy version', '已接受的退款政策版本'],
  print: ['Print / save as PDF', '打印／保存为 PDF'],
  awaiting: ['Awaiting deposit', '等待订金'],
} as const

const STATUS_LABELS: Record<string, readonly [string, string]> = {
  awaiting_deposit: L.awaiting,
  payment_claimed: ['Payment claimed', '已申报付款'],
  deposit_verified: ['Deposit verified', '订金已核实'],
  confirmed: ['Confirmed', '已确认'],
  completed: ['Completed', '已完成'],
  refund_flagged: ['Refund flagged', '标记退款'],
  cancelled: ['Cancelled', '已取消'],
  eligibility_declined: ['Eligibility declined', '资格未获批'],
}

export default function InvoiceView(props: InvoiceViewProps) {
  const locale = useLocale(props.locale, (next) => void setCustomerLocale(next))
  const t = (pair: readonly [string, string]) => pick(locale, pair[0], pair[1])
  const tripFee = (Number(props.deposit) + Number(props.balance) + Number(props.discount)).toFixed(2)
  const total = (Number(props.deposit) + Number(props.balance)).toFixed(2)
  const statusPair = STATUS_LABELS[props.bookingStatus] ?? [props.bookingStatus, props.bookingStatus]

  return (
    <div className="invoice-doc" data-locale-managed>
      <div className="invoice-head">
        <div>
          <p className="invoice-brand">Okim Dive</p>
          <h1>{t(L.invoice)} {props.invoiceNumber}</h1>
        </div>
        <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>{t(L.print)}</button>
      </div>

      <dl className="invoice-meta">
        <div><dt>{t(L.issued)}</dt><dd>{props.issuedAt}</dd></div>
        <div><dt>{t(L.booking)}</dt><dd>{props.bookingId}</dd></div>
        <div><dt>{t(L.status)}</dt><dd>{t(statusPair)}</dd></div>
        <div><dt>{t(L.billedTo)}</dt><dd>{props.customerName}<br />{props.customerEmail}</dd></div>
        <div><dt>{t(L.trip)}</dt><dd>{pick(locale, props.tripTitleEn, props.tripTitleZh)}</dd></div>
        <div><dt>{t(L.dates)}</dt><dd>{pick(locale, props.travelDatesEn, props.travelDatesZh)}</dd></div>
      </dl>

      <table className="invoice-table">
        <thead>
          <tr><th>{t(L.description)}</th><th>{t(L.amount)}</th></tr>
        </thead>
        <tbody>
          <tr><td>{t(L.tripFee)}</td><td>{props.currency} {tripFee}</td></tr>
          {Number(props.discount) > 0 && <tr><td>{t(L.pointsDiscount)}</td><td>− {props.currency} {props.discount}</td></tr>}
          <tr><td>{t(L.deposit)}</td><td>{props.currency} {props.deposit}</td></tr>
          <tr><td>{t(L.balance)}{props.balanceDue ? ` · ${t(L.balanceDue)}: ${props.balanceDue}` : ''}</td><td>{props.currency} {props.balance}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>{t(L.total)}</td><td>{props.currency} {total}</td></tr>
        </tfoot>
      </table>

      <p className="invoice-reference">{t(L.reference)}: <strong>{props.bookingId}</strong></p>
      <p className="invoice-notice">{t(L.notice)}</p>
      <p className="invoice-policy">{t(L.policy)}: {props.policyVersion}</p>
    </div>
  )
}
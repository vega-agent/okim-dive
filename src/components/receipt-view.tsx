'use client'
import { useLocale } from '@/lib/use-locale'
import type { readReceipt } from '@/lib/payment-documents'

export default function ReceiptView({ receipt }: { receipt: NonNullable<Awaited<ReturnType<typeof readReceipt>>> }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const money = (n: number) => receipt.currency + ' ' + (n / 100).toFixed(2)
  const refund = receipt.kind === 'refunded'
  const recorded = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-GB', { dateStyle:'medium',timeStyle:'short',timeZone:'UTC' }).format(new Date(receipt.recordedAt)) + ' UTC'
  return <article className="invoice-doc" data-locale-managed>
    <div className="invoice-head"><div><p className="invoice-brand">Okim Dive</p>
      <h1>{refund ? t('Refund receipt','退款收据') : t('Receipt','收据')} {receipt.number}</h1></div>
      <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>{t('Print / save as PDF','打印／保存为 PDF')}</button></div>
    <dl className="invoice-meta">
      {receipt.customerName && <div><dt>{t('Customer','客户')}</dt><dd>{receipt.customerName}</dd></div>}
      <div><dt>{t('Booking reference','预订编号')}</dt><dd>{receipt.bookingId}</dd></div>
      <div><dt>{refund ? t('Refund date','退款日期') : t('Payment date','付款日期')}</dt><dd>{receipt.paidOn}</dd></div>
      <div><dt>{t('Recorded','登记时间')}</dt><dd>{recorded}</dd></div>
      <div><dt>{refund ? t('Amount refunded','本次退款') : t('Amount received','本次实收')}</dt><dd>{money(receipt.amountMinor)}</dd></div>
    </dl>
    <table className="invoice-table"><thead><tr><th>{t('Stage','付款阶段')}</th><th>{t('Amount','金额')}</th></tr></thead>
      <tbody>{receipt.allocations.map(a => <tr key={a.position}><td>{a.kind === 'final' ? t('Final payment','尾款') : t('Deposit ','订金 ') + a.position}</td><td>{money(a.amountMinor)}</td></tr>)}</tbody></table>
    <h2>{t('Booking totals when recorded','登记时的预订金额')}</h2>
    <dl className="invoice-meta">
      <div><dt>{t('Total received','累计已收')}</dt><dd>{money(receipt.grossReceivedMinor)}</dd></div>
      <div><dt>{t('Total refunded','累计已退')}</dt><dd>{money(receipt.refundedMinor)}</dd></div>
      <div><dt>{t('Net received','实收净额')}</dt><dd>{money(receipt.netReceivedMinor)}</dd></div>
      {!refund && <div><dt>{t('Balance at recording','登记时的余额')}</dt><dd>{money(receipt.outstandingMinor)}</dd></div>}
    </dl>
  </article>
}

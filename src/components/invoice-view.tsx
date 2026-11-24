'use client'

import { useLocale, pick } from '@/lib/use-locale'
import { setCustomerLocale } from '@/lib/booking-actions'
import type { readInvoice } from '@/lib/payment-documents'
import PaymentSchedule from './payment-schedule'

const statuses: Record<string, [string,string]> = {
  awaiting_deposit: ['Reserved · awaiting first deposit', '已保留名额 · 待付首笔订金'], payment_claimed: ['Payment recorded','已记录付款'],
  deposit_verified: ['Deposit verified','订金已核实'], confirmed: ['Confirmed','已确认'], completed: ['Completed','已完成'],
  cancelled: ['Cancelled','已取消'], refund_flagged: ['Refund review','退款审核中'], eligibility_declined: ['Withdrawn','已退出'],
  expired: ['Expired','已过期'],
}

export default function InvoiceView({ invoice }: { invoice: NonNullable<Awaited<ReturnType<typeof readInvoice>>> }) {
  const locale = useLocale(undefined, next => void setCustomerLocale(next))
  const t = (en: string, zh: string) => pick(locale,en,zh)
  const dates = pick(locale, invoice.travelDatesEn, invoice.travelDatesZh)
  const { summary } = invoice
  const money = (minor: number) => summary.currency + ' ' + (minor / 100).toFixed(2)
  return <div className="invoice-doc" data-locale-managed>
    <div className="invoice-head"><div><p className="invoice-brand">Okim Dive</p><h1>{t('Invoice', '发票')} {invoice.number}</h1></div>
      <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>{t('Print / save as PDF','打印／保存为 PDF')}</button></div>
    <dl className="invoice-meta">
      <div><dt>{t('Issued','开具日期')}</dt><dd>{invoice.issuedAt}</dd></div>
      <div><dt>{t('Booking reference','预订编号')}</dt><dd>{summary.bookingId}</dd></div>
      <div><dt>{t('Current booking status','当前预订状态')}</dt><dd>{t(...(statuses[invoice.bookingStatus] ?? ['Contact Iris','请联系 Iris']))}</dd></div>
      <div><dt>{t('Billed to','客户')}</dt><dd>{invoice.customerName}<br />{invoice.customerEmail}</dd></div>
      <div><dt>{t('Trip','行程')}</dt><dd>{pick(locale,invoice.tripTitleEn,invoice.tripTitleZh)}</dd></div>
      {dates && <div><dt>{invoice.pendingDates ? t('Agreed travel dates','原定出行日期') : t('Travel dates','出行日期')}</dt><dd>{dates}</dd></div>}
      {invoice.pendingDates && <div><dt>{t('Proposed dates · awaiting diver decision','建议日期 · 待潜水员决定')}</dt><dd>{invoice.pendingDates}</dd></div>}
    </dl>
    <table className="invoice-table"><tbody>
      <tr><th scope="row">{t('Trip price','行程价格')}</th><td>{money(summary.originalPriceMinor)}</td></tr>
      {summary.discountMinor > 0 && <tr><th scope="row">{t('Points discount','积分抵扣')}</th><td>− {money(summary.discountMinor)}</td></tr>}
    </tbody><tfoot><tr><th scope="row">{t('Price after discount','折后价格')}</th><td>{money(summary.payableMinor)}</td></tr></tfoot></table>
    <h2>{t('Payment schedule','付款安排')}</h2>
    <PaymentSchedule locale={locale} summary={summary} completed={invoice.bookingStatus === 'completed'} />
    {invoice.policyVersion != null && <p className="invoice-policy">{t('Accepted refund policy','已接受的退款政策')} · v{invoice.policyVersion}</p>}
  </div>
}

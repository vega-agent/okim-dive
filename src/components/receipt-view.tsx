'use client'

import { useLocale } from '@/lib/use-locale'

export default function ReceiptView({ receipt }: { receipt: { number: string; paymentId: string; claimId: string | null; bookingId: string; customerName: string; amount: string; currency: string; verifiedAt: string; kind: string } }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const kinds: Record<string, [string, string]> = { deposit: ['Deposit', '订金'], balance: ['Balance', '尾款'], full: ['Full payment', '全款'], refund: ['Refund', '退款'] }
  return <div className="invoice-doc" data-locale-managed>
    <div className="invoice-head"><div><p className="invoice-brand">Okim Dive</p><h1>{t('Receipt', '收据')} {receipt.number}</h1></div><button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>{t('Print / save as PDF', '打印／保存为 PDF')}</button></div>
    <dl className="invoice-meta">
      <div><dt>{t('Customer', '客户')}</dt><dd>{receipt.customerName}</dd></div>
      <div><dt>{t('Booking ID', '预订编号')}</dt><dd>{receipt.bookingId}</dd></div>
      <div><dt>{t('Payment ID', '付款编号')}</dt><dd>{receipt.paymentId}</dd></div>
      {receipt.claimId && <div><dt>{t('Claim ID', '付款记录编号')}</dt><dd>{receipt.claimId}</dd></div>}
      <div><dt>{t('Verified on', '核实日期')}</dt><dd>{receipt.verifiedAt}</dd></div>
      <div><dt>{t('Payment kind', '付款类型')}</dt><dd>{t(...(kinds[receipt.kind] ?? [receipt.kind, receipt.kind]))}</dd></div>
      <div><dt>{t('Verified amount', '已核实金额')}</dt><dd>{receipt.currency} {receipt.amount}</dd></div>
    </dl>
    <p className="invoice-notice">{t('This receipt records an instructor-verified external transaction. It does not confirm eligibility or reserve a slot.', '本收据记录教练已核实的外部交易，不代表资格获批或名额确认。')}</p>
  </div>
}

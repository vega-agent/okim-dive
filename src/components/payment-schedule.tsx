'use client'
import type { ReactNode } from 'react'
import type { BookingPaymentSummary } from '@/lib/payment-schedule'

export default function PaymentSchedule({ summary, locale, completed = false }: { summary: BookingPaymentSummary; locale: 'en' | 'zh'; completed?: boolean }) {
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en
  const money = (minor: number) => summary.currency + ' ' + (minor / 100).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const amount = (minor: number) => <span className="payment-money">{money(minor)}</span>
  const cell = (label: string, value: ReactNode) => <td><span className="payment-cell-label">{label}</span><span className="payment-cell-value">{value}</span></td>
  const stageState = { paid: t('Paid', '已付清'), due: t('Due today', '今日到期'), overdue: t('Overdue', '已逾期'), upcoming: t('Upcoming', '未到期'), waived: t('Waived', '已免付') }
  return <div className="booking-payment-schedule" aria-label={t('Payment schedule', '付款安排')}>
    <table className="portal-table">
      <thead><tr><th>{t('Stage', '付款阶段')}</th><th>{t('Payable', '应付')}</th><th>{summary.refundedMinor ? t('Net received', '实收净额') : t('Received', '已收')}</th>{!completed && <th>{t('Outstanding', '待付')}</th>}</tr></thead>
      <tbody>{summary.stages.map(stage => <tr key={stage.id}>
        {cell(t('Stage', '付款阶段'), <>{stage.kind === 'final' ? t('Final payment', '尾款') : t('Deposit ', '订金 ') + stage.position}
          {stage.dueDate && stage.payableMinor > 0 && <> · <time dateTime={stage.dueDate}>{stage.dueDate}</time></>} · {completed ? t('Completed', '已完成') : stageState[stage.state]}</>)}
        {cell(t('Payable', '应付'), <>{amount(stage.payableMinor)}{stage.discountMinor > 0 &&
          <small>{amount(stage.amountMinor)} − {amount(stage.discountMinor)} {t('points discount', '积分抵扣')}</small>}</>)}
        {cell(summary.refundedMinor ? t('Net received', '实收净额') : t('Received', '已收'), amount(stage.receivedMinor))}
        {!completed && cell(t('Outstanding', '待付'), amount(stage.outstandingMinor))}
      </tr>)}</tbody>
    </table>
    <p className="payment-totals">{summary.refundedMinor ? t('Received before refunds', '退款前已收') : t('Received', '已收')} {amount(summary.grossReceivedMinor)}{!completed && <> · {t('Outstanding', '待付')} {amount(summary.outstandingMinor)}</>}</p>
    {summary.refundedMinor > 0 && <p>{t('Refunded', '已退')} {amount(summary.refundedMinor)} · {t('Net received', '实收净额')} {amount(summary.netReceivedMinor)}</p>}
    {summary.refundEntitlementMinor > 0 && <p>{t('Refund agreed', '应退总额')} {amount(summary.refundEntitlementMinor)} · {t('Still to refund', '尚需退款')} {amount(summary.refundOutstandingMinor)}</p>}
  </div>
}

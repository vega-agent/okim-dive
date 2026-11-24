'use client'
import type { StageInput } from '@/lib/payment-schedule'

export default function TripPaymentRows({ stages, currency, today, locale }: {
  stages: StageInput[]; currency: string; today: string; locale: 'en' | 'zh'
}) {
  const zh = locale === 'zh'
  return <>{stages.map(stage => <div className="trip-payment-row" key={stage.id}>
    <dt>{stage.kind === 'deposit' ? (zh ? '订金 ' : 'Deposit ') + stage.position : zh ? '尾款' : 'Final payment'}</dt>
    <dd>{currency} {(stage.amountMinor / 100).toLocaleString(zh ? 'zh-CN' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {stage.amountMinor > 0 && stage.dueDate && <> · {stage.dueDate <= today ? (zh ? '现在应付' : 'Due now') : (zh ? '截止' : 'Due')} <time dateTime={stage.dueDate}>{stage.dueDate}</time></>}
    </dd>
  </div>)}</>
}

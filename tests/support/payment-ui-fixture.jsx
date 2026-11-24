import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import PortalDialog from '../../src/components/portal-dialog'
import PaymentSchedule from '../../src/components/payment-schedule'
import TripPaymentRows from '../../src/components/trip-payment-rows'
import RecordPaymentDialog from '../../src/components/record-payment-dialog'

function App() {
  const { summary, locale, completed } = window.fixture
  const zh = locale === 'zh'
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [receipt, setReceipt] = useState('')
  if (window.fixture.wizard) return <dl className="booking-summary" style={{ width: 'min(100%, calc(100vw - 114px))' }}>
    <TripPaymentRows stages={summary.stages} currency={summary.currency} today="2027-02-02" locale={locale} />
  </dl>
  return <main className="portal" style={{ padding: 16, background: 'white' }}>
    <section style={{ width: 'clamp(185px, calc(100vw - 130px), 100%)' }}><PaymentSchedule summary={summary} locale={locale} completed={completed} /></section>
    <button onClick={() => setOpen(true)}>{zh ? '登记收款' : 'Record payment'}</button>
    {receipt && <a href={receipt}>{zh ? '查看收据' : 'View receipt'}</a>}
    <PortalDialog open={open} pending={pending} onClose={() => setOpen(false)} closeLabel={zh ? '关闭' : 'Close'} title={zh ? '登记收款' : 'Record payment'}>
      {open && <RecordPaymentDialog summary={summary} today="2027-02-02" locale={locale} context={<span>Sample · BKG-100</span>}
        onClose={() => setOpen(false)} onPendingChange={setPending} onSave={url => { setReceipt(url); setOpen(false) }} />}
    </PortalDialog>
  </main>
}
createRoot(document.getElementById('root')).render(<App />)

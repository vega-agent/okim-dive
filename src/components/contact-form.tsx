'use client'

// M3: contact form wired to the submitInquiry server action (inquiries table).
// Markup matches the M2 port verbatim; additions are the locale field, a status
// message, and the success confirmation. New strings go through the site-i18n
// dictionary like all other copy.
import { useState } from 'react'
import { submitInquiry } from '@/lib/contact-action'

export default function ContactForm() {
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle')
  const [pending, setPending] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const localeInput = form.elements.namedItem('locale') as HTMLInputElement
    localeInput.value = document.documentElement.lang === 'zh-CN' ? 'zh' : 'en'
    setPending(true)
    try {
      const result = await submitInquiry(new FormData(form))
      setState(result.status)
      if (result.status === 'success') form.reset()
    } catch {
      // Transport failure (offline/server unreachable) — same recovery path.
      setState('error')
    } finally {
      setPending(false)
    }
  }

  if (state === 'success') {
    return (
      <div className="form-success" role="status">
        <p>Thank you. Your enquiry has been received — we will reply by email.</p>
        <button type="button" className="btn btn-primary" onClick={() => setState('idle')}>Send another enquiry</button>
      </div>
    )
  }

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <input type="hidden" name="locale" defaultValue="en" />
      <div className="form-group">
        <label htmlFor="name">Full Name *</label>
        <input type="text" id="name" name="name" autoComplete="name" required />
      </div>
      <div className="form-group">
        <label htmlFor="email">Email Address *</label>
        <input type="email" id="email" name="email" autoComplete="email" required />
      </div>
      <div className="form-group">
        <label htmlFor="whatsapp">WhatsApp Number</label>
        <input type="tel" id="whatsapp" name="whatsapp" autoComplete="tel" />
      </div>
      <div className="form-group">
        <label htmlFor="interest">What are you interested in? *</label>
        <select id="interest" name="interest" required defaultValue="">
          <option value="">Select an option</option>
          <optgroup label="Courses">
            <option value="course-open-water">Open Water Diver</option>
            <option value="course-advanced-open-water">Advanced Open Water</option>
            <option value="course-scuba-refresher">Scuba Refresher</option>
            <option value="course-other">Other course</option>
          </optgroup>
          <optgroup label="Trips">
            <option value="trip-tioman-island">Tioman Island</option>
            <option value="trip-sipadan-blue-current-week">Sipadan Blue Current Week</option>
            <option value="trip-raja-ampat-reef-explorer">Raja Ampat Reef Explorer</option>
            <option value="trip-other">Other trip</option>
          </optgroup>
          <option value="not-sure">Not sure yet</option>
          <option value="general-question">General question</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="dates">Preferred Date or Dates</label>
        <input type="text" id="dates" name="dates" placeholder="For example, 12–16 October 2027" />
      </div>
      <div className="form-group">
        <label htmlFor="group-size">Number of Divers / Travellers</label>
        <input type="number" id="group-size" name="group_size" min={1} inputMode="numeric" />
      </div>
      <div className="form-group">
        <label htmlFor="certification">Certification Level</label>
        <input type="text" id="certification" name="certification" placeholder="For example, Open Water Diver" />
      </div>
      <div className="form-group">
        <label htmlFor="message">Tell us a little more *</label>
        <textarea id="message" name="message" rows={5} required></textarea>
      </div>
      <div className="form-group form-consent">
        <label><input type="checkbox" name="consent" required /> I agree to Okim Dive using the information I provide to respond to this enquiry. *</label>
      </div>
      {state === 'error' && (
        <p className="form-status form-status-error" role="alert">Your enquiry could not be sent. Please try again, or contact us directly.</p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Sending…' : 'Send Enquiry'}</button>
    </form>
  )
}
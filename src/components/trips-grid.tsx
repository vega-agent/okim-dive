'use client'

// M3: trip data comes from Postgres via the server component (src/lib/trips.ts,
// JSON fallback there). Cards render as JSX (server-side); the detail dialog keeps
// the M2 imperative <dialog> port so rendered output and CN translation via the
// site-i18n MutationObserver stay identical.
import { useEffect, useRef } from 'react'
import type { Trip } from '@/lib/trips'

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))
const list = (items: string[] = []) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
const section = (title: string, items: string[] | undefined, className = '') => items?.length ? `<section class="trip-dialog-section ${className}"><h3>${escapeHtml(title)}</h3><ul>${list(items)}</ul></section>` : ''

export default function TripsGrid({ trips }: { trips: Trip[] }) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const grid = gridRef.current
    if (!grid || !trips.length) return

    const dialog = document.createElement('dialog')
    dialog.className = 'trip-dialog'
    dialog.innerHTML = '<div class="trip-dialog-body"><button class="trip-dialog-close" type="button" aria-label="Close trip details">×</button></div>'
    document.body.append(dialog)
    const body = dialog.querySelector('.trip-dialog-body') as HTMLElement

    const render = (trip: Trip) => {
      const isSample = trip.status === 'Sample trip'
      const rulesTitle = isSample ? 'Sample planning details' : 'Planning details'
      body.innerHTML = `
      <button class="trip-dialog-close" type="button" aria-label="Close trip details">×</button>
      <header class="trip-dialog-header">
        <p class="trip-dialog-status"><span>${escapeHtml(trip.status)}</span> · <span>${escapeHtml(trip.location)}</span></p>
        <h2 id="trip-dialog-title">${escapeHtml(trip.title)}</h2>
        <p id="trip-dialog-summary" class="trip-dialog-summary">${escapeHtml(trip.summary)}</p>
      </header>
      <div class="trip-dialog-sections">
        <dl class="trip-facts trip-dialog-section trip-dialog-section-facts">
          <div><dt>Travel dates</dt><dd>${escapeHtml(trip.travelDates)}</dd></div>
          <div><dt>Duration</dt><dd>${escapeHtml(trip.duration)}</dd></div>
          <div><dt>Difficulty</dt><dd>${escapeHtml(trip.difficulty)}</dd></div>
          <div><dt>Group size</dt><dd>${escapeHtml(trip.groupSize)}</dd></div>
          <div><dt>Cost</dt><dd>${escapeHtml(trip.cost?.amount)} <small>${escapeHtml(trip.cost?.basis)}</small></dd></div>
        </dl>
        ${section('Highlights', trip.highlights)}
        ${section(isSample ? 'Sample itinerary' : 'Itinerary', trip.itinerary)}
        ${section('Included', trip.included)}
        ${section('Additional costs', trip.additionalCosts, 'trip-dialog-section-costs')}
        <section class="trip-dialog-section trip-dialog-section-rules">
          <h3>${rulesTitle}</h3>
          <ul class="trip-rules">
            <li><strong>Deposit:</strong> ${escapeHtml(trip.bookingRules?.deposit)}</li>
            <li><strong>Balance:</strong> ${escapeHtml(trip.bookingRules?.balanceDue)}</li>
            <li><strong>Cancellation:</strong> ${escapeHtml(trip.bookingRules?.cancellation)}</li>
            <li><strong>Requirements:</strong> ${escapeHtml(trip.bookingRules?.requirements)}</li>
          </ul>
        </section>
      </div>
      <div class="trip-dialog-footer">
        <p class="trip-note${isSample ? ' trip-note-sample' : ''}">${escapeHtml(trip.notes)}</p>
        <a class="btn btn-primary" href="/contact">${escapeHtml(trip.inquiryLabel)}</a>
      </div>`
      dialog.setAttribute('aria-labelledby', 'trip-dialog-title')
      dialog.setAttribute('aria-describedby', 'trip-dialog-summary')
      dialog.showModal()
    }

    const onTrigger = (event: MouseEvent) => {
      const button = (event.target as Element).closest('.trip-details-trigger') as HTMLElement | null
      if (!button) return
      const trip = trips.find((item) => item.id === button.dataset.tripId)
      if (trip) render(trip)
    }
    grid.addEventListener('click', onTrigger)

    const onBackdrop = (event: MouseEvent) => { if (event.target === dialog) dialog.close() }
    const onClose = (event: MouseEvent) => {
      if ((event.target as Element).closest('.trip-dialog-close')) dialog.close()
    }
    dialog.addEventListener('click', onBackdrop)
    dialog.addEventListener('click', onClose)

    return () => {
      grid.removeEventListener('click', onTrigger)
      dialog.removeEventListener('click', onBackdrop)
      dialog.removeEventListener('click', onClose)
      dialog.remove()
    }
  }, [trips])

  if (!trips.length) {
    return <div className="trips-grid"><p className="trip-data-error">Trip information is temporarily unavailable.</p></div>
  }

  return (
    <div className="trips-grid" ref={gridRef}>
      {trips.map((trip, index) => (
        <article key={trip.id} className={`trip-card${index === 0 ? ' featured' : ''}`}>
          <div className="trip-badge">{trip.status}</div>
          <div className="trip-header">
            <h3>{trip.title}</h3>
            <span className="trip-location">{trip.location}</span>
          </div>
          <div className="trip-content">
            <p>{trip.summary}</p>
            <ul className="trip-details">
              <li><strong>Travel dates:</strong> {trip.travelDates}</li>
              <li><strong>Duration:</strong> {trip.duration}</li>
              <li><strong>Difficulty:</strong> {trip.difficulty}</li>
              <li><strong>Group Size:</strong> {trip.groupSize}</li>
            </ul>
            {trip.detailHref
              ? <a className="btn btn-primary" href={trip.detailHref}>View Details</a>
              : <button className="btn btn-primary trip-details-trigger" type="button" data-trip-id={trip.id}>View Details</button>}
          </div>
        </article>
      ))}
    </div>
  )
}

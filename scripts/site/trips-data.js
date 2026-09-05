(() => {
  const grid = document.querySelector('.trips-grid');
  if (!grid) return;
  const tripFiles = ['tioman-on-request.json', 'sipadan-sample.json', 'raja-ampat-sample.json'];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const list = (items = []) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const section = (title, items, className = '') => items?.length ? `<section class="trip-dialog-section ${className}"><h3>${escapeHtml(title)}</h3><ul>${list(items)}</ul></section>` : '';
  const dialog = document.createElement('dialog');
  dialog.className = 'trip-dialog';
  dialog.innerHTML = '<div class="trip-dialog-body"><button class="trip-dialog-close" type="button" aria-label="Close trip details">×</button></div>';
  document.body.append(dialog);
  const body = dialog.querySelector('.trip-dialog-body');

  const render = (trip) => {
    const isSample = trip.status === 'Sample trip';
    const rulesTitle = isSample ? 'Sample planning details' : 'Planning details';
    body.innerHTML = `
      <button class="trip-dialog-close" type="button" aria-label="Close trip details">×</button>
      <header class="trip-dialog-header">
        <p class="trip-dialog-status">${escapeHtml(trip.status)} · ${escapeHtml(trip.location)}</p>
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
        <a class="btn btn-primary" href="contact.html">${escapeHtml(trip.inquiryLabel)}</a>
      </div>`;
    dialog.setAttribute('aria-labelledby', 'trip-dialog-title');
    dialog.setAttribute('aria-describedby', 'trip-dialog-summary');
    dialog.showModal();
  };

  Promise.all(tripFiles.map((file) => fetch(`../data/trips/${file}`).then((response) => response.json())))
    .then((trips) => {
      grid.innerHTML = trips.map((trip, index) => `<article class="trip-card${index === 0 ? ' featured' : ''}"><div class="trip-badge">${escapeHtml(trip.status)}</div><div class="trip-header"><h3>${escapeHtml(trip.title)}</h3><span class="trip-location">${escapeHtml(trip.location)}</span></div><div class="trip-content"><p>${escapeHtml(trip.summary)}</p><ul class="trip-details"><li><strong>Travel dates:</strong> ${escapeHtml(trip.travelDates)}</li><li><strong>Duration:</strong> ${escapeHtml(trip.duration)}</li><li><strong>Difficulty:</strong> ${escapeHtml(trip.difficulty)}</li><li><strong>Group Size:</strong> ${escapeHtml(trip.groupSize)}</li></ul><button class="btn btn-primary trip-details-trigger" type="button" data-trip-id="${escapeHtml(trip.id)}">View Details</button></div></article>`).join('');
      grid.querySelectorAll('.trip-details-trigger').forEach((button) => button.addEventListener('click', () => render(trips.find((trip) => trip.id === button.dataset.tripId))));
    })
    .catch(() => { grid.innerHTML = '<p class="trip-data-error">Trip information is temporarily unavailable.</p>'; });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('.trip-dialog-close')) dialog.close();
  });
})();

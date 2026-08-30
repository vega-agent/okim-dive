(() => {
  const grid = document.querySelector('.trips-grid');
  if (!grid) return;
  const tripFiles = ['sipadan-sample.json', 'raja-ampat-sample.json'];
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const list = (items) => items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const dialog = document.createElement('dialog');
  dialog.className = 'trip-dialog';
  dialog.innerHTML = '<button class="trip-dialog-close" type="button" aria-label="Close trip details">×</button><div class="trip-dialog-body"></div>';
  document.body.append(dialog);
  const body = dialog.querySelector('.trip-dialog-body');
  const render = (trip) => {
    body.innerHTML = `<p class="trip-location">${escapeHtml(trip.status)} · ${escapeHtml(trip.location)}</p><h2>${escapeHtml(trip.title)}</h2><p>${escapeHtml(trip.summary)}</p><dl class="trip-facts"><div><dt>Travel dates</dt><dd>${escapeHtml(trip.travelDates)}</dd></div><div><dt>Duration</dt><dd>${escapeHtml(trip.duration)}</dd></div><div><dt>Difficulty</dt><dd>${escapeHtml(trip.difficulty)}</dd></div><div><dt>Group size</dt><dd>${escapeHtml(trip.groupSize)}</dd></div><div><dt>Cost</dt><dd>${escapeHtml(trip.cost.amount)} <small>${escapeHtml(trip.cost.basis)}</small></dd></div></dl><h3>Highlights</h3><ul>${list(trip.highlights)}</ul><h3>Sample itinerary</h3><ul>${list(trip.itinerary)}</ul><h3>Included</h3><ul>${list(trip.included)}</ul><h3>Sample booking rules</h3><ul class="trip-rules"><li><strong>Deposit:</strong> ${escapeHtml(trip.bookingRules.deposit)}</li><li><strong>Balance:</strong> ${escapeHtml(trip.bookingRules.balanceDue)}</li><li><strong>Cancellation:</strong> ${escapeHtml(trip.bookingRules.cancellation)}</li><li><strong>Requirements:</strong> ${escapeHtml(trip.bookingRules.requirements)}</li></ul><p class="trip-note">${escapeHtml(trip.notes)}</p><a class="btn btn-primary" href="contact.html">${escapeHtml(trip.inquiryLabel)}</a>`;
    dialog.showModal();
  };
  Promise.all(tripFiles.map((file) => fetch(`../data/trips/${file}`).then((response) => response.json())))
    .then((trips) => {
      grid.innerHTML = trips.map((trip, index) => `<article class="trip-card${index === 0 ? ' featured' : ''}"><div class="trip-badge">${escapeHtml(trip.status)}</div><div class="trip-header"><h3>${escapeHtml(trip.title)}</h3><span class="trip-location">${escapeHtml(trip.location)}</span></div><div class="trip-content"><p>${escapeHtml(trip.summary)}</p><ul class="trip-details"><li><strong>Duration:</strong> ${escapeHtml(trip.duration)}</li><li><strong>Difficulty:</strong> ${escapeHtml(trip.difficulty)}</li><li><strong>Group Size:</strong> ${escapeHtml(trip.groupSize)}</li></ul><button class="btn btn-primary trip-details-trigger" type="button" data-trip-id="${escapeHtml(trip.id)}">View Details</button></div></article>`).join('');
      grid.querySelectorAll('.trip-details-trigger').forEach((button) => button.addEventListener('click', () => render(trips.find((trip) => trip.id === button.dataset.tripId))));
    })
    .catch(() => { grid.innerHTML = '<p class="trip-data-error">Trip information is temporarily unavailable.</p>'; });
  dialog.querySelector('.trip-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
})();

import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

// M6 cross-part integration (this chat's mandate: all parts work together).
// Real actions end-to-end: portal creates + publishes a trip → diver books via
// the wizard → Iris records/verifies the deposit + approves eligibility →
// trip ends → Iris completes → My Okim shows the past trip + unlocked points.
// ZERO email sends: sign-ins use the token-insert callback, not the email form.
config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const actionIds = {};

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL('**/trips');
  await page.request.get('/api/auth/session');
}

function multipart(fields) {
  const boundary = '----okim' + randomUUID().replace(/-/g, '');
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${v}\r\n`);
    }
  }
  parts.push(`--${boundary}--\r\n`);
  return { data: parts.join(''), headers: { Origin: 'http://localhost:3100', 'Content-Type': `multipart/form-data; boundary=${boundary}` } };
}

async function call(page, path, label, fields) {
  await page.goto(path);
  const forms = await page.locator('form').evaluateAll(fs => fs.map(f => ({
    text: f.textContent,
    id: [...f.querySelectorAll('input')].find(i => i.name.startsWith('$ACTION_ID_'))?.name.slice(11),
  })));
  const id = forms.find(f => f.text.includes(label))?.id || actionIds[label];
  expect(id, `compiled reference for ${label} on ${path}`).toBeTruthy();
  actionIds[label] = id;
  return page.request.post(path, multipart({ [`$ACTION_ID_${id}`]: '', ...fields }));
}

const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * 86400000).toISOString().slice(0, 10);

test('M6 integration: portal trip → diver booking → verification → completion → My Okim', async ({ page }) => {
  const prefix = `M6I-${randomUUID()}`;
  const email = `${prefix.toLowerCase()}@okimdive.com`;
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  const title = `${prefix} Fictional Integration Reef`;
  let tripId = null;
  let customerId = null;
  try {
    // PART 1 — Trip creation (portal, real actions): draft → facts → EN+ZH → open.
    await login(page, instructor);
    await call(page, '/portal/trips/new', 'Create draft', { titleEn: title });
    const [trip] = await sql`SELECT id, slug FROM trips WHERE title_en = ${title}`;
    expect(trip).toBeTruthy();
    tripId = trip.id;
    const editor = `/portal/trips/${trip.id}`;
    await call(page, editor, 'Save settings', {
      tripId: trip.id, slug: trip.slug, currency: 'MYR', priceAmount: '100', depositType: 'percent', depositValue: '30',
      balanceDueDays: '30', capacity: '2', minParticipants: '1', rmRate: '1',
      travelStart: iso(10), travelEnd: iso(12), reqCertLevel: 'Open Water', reqMinDives: '5', reqMedical: 'on',
    });
    const content = (locale, t, loc, sum) => ({ tripId: trip.id, locale, title: t, location: loc, summary: sum, highlights: [`${t} highlight`], itinerary: [`${t} day one`], included: [`${t} guided dives`] });
    await call(page, `${editor}/content`, 'Save content', content('en', title, 'Fictional Island', 'A fictional reef trip for integration testing.'));
    await call(page, `${editor}/content`, 'Save content', content('zh', `${prefix} 虚构集成珊瑚礁`, '虚构岛屿', '用于集成测试的虚构珊瑚礁行程。'));
    await call(page, editor, 'Open for booking', { tripId: trip.id, state: 'open' });
    expect((await sql`SELECT status, published FROM trips WHERE id = ${trip.id}`)[0]).toMatchObject({ status: 'open', published: true });
    expect(await (await page.request.get(`/trips/${trip.slug}`)).text()).toContain(title);

    // PART 2 — Diver booking (real wizard UI; token-insert sign-in, zero sends).
    await login(page, email);
    [customerId] = (await sql`SELECT id FROM customers WHERE email = ${email}`).map(c => c.id);
    await page.goto(`/book/${trip.slug}`);
    // No stashed name (direct callback) → fallback setup card, then the wizard.
    await expect(page.locator('#setup-name')).toBeVisible();
    await page.fill('#setup-name', email.split('@')[0]);
    await page.click('.customer-setup button');
    await expect(page.locator('#b-name')).toBeVisible();
    await page.selectOption('select[name="cert_level"]', 'Open Water');
    await page.fill('#b-dives', '25');
    await page.check('input[name="insurance"]');
    await page.check('input[name="medical"]');
    await page.fill('#b-emergency-name', 'Emergency Contact');
    await page.fill('#b-emergency-phone', '+60 12 000 0000');
    await page.fill('#b-dob', '1990-05-15');
    await page.locator('.booking-policy summary').click();
    await page.check('input[name="accept_policy"]');
    await page.click('.booking-card button[type="submit"]');
    await expect(page.locator('.booking-id')).toBeVisible();
    const bookingId = (await page.locator('.booking-id').textContent()).trim();
    expect((await sql`SELECT status FROM bookings WHERE id = ${bookingId}`)[0].status).toBe('awaiting_deposit');

    // My Okim shows the new booking on Upcoming with its invoice link.
    await page.goto('/myokim');
    const card = page.locator('#my-panel-upcoming .my-subcard').filter({ hasText: bookingId });
    await expect(card).toContainText('Awaiting deposit');
    await expect(card.locator(`a[href="/invoice/${bookingId}"]`)).toBeVisible();

    // PART 3 — Instructor confirmation: record + verify deposit, approve eligibility.
    await login(page, instructor);
    await call(page, '/portal', 'Received', { bookingId, amount: '30', kind: 'deposit', paidOn: '2026-01-01', operationKey: randomUUID() });
    const [claim] = await sql`SELECT id FROM payment_claims WHERE booking_id = ${bookingId} AND status = 'verified'`;
    expect((await sql`SELECT status, eligibility_status FROM bookings WHERE id = ${bookingId}`)[0]).toMatchObject({ status: 'confirmed', eligibility_status: 'approved' });

    // Diver sees Confirmed + receipt; no points awarded before individual completion.
    await login(page, email);
    await page.goto('/myokim');
    await expect(page.locator('#my-panel-upcoming .my-subcard').filter({ hasText: bookingId }).locator('.status-badge').filter({ hasText: 'Confirmed' })).toBeVisible();
    await expect(page.locator(`#my-panel-upcoming a[href="/receipt/PAY-${claim.id}"]`)).toBeVisible();
    await page.locator('#my-tab-points').click();
    expect(await page.locator('.my-stat').evaluateAll(els => els.map(e => e.querySelector('.my-stat-value').textContent))).toEqual(['0', '0']);

    // PART 4 — Trip ends, Iris completes; My Okim moves it to Past, points unlock.
    await login(page, instructor);
    await sql`UPDATE trips SET travel_end = ${new Date(Date.now() - 86400000).toISOString()} WHERE id = ${trip.id}`;
    await call(page, '/portal', 'Complete individual booking', { bookingId, participated: 'on' });
    expect((await sql`SELECT status FROM bookings WHERE id = ${bookingId}`)[0].status).toBe('completed');
    await login(page, email);
    await page.goto('/myokim');
    await expect(page.locator('#my-panel-upcoming')).not.toContainText(bookingId);
    await page.locator('#my-tab-past').click();
    const pastRow = page.locator('.my-past-row').filter({ hasText: bookingId });
    await expect(pastRow).toContainText('Completed');
    await expect(pastRow.locator(`a[href="/invoice/${bookingId}"]`)).toBeVisible();
    await page.locator('#my-tab-points').click();
    expect(await page.locator('.my-stat').evaluateAll(els => els.map(e => e.querySelector('.my-stat-value').textContent))).toEqual(['30', '30']);
  } finally {
    if (customerId) {
      const bookingIds = (await sql`SELECT id FROM bookings WHERE customer_id = ${customerId}`).map(b => b.id);
      if (bookingIds.length) {
        await sql`DELETE FROM audit_log WHERE entity_id IN (SELECT id FROM payments WHERE booking_id = ANY(${bookingIds}) UNION SELECT id FROM payment_claims WHERE booking_id = ANY(${bookingIds})) OR entity_id = ANY(${bookingIds})`;
        await sql`DELETE FROM points_ledger WHERE booking_id = ANY(${bookingIds})`;
        await sql`DELETE FROM payments WHERE booking_id = ANY(${bookingIds})`;
        await sql`DELETE FROM payment_claims WHERE booking_id = ANY(${bookingIds})`;
        await sql`DELETE FROM invoices WHERE booking_id = ANY(${bookingIds})`;
        await sql`DELETE FROM bookings WHERE id = ANY(${bookingIds})`;
      }
      await sql`DELETE FROM audit_log WHERE entity = 'customer' AND entity_id = ${customerId}`;
      await sql`DELETE FROM customers WHERE id = ${customerId}`;
    }
    if (tripId) {
      await sql`DELETE FROM audit_log WHERE entity_id = ${tripId}`;
      await sql`DELETE FROM trips WHERE id = ${tripId}`;
    }
    await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${email})`;
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM users WHERE email = ${email}`;
  }
});
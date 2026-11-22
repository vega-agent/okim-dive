import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
let publishId = null;

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL('**/trips');
  await page.request.get('/api/auth/session');
}

async function publish(page, tripId, fields) {
  await page.goto(`/portal/trips/${tripId}/messages`);
  if (!publishId) {
    publishId = await page.locator('form').evaluateAll(fs => fs.map(f => ({ text: f.textContent, id: [...f.querySelectorAll('input')].find(i => i.name.startsWith('$ACTION_ID_'))?.name.slice(11) })).find(f => f.text.includes('Publish to divers'))?.id);
  }
  expect(publishId).toBeTruthy();
  return page.request.post(`/portal/trips/${tripId}/messages`, {
    headers: { Origin: 'http://localhost:3100' },
    multipart: { [`$ACTION_ID_${publishId}`]: '', tripId, ...fields },
  });
}

test('trip messages actions: bilingual gate, publish, view-time audience, edit/delete audit, zero emails', async ({ page, browser }) => {
  const prefix = `msgP-${randomUUID()}`;
  const tripId = `${prefix}-trip`;
  const emailPaid = `${prefix.toLowerCase()}-paid@okimdive.com`;
  const emailHold = `${prefix.toLowerCase()}-hold@okimdive.com`;
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  const ids = { paid: null, hold: null };
  try {
    await login(page, emailPaid);
    ids.paid = (await sql`SELECT id FROM customers WHERE email = ${emailPaid}`)[0].id;
    await sql`UPDATE customers SET name = ${prefix + ' Paid'} WHERE id = ${ids.paid}`;
    await login(page, emailHold);
    ids.hold = (await sql`SELECT id FROM customers WHERE email = ${emailHold}`)[0].id;
    await sql`UPDATE customers SET name = ${prefix + ' Hold'} WHERE id = ${ids.hold}`;
    await login(page, instructor);
    await sql`INSERT INTO trips (id, slug, title_en, title_zh, status, published, price_amount, deposit_value, capacity, travel_start, travel_end, sample) VALUES (${tripId}, ${prefix.toLowerCase()}, 'Fictional Publish Trip', '虚构发布行程', 'open', false, 100, 30, 4, ${new Date(Date.now() + 10 * 86400000).toISOString()}, ${new Date(Date.now() + 12 * 86400000).toISOString()}, true)`;
    await sql`INSERT INTO bookings (id, customer_id, product_id, status, currency, deposit_amount, balance_amount, declarations) VALUES
      (${prefix + '-bp'}, ${ids.paid}, ${tripId}, 'confirmed', 'MYR', 30, 70, '{}'),
      (${prefix + '-bh'}, ${ids.hold}, ${tripId}, 'awaiting_deposit', 'MYR', 30, 70, '{}')`;

    // Gate: missing Chinese body never publishes.
    await publish(page, tripId, { label: 'Briefing', subjectEn: 'S', subjectZh: '标题', bodyEn: 'Body', bodyZh: '', audience: 'confirmed' });
    expect((await sql`SELECT count(*)::int n FROM trip_messages WHERE trip_id = ${tripId}`)[0].n).toBe(0);

    // Publish confirmed-audience message.
    const res = await publish(page, tripId, { label: 'Briefing', subjectEn: 'Jetty at 8am', subjectZh: '早上8点码头', bodyEn: 'Bring your cert card.', bodyZh: '请携带证书卡。', audience: 'confirmed' });
    expect(res.url()).toContain('published=1');
    const [msg] = await sql`SELECT id, audience, channel FROM trip_messages WHERE trip_id = ${tripId}`;
    expect(msg.audience).toBe('confirmed');
    expect(msg.channel).toBe('platform');
    expect((await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id = ${msg.id} AND action = 'message_published'`)[0].n).toBe(1);

    // View-time audience: paid diver sees it, awaiting-deposit diver does not.
    const paidCtx = await browser.newContext();
    const paidPage = await paidCtx.newPage();
    await login(paidPage, emailPaid);
    await paidPage.goto('/myokim');
    await expect(paidPage.locator(`#messages-${prefix}-bp`)).toContainText('Jetty at 8am');
    await paidCtx.close();
    const holdCtx = await browser.newContext();
    const holdPage = await holdCtx.newPage();
    await login(holdPage, emailHold);
    await holdPage.goto('/myokim');
    expect(await holdPage.locator(`#messages-${prefix}-bh`).count()).toBe(0);

    // all_active message reaches the hold diver too (late-booker semantics).
    await publish(page, tripId, { label: 'Weather', subjectEn: 'Calm seas forecast', subjectZh: '预计风平浪静', bodyEn: 'Good visibility expected.', bodyZh: '预计能见度良好。', audience: 'all_active' });
    await holdPage.reload();
    await expect(holdPage.locator(`#messages-${prefix}-bh`)).toContainText('Calm seas forecast');
    expect(await holdPage.locator(`#messages-${prefix}-bh`)).not.toContainText('Jetty at 8am');
    await holdCtx.close();

    // Edit via UI: audit keeps the before-text.
    await page.goto(`/portal/trips/${tripId}/messages`);
    await page.locator('.msg-outbox .msg-row', { hasText: 'Jetty at 8am' }).getByRole('button', { name: 'Edit' }).click();
    await page.fill('#msg-subject-en', 'Jetty at 9am (changed)');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.portal-success')).toBeVisible();
    const edited = (await sql`SELECT subject_en FROM trip_messages WHERE id = ${msg.id}`)[0];
    expect(edited.subject_en).toBe('Jetty at 9am (changed)');
    const editAudit = (await sql`SELECT meta FROM audit_log WHERE entity_id = ${msg.id} AND action = 'message_edited'`)[0];
    expect(editAudit.meta.before.subjectEn).toBe('Jetty at 8am');

    // Delete via UI two-step: soft delete, gone from diver feed, audit keeps text.
    await page.locator('.msg-outbox .msg-row', { hasText: 'Jetty at 9am' }).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page.locator('.msg-outbox .msg-row', { hasText: 'Jetty at 9am' })).toHaveCount(0);
    expect((await sql`SELECT deleted_at FROM trip_messages WHERE id = ${msg.id}`)[0].deleted_at).not.toBeNull();
    expect((await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id = ${msg.id} AND action = 'message_deleted'`)[0].n).toBe(1);
    const paidCtx2 = await browser.newContext();
    const paidPage2 = await paidCtx2.newPage();
    await login(paidPage2, emailPaid);
    await paidPage2.goto('/myokim');
    // The deleted briefing is gone; the all_active weather message remains.
    await expect(paidPage2.locator(`#messages-${prefix}-bp`)).toContainText('Calm seas forecast');
    expect(await paidPage2.locator(`#messages-${prefix}-bp`).getByText('Jetty at 9am').count()).toBe(0);
    await paidCtx2.close();
  } finally {
    await sql`DELETE FROM message_reads WHERE customer_id IN (${ids.paid}, ${ids.hold})`;
    await sql`DELETE FROM audit_log WHERE entity_id IN (SELECT id FROM trip_messages WHERE trip_id = ${tripId})`;
    await sql`DELETE FROM trip_messages WHERE trip_id = ${tripId}`;
    await sql`DELETE FROM bookings WHERE id IN (${prefix + '-bp'}, ${prefix + '-bh'})`;
    await sql`DELETE FROM trips WHERE id = ${tripId}`;
    for (const [e, id] of [[emailPaid, ids.paid], [emailHold, ids.hold]]) {
      await sql`DELETE FROM customers WHERE id = ${id}`;
      await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${e})`;
      await sql`DELETE FROM verification_tokens WHERE identifier = ${e}`;
      await sql`DELETE FROM users WHERE email = ${e}`;
    }
  }
});
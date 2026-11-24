import { openReviewSession } from './support/review-session.mjs'
import { stagedBookingRows, deleteStagedBookingRows } from './support/staged-booking.mjs'
import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

async function login(page, email) {
  // The callback redirect chain can abort the goto in long suite runs; retry
  // once with a FRESH single-use token, then verify the destination.
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = randomUUID();
    const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
    await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email},${token},${new Date(Date.now()+900000).toISOString()})`;
    const url = `/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`;
    try { await page.goto(url, { waitUntil: 'commit' }); } catch { /* redirect race */ }
    try { await page.waitForURL('**/trips', { timeout: 5000 }); break; }
    catch { if (attempt === 1) throw new Error('token login failed for ' + email); }
  }
  await page.request.get('/api/auth/session');
}

// Read-only rendered checks on an UNPUBLISHED fixture trip (no public-page
// impact, zero email sends). Messages inserted via SQL; feed + outbox verified.
test('trip messages rendered: diver feed unread/read + CN, instructor outbox + composer switch, overflow and targets', async ({ page }) => {
  const prefix = `msgR-${randomUUID()}`;
  const email = `${prefix.toLowerCase()}@example.com`;
  const tripId = `${prefix}-trip`;
  let customerId = null;
  const instructorSessions = []
  try {
    await login(page, email);
    [customerId] = (await sql`SELECT id FROM customers WHERE email = ${email}`).map(c => c.id);
    await sql`UPDATE customers SET name = ${prefix + ' Diver'}, locale = 'en' WHERE id = ${customerId}`;
    await sql`INSERT INTO trips (id, slug, title_en, title_zh, status, published, price_amount, deposit_value, capacity, travel_start, travel_end, sample) VALUES (${tripId}, ${prefix.toLowerCase()}, 'Fictional Messages Trip', '虚构消息行程', 'open', false, 100, 30, 4, ${new Date(Date.now() + 10 * 86400000).toISOString()}, ${new Date(Date.now() + 12 * 86400000).toISOString()}, true)`;
    await sql.transaction(stagedBookingRows(sql,{id:prefix+'-b1',customerId,tripId,status:'confirmed'}))
    await sql`INSERT INTO trip_messages (id, trip_id, label, subject_en, subject_zh, body_en, body_zh, audience, published_by) VALUES
      (${prefix + '-m1'}, ${tripId}, 'Briefing', 'Meeting point and boat', '集合地点与船期', 'Meet at the jetty at 8am. Bring your cert card.', '早上8点在码头集合。请携带证书卡。', 'confirmed', 'fixture'),
      (${prefix + '-m2'}, ${tripId}, 'Checklist', 'What to bring', '携带物品', 'Swimwear, reef-safe sunscreen, seasickness meds.', '泳衣、珊瑚友好防晒霜、晕船药。', 'all_active', 'fixture')`;

    // Diver feed: both messages, unread dots, open marks read.
    await page.goto('/myokim');
    const feed = page.locator(`#messages-${prefix}-b1`);
    await expect(feed).toBeVisible();
    await expect(feed).toContainText('Meeting point and boat');
    await expect(feed).toContainText('What to bring');
    expect(await feed.locator('.msg-unread-dot').count()).toBe(2);
    const first = feed.locator('details').first();
    await first.locator('summary').click();
    await expect(first.locator('.msg-feed-body')).toContainText('Meet at the jetty at 8am');
    await expect.poll(async () => (await sql`SELECT count(*)::int n FROM message_reads WHERE message_id = ${prefix + '-m1'} AND customer_id = ${customerId}`)[0].n).toBe(1);
    await page.reload();
    expect(await page.locator(`#messages-${prefix}-b1 .msg-unread-dot`).count()).toBe(1);

    // CN: browsing language renders the Chinese content (#33).
    await page.evaluate(() => localStorage.setItem('okim-language', 'zh'));
    await page.reload();
    await expect(feed).toContainText('集合地点与船期');
    await feed.locator('details').nth(1).locator('summary').click();
    await expect(feed.locator('details').nth(1).locator('.msg-feed-body')).toContainText('泳衣');
    const diverMetrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      small: [...document.querySelectorAll('.msg-feed summary')].filter(el => el.getBoundingClientRect().height < 44).length,
    }));
    expect(diverMetrics.overflow).toBe(false);
    expect(diverMetrics.small).toBe(0);

    // Instructor outbox: seen counts, label filter, composer language switch.
    instructorSessions.push(await openReviewSession(page));
    await page.evaluate(() => localStorage.setItem('okim-language', 'en'));
    await page.goto(`/portal/trips/${tripId}/messages`);
    await expect(page.locator('.msg-outbox')).toContainText('Meeting point and boat');
    await expect(page.locator('.msg-outbox')).toContainText('Seen by 1 of 1');
    await page.locator('.msg-filter .kind-pill', { hasText: 'Checklist' }).click();
    await expect(page.locator('.msg-outbox .msg-row')).toHaveCount(1);
    await expect(page.locator('.msg-outbox')).toContainText('What to bring');
    await page.locator('.msg-filter .kind-pill', { hasText: 'All' }).click();
    await expect(page.locator('.msg-outbox .msg-row')).toHaveCount(2);
    await expect(page.locator('#msg-subject-en')).toBeVisible();
    await expect(page.locator('#msg-subject-zh')).toBeHidden();
    await page.locator('.content-lang-pill', { hasText: '中文' }).first().click();
    await expect(page.locator('#msg-subject-zh')).toBeVisible();
    await expect(page.locator('#msg-subject-en')).toBeHidden();
    const instructorMetrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      small: [...document.querySelectorAll('main button, main input:not([type=hidden]):not([type=radio]), main textarea')]
        .filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44).length,
    }));
    expect(instructorMetrics.overflow).toBe(false);
    expect(instructorMetrics.small).toBe(0);
  } finally {
    for (const dispose of instructorSessions) await dispose()
    await sql`DELETE FROM message_reads WHERE customer_id = ${customerId}`;
    await sql`DELETE FROM trip_messages WHERE trip_id = ${tripId}`;
    await sql.transaction(deleteStagedBookingRows(sql,[prefix+'-b1']))
    await sql`DELETE FROM trips WHERE id = ${tripId}`;
    await sql`DELETE FROM customers WHERE id = ${customerId}`;
    await sql`DELETE FROM sessions WHERE "userId" IN (SELECT id FROM users WHERE email = ${email})`;
    await sql`DELETE FROM verification_tokens WHERE identifier = ${email}`;
    await sql`DELETE FROM users WHERE email = ${email}`;
  }
});
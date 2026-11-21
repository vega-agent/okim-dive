import { test, expect } from '@playwright/test';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createHash, randomUUID } from 'node:crypto';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
let actionId = null;

async function login(page, email) {
  const raw = randomUUID();
  const token = createHash('sha256').update(raw + process.env.AUTH_SECRET).digest('hex');
  await sql`INSERT INTO verification_tokens (identifier, token, expires) VALUES (${email}, ${token}, ${new Date(Date.now() + 900000).toISOString()})`;
  await page.goto(`/api/auth/callback/resend?callbackUrl=${encodeURIComponent('http://localhost:3100/trips')}&token=${raw}&email=${encodeURIComponent(email)}`);
  await page.waitForURL('**/trips');
  await page.request.get('/api/auth/session');
}

async function publish(page, fields) {
  await page.goto('/portal/policies/refund');
  if (!actionId) {
    actionId = await page.locator('form').evaluateAll(fs => fs.map(f => [...f.querySelectorAll('input')].find(i => i.name.startsWith('$ACTION_ID_'))?.name.slice(11)).find(Boolean));
  }
  expect(actionId).toBeTruthy();
  return page.request.post('/portal/policies/refund', { headers: { Origin: 'http://localhost:3100' }, multipart: { [`$ACTION_ID_${actionId}`]: '', ...fields } });
}

test('M5 policy publishing: bilingual gate, immutable N+1, live for new bookings, audit, snapshot preserved', async ({ page, browser }) => {
  const instructor = process.env.AUTH_INSTRUCTOR_EMAILS.split(',')[0].trim();
  await login(page, instructor);
  const prefix = `policy-${randomUUID()}`;
  const bodyEn = `FICTIONAL POLICY TEST ${prefix} — full refund wording for automated testing.`;
  const bodyZh = `虚构政策测试 ${prefix}——用于自动化测试的全额退款条款。`;
  const v1Before = (await sql`SELECT body_en, body_zh FROM policy_versions WHERE id = 'POL-REFUND-001'`)[0];
  try {
    // Gate: missing Chinese text or missing confirmation never creates a version.
    await publish(page, { kind: 'refund', bodyEn, bodyZh: '', confirm: 'on' });
    await publish(page, { kind: 'refund', bodyEn, bodyZh, confirm: '' });
    expect((await sql`SELECT count(*)::int n FROM policy_versions WHERE kind = 'refund'`)[0].n).toBe(1);

    // Publish: new immutable version, both languages together, audited.
    const res = await publish(page, { kind: 'refund', bodyEn, bodyZh, confirm: 'on' });
    expect(res.url()).toContain('published=2');
    const v2 = (await sql`SELECT id, version, body_en, body_zh, created_by FROM policy_versions WHERE id = 'POL-REFUND-002'`)[0];
    expect(v2.version).toBe(2);
    expect(v2.body_en).toBe(bodyEn);
    expect(v2.body_zh).toBe(bodyZh);
    const [actor] = await sql`SELECT id FROM users WHERE email = ${instructor}`;
    expect(v2.created_by).toBe(actor.id);
    expect((await sql`SELECT count(*)::int n FROM audit_log WHERE entity_id = 'POL-REFUND-002' AND action = 'policy_version_published'`)[0].n).toBe(1);

    // Live immediately for NEW bookings: the wizard renders the latest version.
    // Anonymous context — the instructor session would land on the setup card.
    const anon = await browser.newContext();
    const bookHtml = await (await anon.request.get('/book/tioman-reef-weekend')).text();
    await anon.close();
    expect(bookHtml).toContain(bodyEn);

    // Immutability: v1 untouched; no booking references the fixture version.
    const v1After = (await sql`SELECT body_en, body_zh FROM policy_versions WHERE id = 'POL-REFUND-001'`)[0];
    expect(v1After).toEqual(v1Before);
    expect((await sql`SELECT count(*)::int n FROM bookings WHERE policy_version_id = 'POL-REFUND-002'`)[0].n).toBe(0);

    // Portal reflects the new current version.
    await page.goto('/portal');
    await expect(page.locator('#policies')).toContainText('v2');
  } finally {
    await sql`DELETE FROM audit_log WHERE entity_id = 'POL-REFUND-002'`;
    await sql`DELETE FROM policy_versions WHERE id = 'POL-REFUND-002'`;
  }
});
/**
 * M4 seed: policy versions v1 (refund / privacy / terms).
 * Owner-approved for demo use 2026-11-20 (MVP-SPEC decision #21); final wording
 * pending Iris confirmation. Each body carries a visible draft note.
 * Versioned: bookings snapshot the accepted version; edits create NEW versions.
 * Run: node scripts/seed-policies.ts   (idempotent upsert by kind+version)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq } from 'drizzle-orm'
import { policyVersions } from '../src/db/schema.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set (check .env.local). Aborting.')
  process.exit(1)
}
const db = drizzle(neon(connectionString))

const DRAFT_EN = 'Demo wording approved by the owner. Final text is pending instructor confirmation.'
const DRAFT_ZH = '演示措辞已经营者批准，最终文本待教练确认。'

const refundEn = `${DRAFT_EN}

Refunds — Okim Dive

How refunds work
All payments are made externally (bank transfer or PayNow) using your Booking ID as the transfer reference. After paying, send your transfer screenshot to Iris via WhatsApp. Iris checks the payment against the bank record and confirms your slot only after the deposit is verified, subject to availability.

Refund situations
1. Iris cancels the trip (weather, minimum participants not met, operator issues): full refund of deposit and balance. Any Okim Points earned from this booking are reversed.
2. The trip fills up after your payment is verified: full refund, or an alternative departure agreed with you. Points reversed if refunded.
3. You paid but your eligibility declaration is declined: full refund. Points reversed.
4. You cancel on or before the balance deadline stated on your invoice: the balance is refunded; the deposit is forfeited (it covers boat and administration commitments).
5. You cancel after the balance deadline, or do not show: no refund. Iris may, at her discretion, offer a transfer to a future trip.

Requesting a refund
Contact Iris through the contact page or WhatsApp with your Booking ID. Refunds are executed externally by Iris and recorded against your booking. The refund policy version you accepted at booking governs your booking, even if this page is later updated.`

const refundZh = `${DRAFT_ZH}

退款政策 — Okim Dive

退款如何运作
所有款项均通过外部方式支付（银行转账或 PayNow），并以你的预订编号（Booking ID）作为转账备注。付款后，请通过 WhatsApp 将转账截图发给 Iris。Iris 会核对银行记录，只有在订金核实后、且仍有名额的情况下，才会确认你的名额。

退款情形
1. Iris 取消行程（天气、未达成团人数、运营商问题）：全额退还订金与尾款。该预订已获得的 Okim 积分将被冲回。
2. 你的付款核实后行程已满：全额退款，或与你协商改期。退款时积分冲回。
3. 已付款但资格申报未获批准：全额退款，积分冲回。
4. 你在发票所载尾款截止日期当日或之前取消：退还尾款；订金不予退还（用于覆盖船只与行政承诺）。
5. 你在尾款截止日期之后取消或未出席：不予退款。Iris 可酌情安排转入未来行程。

申请退款
请通过联系页面或 WhatsApp 联系 Iris，并提供预订编号。退款由 Iris 在外部执行并记录在你的预订下。即使本页面日后更新，你的预订仍适用预订时所接受的退款政策版本。`

const privacyEn = `${DRAFT_EN}

Privacy — Okim Dive

What we collect in the app
- Contact details: name, email, and optional WhatsApp number.
- Booking declarations: certification level, logged dives, insurance confirmation, medical self-declaration, emergency contact, and date of birth.
- Inquiry messages and your language preference.
We do not store passwords. Sign-in uses single-use email magic links.

Payment screenshots
Payment screenshots are NOT uploaded to the app. You send them to Iris via WhatsApp as payment evidence. They stay in Iris's instructor-only records, are never shown to other customers, and are kept until the trip is completed and the refund window has closed, then deleted.

Who can see your data
Only Iris (the instructor and data controller). Service processors: Neon (database), Resend (email delivery), Vercel (hosting). We never sell or share your data for marketing.

Retention and your rights
Booking and payment records are kept as long as needed for the business relationship and legal obligations. Declarations are collected only to assess dive suitability — Iris, not software, makes safety decisions. Under Malaysia's PDPA you may request access, correction, or deletion of your personal data via the contact page. Sensitive data (medical declarations, emergency contacts) is instructor-only and encrypted at rest.`

const privacyZh = `${DRAFT_ZH}

隐私政策 — Okim Dive

我们在应用内收集的信息
- 联系方式：姓名、电子邮件，以及选填的 WhatsApp 号码。
- 预订申报：认证等级、记录潜水次数、保险确认、健康自我申报、紧急联系人、出生日期。
- 咨询内容与语言偏好。
我们不存储密码。登录使用一次性电子邮件魔法链接。

付款截图
付款截图不会上传到应用。你通过 WhatsApp 将截图发给 Iris 作为付款凭证。截图仅保存在 Iris 的教练专用记录中，绝不向其他客户展示，并保留至行程结束且退款窗口关闭后删除。

谁可以看到你的数据
仅 Iris（教练兼数据控制者）。服务处理方：Neon（数据库）、Resend（邮件发送）、Vercel（托管）。我们绝不出售或为营销目的共享你的数据。

保留与你的权利
预订与付款记录在业务关系及法律义务所需期间内保留。申报信息仅用于评估潜水适宜性——安全决定由 Iris 本人作出，而非软件。根据马来西亚 PDPA，你可通过联系页面申请查阅、更正或删除个人数据。敏感信息（健康申报、紧急联系人）仅限教练访问，并以加密方式存储。`

const termsEn = `${DRAFT_EN}

Terms of Booking — Okim Dive

1. Booking and slot confirmation
A booking is a request until the deposit is verified. An awaiting-deposit booking does not reserve a slot: another diver may take the remaining space until Iris verifies your deposit, at which point availability is re-checked. If the trip filled meanwhile, your payment is recorded and flagged for refund or an agreed alternative.

2. Payments
Payments are external (bank transfer or PayNow) with your Booking ID as reference. Send the transfer screenshot to Iris via WhatsApp. The balance is due by the deadline on your invoice.

3. Eligibility and safety
You must meet the trip's requirements and declare them truthfully. Iris reviews declarations and makes all dive-suitability decisions. A confirmed slot does not imply eligibility approval. If you are declined after paying, you receive a full refund.

4. Refunds
The refund policy version you accept at booking governs your booking.

5. Okim Points
Points are earned only on instructor-verified payments (1 point per RM 1 of the verified amount, converted at the trip's rate), usable only after the trip completes, expire after 12 months, and are reversed on refunds. Points never override eligibility or safety requirements.

6. Liability
Diving carries inherent risks. Final waiver and liability wording is pending legal review and instructor confirmation; this demo text does not replace it.

7. Minors
Age is declared at booking. Minimum-age and parental-consent rules are set by Iris per trip.`

const termsZh = `${DRAFT_ZH}

预订条款 — Okim Dive

1. 预订与名额确认
订金核实前，预订仅为申请。待付订金的预订不保留名额：在 Iris 核实你的订金之前，其他潜水员可能订走剩余名额；核实时将重新检查名额。若期间行程已满，你的付款仍会被记录，并标记为退款或协商替代方案。

2. 付款
付款通过外部方式（银行转账或 PayNow），以预订编号为备注。请通过 WhatsApp 将转账截图发给 Iris。尾款须于发票所载截止日期前缴清。

3. 资格与安全
你须满足行程要求并如实申报。Iris 审核申报并作出所有潜水适宜性决定。名额确认不代表资格获批。若付款后被拒，可获全额退款。

4. 退款
以你在预订时接受的退款政策版本为准。

5. Okim 积分
积分仅来自教练核实的付款（按行程汇率折算，每 RM 1 得 1 分），仅可在行程完成后使用，12 个月后过期，退款时冲回。积分绝不能绕过资格或安全要求。

6. 责任
潜水固有风险。最终免责与责任条款待法律审阅及教练确认；本演示文本不能替代正式条款。

7. 未成年人
预订时须申报年龄。最低年龄与家长同意规则由 Iris 按行程设定。`

const policies = [
  { kind: 'refund' as const, bodyEn: refundEn, bodyZh: refundZh },
  { kind: 'privacy' as const, bodyEn: privacyEn, bodyZh: privacyZh },
  { kind: 'terms' as const, bodyEn: termsEn, bodyZh: termsZh },
]

async function main() {
  for (const p of policies) {
    const existing = await db.select({ id: policyVersions.id }).from(policyVersions)
      .where(and(eq(policyVersions.kind, p.kind), eq(policyVersions.version, 1))).limit(1)
    const id = existing[0]?.id ?? `POL-${p.kind.toUpperCase()}-001`
    await db.insert(policyVersions).values({
      id, kind: p.kind, version: 1, bodyEn: p.bodyEn, bodyZh: p.bodyZh, createdBy: 'owner-demo-approval',
    }).onConflictDoUpdate({
      target: [policyVersions.kind, policyVersions.version],
      set: { bodyEn: p.bodyEn, bodyZh: p.bodyZh },
    })
    console.log(`seeded ${p.kind} policy v1 (${id})`)
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
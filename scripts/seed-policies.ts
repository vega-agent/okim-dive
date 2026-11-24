/**
 * M4 seed: policy versions v1 (refund / privacy / terms).
 * Candidate copy for a clean demo database. Publication to an existing database
 * requires a separately approved new version.
 * Versioned: bookings snapshot the accepted version; edits create NEW versions.
 * Run: node scripts/seed-policies.ts   (insert-only by kind+version)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { policyVersions } from '../src/db/schema.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL not set (check .env.local). Aborting.')
  process.exit(1)
}
const db = drizzle(neon(connectionString))

const DRAFT_EN = 'Draft for instructor review.'
const DRAFT_ZH = '草案，待教练审核。'

const refundEn = `${DRAFT_EN}

Refunds — Okim Dive

How refunds work
All payments are made externally (bank transfer or PayNow) using your Booking ID as the transfer reference. After paying, send your transfer screenshot to Iris via WhatsApp. Iris checks the payment against the bank record. A successful booking reserves one place. Iris confirms it when she verifies the full first deposit.

Payment schedule
A trip may require one or two fixed deposits, each due on a stated date, with the balance (the trip price minus all deposits) due on its own stated date. The full schedule — each amount and its due date — is shown before you book and on your booking card. If you book after a stage's due date has passed, that stage is due immediately. Deposits are non-refundable on diver-initiated exits (see below); the balance is refundable.

Refund situations
1. Iris cancels the trip (weather, minimum participants not met, operator issues): full refund of everything you paid, including all deposits.
2. Iris cancels your booking because you cannot take part safely: full refund of all payments.
3. The trip is postponed: you may accept the new dates (your place, payments and agreed payment schedule carry over) or exit with a full refund of everything paid, including deposits.
4. You cancel (withdraw) or do not show: all deposits are forfeited — they cover boat and administration commitments and are non-refundable. Any balance you paid is refunded. An unpaid balance is waived.

Missed deposit stages
A due date passing does not release your place. Iris reviews missed payments. If she cancels your booking for non-payment, paid deposits are retained and any paid final-stage amount is refundable.

Requesting a refund
Contact Iris through the contact page or WhatsApp with your Booking ID. Refunds are executed externally by Iris and recorded against your booking. The refund policy version you accepted at booking governs your booking, even if this page is later updated.`

const refundZh = `${DRAFT_ZH}

退款政策 — Okim Dive

退款如何运作
所有款项均通过外部方式支付（银行转账或 PayNow），并以你的预订编号（Booking ID）作为转账备注。付款后，请通过 WhatsApp 将转账截图发给 Iris。Iris 会核对银行记录。预订成功即为你保留一个名额。Iris 核实首笔订金全部到账后，名额即获确认。

付款时间表
行程可能要求一至两笔固定订金，每笔须在指定日期缴付；尾款（行程价格减去全部订金）则在其指定日期缴付。完整时间表——每笔金额及其截止日期——会在预订前及你的预订卡上显示。若你在某一期截止日期之后才预订，该期须立即缴付。订金在潜水员主动退出的情形下不予退还（见下文）；尾款可退还。

退款情形
1. Iris 取消行程（天气、未达成团人数、运营商问题）：全额退还你所支付的一切款项，包括全部订金。
2. 若因不适合安全参加行程，Iris 取消你的预订：全额退还所有已付款项。
3. 行程延期：你可接受新日期（名额、已付款项和原定付款安排保留），或退出并获全额退还所支付的一切款项，包括订金。
4. 你取消（退出）或未出席：全部订金不予退还——订金用于覆盖船只与行政承诺，属不可退还。你所支付的任何尾款将获退还。未缴付的尾款予以豁免。

逾期未缴的订金期
付款逾期仍保留名额，由 Iris 审核。若因未付款而取消预订，已付订金不退，已付尾款可退。

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
A successful booking reserves your place immediately. Iris confirms it after verifying the full first deposit. Iris reviews missed payments individually.

2. Payments and schedule
Payments are external (bank transfer or PayNow) with your Booking ID as reference. Send the transfer screenshot to Iris via WhatsApp. A trip may require one or two fixed deposits, each due on a stated date; the balance (trip price minus all deposits) is due on its own stated date. The full schedule is shown before you book and on your booking card. A stage whose due date has passed when you book is due immediately. Deposits are non-refundable on diver-initiated exits; the balance is refundable (see the refund policy).

3. Eligibility and safety
Check the trip requirements and give accurate information about your experience and health. Discuss any concerns with Iris before diving. If Iris cancels your booking because you cannot take part safely, all payments are refundable.

4. Refunds
The refund policy version you accept at booking governs your booking. In short: deposits are non-refundable when you cancel, do not show, or have your slot released for non-payment; any balance paid is refunded on cancellation or no-show; if Iris cancels or you decline a postponement you receive a full refund including deposits.

5. Okim Points
After your trip, Iris completes your individual booking once participation and full payment are confirmed. Points are based on net verified cash at each payment’s recorded rate, one point per whole RM. They are usable immediately and expire 12 calendar months after completion. Later refunds reverse the corresponding points. Before your first payment, ask Iris to apply available points toward the final stage, up to 20% of the original price.

6. Liability
Diving carries inherent risks. Final waiver and liability wording is pending legal review and instructor confirmation; this demo text does not replace it.

7. Minors
Age is declared at booking. Minimum-age and parental-consent rules are set by Iris per trip.`

const termsZh = `${DRAFT_ZH}

预订条款 — Okim Dive

1. 预订与名额确认
预订成功后即为你保留名额。Iris 核实首笔订金全部到账后确认预订。由 Iris 逐一审核逾期付款。

2. 付款与时间表
付款通过外部方式（银行转账或 PayNow），以预订编号为备注。请通过 WhatsApp 将转账截图发给 Iris。行程可能要求一至两笔固定订金，每笔须在指定日期缴付；尾款（行程价格减去全部订金）在其指定日期缴付。完整时间表会在预订前及你的预订卡上显示。若预订时某期截止日期已过，该期须立即缴付。订金在潜水员主动退出的情形下不予退还；尾款可退还（见退款政策）。

3. 资格与安全
请核对行程要求，并如实申报你的潜水经验与健康状况。如有疑问，请在潜水前与 Iris 沟通。若因不适合安全参加行程而由 Iris 取消预订，所有已付款项均可退还。

4. 退款
以你在预订时接受的退款政策版本为准。简言之：当你取消、未出席或因未付款而被释放名额时，订金不予退还；取消或未出席时，已缴尾款获退还；若 Iris 取消行程或你不接受改期，你可获全额退款，包括订金。

5. Okim 积分
行程结束后，Iris 核实你已参加且款项付清，再将个人预订标记为完成。积分按每笔付款的登记汇率及实收净额计算，每满 RM 1 得 1 分。积分可立即使用，自个人预订完成起 12 个日历月后到期。后续退款会冲回对应积分。首次付款前可请 Iris 使用可用积分抵扣尾款，最多抵扣行程原价的 20%。

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
    const id = `POL-${p.kind.toUpperCase()}-001`
    const inserted = await db.insert(policyVersions).values({
      id, kind: p.kind, version: 1, bodyEn: p.bodyEn, bodyZh: p.bodyZh, createdBy: 'demo-seed',
    }).onConflictDoNothing().returning({ id: policyVersions.id })
    console.log(inserted.length ? `Seeded draft ${p.kind} v1` : `Retained existing ${p.kind} v1`)
  }
}

main().catch((error) => { console.error(error); process.exit(1) })

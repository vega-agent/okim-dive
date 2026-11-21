'use client'
import { useLocale } from '@/lib/use-locale'
import { updateSettings } from '@/lib/trip-actions'
import CardHelp from '@/components/portal-card-help'

export type PortalSettingsData = {
  pointsRules: { earnRate: number; redeemValue: number; expiryMonths: number; capPct: number }
  defaultRmRate: number
  instructorEmails: string[]
  paymentInstructions: { en: string; zh: string; sample: boolean }
}

export default function PortalSettings({ data }: { data: PortalSettingsData }) {
  const locale = useLocale()
  const t = (en: string, zh: string) => locale === 'zh' ? zh : en

  return <section id="settings" className="portal-card portal-finance">
    <div className="portal-card-head">
      <h2>{t('Settings', '设置')}</h2>
      <CardHelp id="settings-help" label={t('Help: settings', '帮助：设置')}>
        <p>{t('Runtime settings live in the database, never in the code repository.', '运行时设置保存在数据库中，绝不写入代码仓库。')}</p>
        <ol>
          <li>{t('Points rules apply to future verifications; existing ledger entries keep their snapshots.', '积分规则适用于之后的核实；已有积分明细保留其快照。')}</li>
          <li>{t('The default RM rate pre-fills new trips; each trip keeps its own rate.', '默认 RM 汇率用于新行程的预填；每个行程保留自己的汇率。')}</li>
          <li>{t('Instructor emails grant portal access on next sign-in. The server environment list always keeps access as a safety fallback.', '教练邮箱在下次登录时授予工作台权限。服务器环境列表始终保留访问权限作为安全兜底。')}</li>
          <li>{t('Payment instructions stay labelled Sample until Iris confirms them. Bank details are never committed to the repository.', '付款说明在 Iris 确认前始终标注为示例。银行资料绝不提交到代码仓库。')}</li>
        </ol>
      </CardHelp>
    </div>

    <form action={updateSettings} className="booking-form portal-form">
      <h3 className="span-2">{t('Okim Points rules', 'Okim 积分规则')}</h3>
      <input type="hidden" name="key" value="points_rules" />
      <label>{t('Points per RM1', '每 RM1 积分')}<input name="earnRate" type="number" min="0" step="0.1" required defaultValue={data.pointsRules.earnRate} /></label>
      <label>{t('RM value per point', '每积分 RM 价值')}<input name="redeemValue" type="number" min="0.01" step="0.01" required defaultValue={data.pointsRules.redeemValue} /></label>
      <label>{t('Expiry (months)', '有效期（月）')}<input name="expiryMonths" type="number" min="1" step="1" required defaultValue={data.pointsRules.expiryMonths} /></label>
      <label>{t('Redemption cap (% of price)', '抵扣上限（价格百分比）')}<input name="capPct" type="number" min="1" max="20" step="1" required defaultValue={data.pointsRules.capPct} /></label>
      <button className="btn btn-secondary span-2">{t('Save points rules', '保存积分规则')}</button>
    </form>

    <form action={updateSettings} className="booking-form portal-form">
      <h3 className="span-2">{t('Default RM rate', '默认 RM 汇率')}</h3>
      <input type="hidden" name="key" value="default_rm_rate" />
      <label>{t('RM per 1 unit of trip currency', '每 1 行程币种兑 RM')}<input name="rmRate" type="number" min="0.0001" step="0.0001" required defaultValue={data.defaultRmRate} /></label>
      <button className="btn btn-secondary span-2">{t('Save default rate', '保存默认汇率')}</button>
    </form>

    <form action={updateSettings} className="booking-form portal-form">
      <h3 className="span-2">{t('Instructor email allowlist', '教练邮箱白名单')}</h3>
      <input type="hidden" name="key" value="instructor_emails" />
      <label className="span-2">{t('One email per line', '每行一个邮箱')}
        <textarea name="emails" rows={3} required defaultValue={data.instructorEmails.join('\n')} placeholder={t('instructor@example.com', 'instructor@example.com')} />
      </label>
      <button className="btn btn-secondary span-2">{t('Save allowlist', '保存白名单')}</button>
    </form>

    <form action={updateSettings} className="booking-form portal-form">
      <h3 className="span-2">{t('Payment instructions', '付款说明')}</h3>
      <input type="hidden" name="key" value="payment_instructions" />
      <p className="portal-hint span-2">{data.paymentInstructions.sample
        ? t('Currently labelled SAMPLE — confirm only when the bank details are final.', '当前标注为示例——仅在银行资料确定后确认。')
        : t('Confirmed by Iris — shown to divers as live instructions.', 'Iris 已确认——作为正式说明向潜水员展示。')}</p>
      <label className="span-2">{t('Instructions (English)', '付款说明（英文）')}
        <textarea name="instructionsEn" rows={3} defaultValue={data.paymentInstructions.en} placeholder={t('Bank transfer details shown on invoices…', '显示在账单上的银行转账资料…')} />
      </label>
      <label className="span-2">{t('Instructions (Chinese)', '付款说明（中文）')}
        <textarea name="instructionsZh" rows={3} defaultValue={data.paymentInstructions.zh} placeholder={t('显示在账单上的银行转账资料…', '显示在账单上的银行转账资料…')} />
      </label>
      <div className="portal-field span-2">
        <span className="portal-field-label" id="payment-confirm-label">{t('Confirmation', '确认')}</span>
        <div className="kind-pills" role="group" aria-labelledby="payment-confirm-label">
          <label className="kind-pill"><input type="checkbox" name="confirmed" defaultChecked={!data.paymentInstructions.sample} /><span>{t('Iris confirms these bank details are final (removes the Sample label)', 'Iris 确认银行资料为最终版本（移除示例标注）')}</span></label>
        </div>
      </div>
      <button className="btn btn-secondary span-2">{t('Save payment instructions', '保存付款说明')}</button>
    </form>
  </section>
}
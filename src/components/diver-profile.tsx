'use client'
import { useState } from 'react'
import CertificationFields from './certification-fields'
import EquipmentEditor from './equipment-editor'
import { saveDiverProfile } from '@/lib/diver-actions'
export default function DiverProfile({customer}:{customer:{id:string;name:string;email:string;phone:string|null;locale:'en'|'zh';diverProfile:Record<string,unknown>|null}}) {
 const [notice,setNotice]=useState(''); const [pending,setPending]=useState(false)
 const t=(en:string,zh:string)=>customer.locale==='zh'?zh:en
 const p=customer.diverProfile ?? {}
 return <section className="booking-card" id="profile"><h2>{t('Diver profile','潜水员资料')}</h2><p>{customer.id} · {customer.email}</p><p>{t('Your customer ID is permanent. Contact Iris to change your email. Certification is self-declared; Iris reviews suitability.','客户编号永久不变。如需更改邮箱，请联系 Iris。认证为自行申报，潜水适合性由 Iris 审核。')}</p><form onSubmit={async e=>{e.preventDefault();setPending(true);const r=await saveDiverProfile(new FormData(e.currentTarget));setNotice(r==='saved'?t('Saved. Upcoming eligibility changes need Iris review.','已保存。即将出发预订的资格变更需 Iris 审核。'):t('Not saved. Check your details or contact Iris.','未保存。请检查资料或联系 Iris。'));setPending(false)}}>
 {(['name','phone'] as const).map((key,i)=><div className="form-group" key={key}><label htmlFor={`profile-${key}`}>{[t('Name','称呼'),t('Phone','电话'),t('Certification agency (Not certified / Other accepted)','认证机构（可填 Not certified／Other）'),t('Certification level (Not certified / Other accepted)','认证等级（可填 Not certified／Other）')][i]}</label><input id={`profile-${key}`} name={key} style={{minHeight:44}} required={key!=='phone'} maxLength={key==='phone'?40:100} defaultValue={String(key==='name'?customer.name:key==='phone'?customer.phone ?? '':p[key] ?? 'Not certified')}/></div>)}
 <CertificationFields agency={String(p.agency ?? 'Not certified')} level={String(p.level ?? 'Not certified')} locale={customer.locale}/>
 <label>{t('Language','语言')}<select name="locale" defaultValue={customer.locale} style={{minHeight:44}}><option value="en">{t('English','英文')}</option><option value="zh">{t('Chinese (Simplified)','简体中文')}</option></select></label>
 <label>{t('Total logged dives (not a logbook)','累计潜水次数（非完整日志）')}<input name="dives" type="number" min={0} max={10000} required style={{minHeight:44}} defaultValue={Number(p.dives ?? 0)}/></label>
 <EquipmentEditor profileMode profile={p.equipment} locale={customer.locale}/><p role="status">{notice}</p><button className="btn btn-primary" disabled={pending} style={{minHeight:44}}>{t('Save profile','保存资料')}</button></form></section>
}

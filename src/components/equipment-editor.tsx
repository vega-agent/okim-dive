'use client'
import { useId, useState } from 'react'
import { Equipment, ITEMS, SIZES, RENTAL_NOTICE, equipmentFromProfile } from '@/lib/diver-equipment'
export default function EquipmentEditor({initial,profile,locale='en',disabled=false,profileMode=false,onChange}:{initial?:Equipment;profile?:unknown;locale?:'en'|'zh';disabled?:boolean;profileMode?:boolean;onChange?:(e:Equipment)=>void}) {
  const prefix = useId()
  const [value,setValue]=useState(initial ?? equipmentFromProfile(profile))
  const t=(en:string,zh:string)=>locale==='zh'?zh:en
  const update=(v:Equipment)=>{setValue(v);onChange?.(v)}
  const rental=Object.values(value.choices).includes('rent')
  return <fieldset disabled={disabled} style={{border:0,padding:0,minWidth:0}}><legend>{t('Equipment planning','装备计划')}</legend>
    <input type="hidden" name="equipment" value={JSON.stringify(value)}/>
    {profileMode && ITEMS.map(([id,en,zh])=><label key={id} style={{display:'flex',alignItems:'center',gap:12,minHeight:44}}><input type="checkbox" style={{width:24,height:24}} checked={value.choices[id]==='own'} onChange={e=>update({...value,choices:{...value.choices,[id]:e.target.checked?'own':'rent'}})}/>{t(en,zh)}</label>)}
    {!profileMode && <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{(['own','rent','none'] as const).map((choice,i)=><button style={{minHeight:44}} className="btn btn-secondary" key={choice} type="button" onClick={()=>update({...value,choices:Object.fromEntries(ITEMS.map(([id])=>[id,choice]))})}>{[t('Bring all','全部自带'),t('Rent all','全部需租'),t('Remove all','全部不需要')][i]}</button>)}<button style={{minHeight:44}} className="btn btn-secondary" type="button" onClick={()=>update(equipmentFromProfile(profile))}>{t('Reset from profile','从资料重置')}</button></div>}
    {!profileMode && (['own','rent','none'] as const).map((choice,i)=><section key={choice}><h4>{[t('Bringing my own','自带装备'),t('May need to rent','可能需要租赁'),t('Not needed','不需要')][i]}</h4>{ITEMS.filter(([id])=>value.choices[id]===choice).map(([id,en,zh])=><div key={id} style={{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',marginBottom:8}}><label htmlFor={`${prefix}-equipment-${id}`}>{t(en,zh)}</label><select id={`${prefix}-equipment-${id}`} style={{minHeight:44,maxWidth:'65%'}} value={choice} onChange={e=>update({...value,choices:{...value.choices,[id]:e.target.value as 'own'|'rent'|'none'}})}><option value="own">{t('Bringing my own','自带')}</option><option value="rent">{t('May need to rent','可能需租')}</option><option value="none">{t('Not needed','不需要')}</option></select></div>)}</section>)}
    {(['wetsuit','bcd'] as const).filter(id=>profileMode || value.choices[id]==='rent').map(id=><label key={id} style={{display:'block'}}>{t(id==='bcd'?'Approximate BCD size':'Approximate wetsuit size',id==='bcd'?'BCD 大致尺码':'湿衣大致尺码')}<select style={{minHeight:44}} value={value[id]} onChange={e=>update({...value,[id]:e.target.value})}>{SIZES.map(s=><option key={s}>{s}</option>)}</select></label>)}
    {(profileMode||value.choices.boots==='rent'||value.choices.fins==='rent')&&<label>{t('Footwear size (or Unsure)','鞋码（或 Unsure）')}<input style={{minHeight:44}} value={value.footwear} onChange={e=>update({...value,footwear:e.target.value})}/><select style={{minHeight:44}} value={value.footwearUnit} onChange={e=>update({...value,footwearUnit:e.target.value})}>{['EU','UK','US'].map(s=><option key={s}>{s}</option>)}</select></label>}
    {(profileMode||rental)&&<label>{t('Optional fit note','合身备注（选填）')}<input maxLength={200} style={{minHeight:44}} value={value.fitNote} onChange={e=>update({...value,fitNote:e.target.value})}/></label>}
    <label>{t('Other equipment note','其他装备备注')}<input maxLength={200} style={{minHeight:44}} value={value.otherNote} onChange={e=>update({...value,otherNote:e.target.value})}/></label>
    <p>{RENTAL_NOTICE[locale==='zh'?1:0]}</p><p>{t('Rental cost and payment are arranged at the dive shop on the trip, outside your invoice, balance and points. Contact Iris about safe participation or refunds.','租赁费用与付款在行程期间于潜店安排，不计入发票、余额或积分。安全参与或退款问题请联系 Iris。')}</p>
  </fieldset>
}

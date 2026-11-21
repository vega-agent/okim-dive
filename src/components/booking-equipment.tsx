'use client'
import { useState } from 'react'
import EquipmentEditor from './equipment-editor'
import { Equipment, equipmentFromProfile } from '@/lib/diver-equipment'
import { saveBookingEquipment } from '@/lib/diver-actions'
export default function BookingEquipment({id,initial,profile,editable,cutoff,locale}:{id:string;initial:Equipment|null;profile:unknown;editable:boolean;cutoff:string;locale:'en'|'zh'}) {
 const [value,setValue]=useState(initial ?? equipmentFromProfile(null));const [notice,setNotice]=useState('');const [pending,setPending]=useState(false)
 const t=(en:string,zh:string)=>locale==='zh'?zh:en
 if (!initial && !editable) return <section className="booking-card"><h3>{id} · {t('Equipment','装备')}</h3><p>{t('Equipment not provided. Contact Iris.','未提供装备清单，请联系 Iris。')}</p></section>
 return <section className="booking-card"><h3>{id} · {t('Equipment','装备')}</h3><p>{t('Edit until','可编辑至')} {cutoff}. {t('After this time, contact Iris.','此时间后请联系 Iris。')}</p>{!initial&&<p>{t('Equipment not provided. Add a list below if needed.','尚未提供装备清单，可在下方填写。')}</p>}<EquipmentEditor initial={value} profile={profile} locale={locale} disabled={!editable||pending} onChange={setValue}/>{editable&&<button className="btn btn-primary" style={{minHeight:44}} disabled={pending} onClick={async()=>{setPending(true);const r=await saveBookingEquipment(id,value);setNotice(r==='saved'?t('Saved for Iris review.','已保存供 Iris 查看。'):t('Not saved. Contact Iris.','未保存，请联系 Iris。'));setPending(false)}}>{t('Save booking equipment','保存预订装备')}</button>}<p role="status">{notice}</p></section>
}

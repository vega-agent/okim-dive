'use client'
import { useId, useState } from 'react'
export default function CertificationFields({agency='Not certified',level='Not certified',locale,prefix=''}:{agency?:string;level?:string;locale:'en'|'zh';prefix?:string}) {
 const id=useId();const t=(en:string,zh:string)=>locale==='zh'?zh:en
 const agencies=['Not certified','PADI','SSI','NAUI','SDI','CMAS','Other'];const levels=['Not certified','Open Water','Advanced Open Water','Rescue Diver','Divemaster or above','Other']
 const [a,setA]=useState(agencies.includes(agency)?agency:'Other');const [l,setL]=useState(levels.includes(level)?level:'Other')
 return <>{(['agency','level'] as const).map(key=>{const value=key==='agency'?a:l;const options=key==='agency'?agencies:levels;return <div className="form-group" key={key}><label htmlFor={`${id}-${key}`}>{key==='agency'?t('Certification agency','认证机构'):t('Certification level','认证等级')}</label><select id={`${id}-${key}`} name={key==='agency'?(prefix?'cert_agency':'agency'):(prefix?'cert_level':'level')} value={value} style={{minHeight:44}} onChange={e=>key==='agency'?setA(e.target.value):setL(e.target.value)}>{options.map(s=><option value={s} key={s}>{s==='Not certified'?t(s,'尚未认证'):s==='Other'?t(s,'其他'):s}</option>)}</select>{value==='Other'&&<label>{t('Other details (optional)','其他详情（选填）')}<input maxLength={100} name={key+'_other'} defaultValue={options.includes(key==='agency'?agency:level)?'':key==='agency'?agency:level} style={{minHeight:44}}/></label>}</div>})}</>
}

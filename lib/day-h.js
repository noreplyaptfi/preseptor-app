export function jakartaDateKey(value=new Date()){
  try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
    const get=t=>parts.find(x=>x.type===t)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }catch{return ''}
}

export function toMs(value){
  if(!value)return null;
  const d=new Date(value);
  return Number.isNaN(d.getTime())?null:d.getTime();
}

export function inWindow(openAt,closeAt,now=new Date()){
  const t=now.getTime(),start=toMs(openAt),end=toMs(closeAt);
  if(!openAt&&!closeAt)return false;
  if(start&&t<start)return false;
  if(end&&t>end)return false;
  return true;
}

export function windowState(openAt,closeAt,now=new Date()){
  const t=now.getTime(),start=toMs(openAt),end=toMs(closeAt);
  if(!openAt&&!closeAt)return 'not_configured';
  if(start&&t<start)return 'upcoming';
  if(end&&t>end)return 'closed';
  return 'open';
}

export function participantEligible(reg){
  if(reg?.is_test_account||reg?.lifecycle_status==='test')return true;
  return ['active','withdrawal_requested'].includes(String(reg?.lifecycle_status||'active'))
    && reg?.requirements_status==='valid'
    && reg?.payment_status==='verified';
}

export function isTestRegistration(reg){
  return !!reg?.is_test_account||reg?.lifecycle_status==='test';
}

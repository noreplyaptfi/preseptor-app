export function parseJakartaDateTime(value){
  if(!value) return null;
  const raw=String(value).trim();
  if(!raw) return null;
  const withZone=/[zZ]|[+-]\d\d:\d\d$/.test(raw)?raw:`${raw}:00+07:00`;
  const date=new Date(withZone);
  return Number.isNaN(date.getTime())?null:date;
}

export function released(enabled,releaseAt,now=new Date()){
  if(!enabled) return false;
  if(!releaseAt) return true;
  const date=new Date(releaseAt);
  if(Number.isNaN(date.getTime())) return false;
  return date.getTime()<=now.getTime();
}

export function verifiedRegistration(registration){
  return registration?.requirements_status==='valid' && registration?.payment_status==='verified';
}

export function safeHttpsUrl(value){
  if(!value) return '';
  try{
    const url=new URL(String(value).trim());
    return url.protocol==='https:'?url.toString():'';
  }catch{return ''}
}

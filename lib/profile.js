export function cleanText(value,max=255){return String(value??'').trim().slice(0,max)}
export function displayName({name_core,full_name,title_prefix,title_suffix}){
  const core=cleanText(name_core||full_name,255);
  const prefix=cleanText(title_prefix,80);
  const suffix=cleanText(title_suffix,120);
  const left=[prefix,core].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  if(!suffix)return left;
  return `${left}${/[,.]$/.test(left)?'':','} ${suffix}`.replace(/\s+/g,' ').trim();
}
export function maskAccount(value){
  const v=String(value||'').replace(/\s+/g,'');if(v.length<=4)return v;
  return `${'*'.repeat(Math.max(4,v.length-4))}${v.slice(-4)}`;
}
export function rupiah(value){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value||0))}

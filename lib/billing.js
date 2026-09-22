export function rupiah(value=0){
  return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(value)||0).replace(/\s/g,' ');
}

export function billingNumber(kind,registration){
  const code=String(registration?.registration_code||'').toUpperCase();
  const numeric=(code.match(/(\d{4,})$/)||[])[1]||String(registration?.id||'').replaceAll('-','').slice(0,8).toUpperCase();
  const year=new Date(registration?.created_at||Date.now()).getFullYear();
  const prefix=kind==='receipt'?'KWT':'INV';
  return `${prefix}/APTFI/PRE/${year}/${numeric}`;
}

export function formatBillingDate(value){
  if(!value) return '-';
  try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(value))}catch{return '-'}
}

export function terbilangRupiah(value){
  let n=Math.floor(Number(value)||0);
  if(n===0) return 'Nol rupiah';
  const words=['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
  function spell(x){
    if(x<12) return words[x];
    if(x<20) return `${spell(x-10)} belas`;
    if(x<100) return `${spell(Math.floor(x/10))} puluh ${spell(x%10)}`.trim();
    if(x<200) return `seratus ${spell(x-100)}`.trim();
    if(x<1000) return `${spell(Math.floor(x/100))} ratus ${spell(x%100)}`.trim();
    if(x<2000) return `seribu ${spell(x-1000)}`.trim();
    if(x<1_000_000) return `${spell(Math.floor(x/1000))} ribu ${spell(x%1000)}`.trim();
    if(x<1_000_000_000) return `${spell(Math.floor(x/1_000_000))} juta ${spell(x%1_000_000)}`.trim();
    if(x<1_000_000_000_000) return `${spell(Math.floor(x/1_000_000_000))} miliar ${spell(x%1_000_000_000)}`.trim();
    return String(x);
  }
  const text=spell(n).replace(/\s+/g,' ').trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} rupiah`;
}

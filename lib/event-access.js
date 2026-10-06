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

// v0.8.1 — Info lokasi untuk peserta Offline (menggantikan QR di Akses Acara).
// QR presensi Offline hanya ada di menu Kehadiran.
export const VENUE_FIELDS=[
  {key:'name',label:'Nama tempat',max:120,placeholder:'Contoh: Aula / Gedung / Hotel ...',wide:true},
  {key:'address',label:'Alamat lengkap',max:300,placeholder:'Jalan, kelurahan, kecamatan, kota',multiline:true},
  {key:'room',label:'Ruangan / lantai',max:160,placeholder:'Contoh: Ruang Seminar Lt. 2'},
  {key:'maps_url',label:'Link Google Maps',max:500,placeholder:'https://maps.app.goo.gl/...',url:true},
  {key:'notes',label:'Catatan untuk peserta',max:800,placeholder:'Parkir, pintu masuk, dress code, dll.',multiline:true},
  {key:'contact_name',label:'Kontak panitia lokasi',max:80,placeholder:'Nama petugas'},
  {key:'contact_phone',label:'No. WhatsApp kontak',max:30,placeholder:'08xxxxxxxxxx'}
];

export function normalizeVenue(raw){
  const src=raw&&typeof raw==='object'?raw:{};
  const out={};
  for(const f of VENUE_FIELDS){
    let v=String(src[f.key]??'').replace(/\r\n/g,'\n').trim();
    if(!f.multiline)v=v.replace(/\s+/g,' ');
    out[f.key]=v.slice(0,f.max);
  }
  out.contact_phone=out.contact_phone.replace(/[^\d+\-\s]/g,'').trim();
  return out;
}

export function venueReady(venue){
  const v=normalizeVenue(venue);
  return !!(v.name||v.address);
}

function venueQuery(v){
  return [v.name,v.address].filter(Boolean).join(', ');
}

export function venueMapsLink(venue){
  const v=normalizeVenue(venue);
  const own=safeHttpsUrl(v.maps_url);
  if(own)return own;
  const q=venueQuery(v);
  return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:'';
}

export function venueEmbedUrl(venue){
  const q=venueQuery(normalizeVenue(venue));
  return q?`https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`:'';
}

export function whatsappLink(phone){
  let d=String(phone||'').replace(/\D/g,'');
  if(!d)return '';
  if(d.startsWith('0'))d=`62${d.slice(1)}`;
  else if(d.startsWith('8'))d=`62${d}`;
  return d.length>=9?`https://wa.me/${d}`:'';
}

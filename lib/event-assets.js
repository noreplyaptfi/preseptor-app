// v0.8.0 — Virtual background & materi yang diunggah admin (aturan bersama server & client).

export const ASSET_BUCKET='event-assets';

const OFFICE={
  'application/pdf':'PDF',
  'application/vnd.ms-powerpoint':'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':'PPTX',
  'application/msword':'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'DOCX',
  'application/vnd.ms-excel':'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'XLSX',
  'application/zip':'ZIP',
  'application/x-zip-compressed':'ZIP',
  'video/mp4':'MP4',
  'image/jpeg':'JPG',
  'image/png':'PNG'
};

export const ASSET_KINDS={
  virtual_background:{
    label:'Virtual Background',
    noun:'virtual background',
    types:{'image/jpeg':'JPG','image/png':'PNG'},
    maxBytes:10*1024*1024,
    accept:'image/jpeg,image/png',
    hint:'JPG atau PNG, maksimal 10 MB. Disarankan 1920 × 1080 px (16:9).'
  },
  material:{
    label:'Materi',
    noun:'materi',
    types:OFFICE,
    maxBytes:50*1024*1024,
    accept:Object.keys(OFFICE).join(','),
    hint:'PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, ZIP, MP4, JPG, atau PNG, maksimal 50 MB. File lebih besar: gunakan tautan.'
  }
};

export const AUDIENCE_LABEL={all:'Semua peserta',Online:'Peserta Online',Offline:'Peserta Offline'};

// v0.8.4 — Dokumentasi: khusus tautan (tidak ada upload file), dikelompokkan per group_label.
export const DOC_KIND='documentation';
export const LINK_ONLY_KINDS=['documentation'];
export const ALL_ASSET_KINDS=[...Object.keys(ASSET_KINDS),'documentation'];
export const DOC_GROUP_SUGGESTIONS=['Hari 1','Hari 2','Umum'];
export const DOC_BULK_MAX=100;

// Jenis tautan berdasarkan domain, untuk ikon & label di daftar.
export function linkSource(url){
  let host='';
  try{host=new URL(String(url||'')).hostname.replace(/^www\./,'').toLowerCase()}catch{}
  if(host==='photos.google.com'||host==='photos.app.goo.gl')return {key:'photos',label:'Google Photos',host};
  if(host==='drive.google.com'||host==='docs.google.com')return {key:'drive',label:String(url).includes('/folders/')?'Folder Google Drive':'Google Drive',host};
  if(host==='youtube.com'||host==='youtu.be'||host==='m.youtube.com')return {key:'youtube',label:'YouTube',host};
  if(host.endsWith('sharepoint.com')||host==='1drv.ms'||host==='onedrive.live.com')return {key:'onedrive',label:'OneDrive',host};
  if(host.endsWith('dropbox.com'))return {key:'dropbox',label:'Dropbox',host};
  if(host.endsWith('instagram.com'))return {key:'instagram',label:'Instagram',host};
  return {key:'link',label:host||'Tautan',host};
}

export const DOC_NO_GROUP='Lainnya';
export function linkIcon(key){return key==='youtube'?'play':['photos','drive','instagram'].includes(key)?'camera':'link'}

// Kelompokkan dokumentasi per group_label. Urutan kelompok: alfabetis-numerik (Hari 1, Hari 2, Umum), "Lainnya" terakhir.
// Urutan item di dalam kelompok mengikuti urutan list (position).
export function groupDocs(list){
  const map=new Map();
  for(const a of list||[]){const g=a.group_label||DOC_NO_GROUP;if(!map.has(g))map.set(g,[]);map.get(g).push(a)}
  return [...map.entries()].sort(([a],[b])=>a===DOC_NO_GROUP?1:b===DOC_NO_GROUP?-1:a.localeCompare(b,'id',{numeric:true,sensitivity:'base'})).map(([group,items])=>({group,items}));
}

// Mengurai teks tempelan: satu tautan per baris.
// Format yang diterima: "Judul | https://...", "Judul<TAB>https://...", "Judul - https://...", atau URL saja.
export function parseLinkLines(text,{group=''}={}){
  const rows=[];
  const lines=String(text||'').split(/\r?\n/);
  let n=0;
  for(const raw of lines){
    const line=raw.trim();
    if(!line)continue;
    n++;
    const m=line.match(/https?:\/\/\S+/i);
    if(!m){rows.push({line:n,raw:line,title:'',link_url:'',error:'Tidak ada tautan (harus diawali https://)'});continue}
    const url=validLink(m[0].replace(/[),.;]+$/,''));
    let title=line.slice(0,m.index).replace(/[\s|:\-–—\t]+$/,'').replace(/^[\s|:\-–—\t]+/,'').trim();
    if(!title){const after=line.slice(m.index+m[0].length).replace(/^[\s|:\-–—\t]+/,'').trim();title=after}
    if(!title)title=`${group||'Dokumentasi'} — tautan ${n}`;
    rows.push({line:n,raw:line,title:title.slice(0,160),link_url:url,error:url?'':'Tautan tidak valid'});
  }
  return rows;
}

// Browser kadang tidak memberi MIME untuk .pptx/.docx; tebak dari ekstensi.
const EXT_MIME={pdf:'application/pdf',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',zip:'application/zip',mp4:'video/mp4',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
export function guessMime(name,type){
  if(type&&type!=='application/octet-stream')return type;
  const ext=String(name||'').toLowerCase().split('.').pop();
  return EXT_MIME[ext]||type||'';
}

export function validateAssetFile(kind,file){
  const k=ASSET_KINDS[kind];
  if(!k)return 'Jenis aset tidak dikenal.';
  if(!file||!file.name||!Number(file.size))return 'Pilih file terlebih dahulu.';
  const type=guessMime(file.name,file.type);
  if(!k.types[type])return `Format file tidak didukung untuk ${k.noun}. ${k.hint}`;
  if(Number(file.size)>k.maxBytes)return `Ukuran file melebihi batas ${Math.round(k.maxBytes/1024/1024)} MB.`;
  return '';
}

export function validLink(url){
  try{const u=new URL(String(url||'').trim());return ['https:','http:'].includes(u.protocol)?u.toString():''}catch{return ''}
}

export function fileTypeLabel(asset){
  if(asset?.link_url&&!asset?.storage_path)return 'Tautan';
  return OFFICE[asset?.mime_type]||String(asset?.original_name||'').split('.').pop()?.toUpperCase()||'File';
}

export function formatBytes(n){
  const v=Number(n||0);
  if(!v)return '';
  if(v<1024*1024)return `${Math.max(1,Math.round(v/1024))} KB`;
  return `${(v/1024/1024).toFixed(v<10*1024*1024?1:0).replace('.',',')} MB`;
}

export function assetVisibleFor(asset,mode){
  return asset.published&&(asset.audience==='all'||asset.audience===mode);
}

export function downloadName(asset){
  const ext=String(asset?.original_name||'').split('.').pop();
  const base=String(asset?.title||'materi').replace(/[^\p{L}\p{N} ._-]+/gu,'').trim().replace(/\s+/g,' ').slice(0,80)||'materi';
  return ext&&ext.length<=5&&!base.toLowerCase().endsWith(`.${ext.toLowerCase()}`)?`${base}.${ext}`:base;
}

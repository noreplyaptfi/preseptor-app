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

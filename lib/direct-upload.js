import { ALLOWED_TYPES, MAX_FILE, safeFileName, validateFileSignature } from './validation';

export function validateFileDescriptor(file,label='Dokumen'){
  if(!file||!file.name||!file.type||!Number(file.size)) return `${label} wajib diunggah.`;
  if(Number(file.size)>MAX_FILE) return `${label} maksimal 5 MB.`;
  if(!ALLOWED_TYPES.includes(file.type)) return `${label} harus JPG, PNG, atau PDF.`;
  return '';
}

export async function createSignedUpload(db,{registrationId,files}){
  const uploads={};
  for(const [type,file] of Object.entries(files||{})){
    if(!file) continue;
    const path=`${registrationId}/${type}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {data,error}=await db.storage.from('preseptor-private').createSignedUploadUrl(path);
    if(error||!data?.token) throw new Error(`Gagal menyiapkan upload ${type}.`);
    uploads[type]={path,token:data.token,name:file.name,type:file.type,size:Number(file.size)};
  }
  return uploads;
}

export async function verifyStoredUpload(db,file,label='Dokumen'){
  if(!file?.path) return `${label} belum diunggah.`;
  const descriptorError=validateFileDescriptor(file,label);
  if(descriptorError) return descriptorError;
  const {data,error}=await db.storage.from('preseptor-private').createSignedUrl(file.path,60);
  if(error||!data?.signedUrl) return `${label} tidak ditemukan di penyimpanan.`;
  try{
    const r=await fetch(data.signedUrl,{headers:{Range:'bytes=0-15'},cache:'no-store'});
    if(!r.ok) return `${label} gagal diverifikasi.`;
    const buffer=Buffer.from(await r.arrayBuffer());
    if(!validateFileSignature(buffer,file.type)) return `Isi ${label} tidak sesuai format JPG, PNG, atau PDF yang valid.`;
    return '';
  }catch{
    return `${label} gagal diverifikasi.`;
  }
}

export async function removeUploadedPaths(db,files){
  const paths=Object.values(files||{}).map(x=>x?.path).filter(Boolean);
  if(paths.length) await db.storage.from('preseptor-private').remove(paths).catch(()=>{});
}

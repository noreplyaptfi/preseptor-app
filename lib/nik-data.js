import { maskNik } from './nik';

// v0.8.5 — Akses data NIK (server saja). NIK lengkap tidak pernah dikirim ke browser
// kecuali ke pemiliknya sendiri, atau ke Super Admin / Admin Event atas permintaan.
// Semua fungsi tetap berjalan (tanpa data NIK) bila migration 023 belum dijalankan.

const PAGE=1000;

// Map registration_id -> {nik,updated_at,source} untuk satu event.
export async function nikRowsForEvent(db,eventId){
  const map=new Map();
  for(let from=0;;from+=PAGE){
    const {data,error}=await db.from('registration_nik').select('registration_id,nik,updated_at,source').eq('event_id',eventId).order('registration_id').range(from,from+PAGE-1);
    if(error)return {map,ready:false};
    for(const r of data||[])map.set(r.registration_id,r);
    if(!data||data.length<PAGE)break;
  }
  return {map,ready:true};
}

export async function nikRowFor(db,registrationId){
  const {data,error}=await db.from('registration_nik').select('nik,updated_at,source,consent_at').eq('registration_id',registrationId).maybeSingle();
  if(error)return {row:null,ready:false};
  return {row:data||null,ready:true};
}

// Ringkasan tanpa NIK lengkap (aman untuk daftar admin & dashboard peserta).
export function nikSummary(row){
  if(!row)return {filled:false,masked:'',updated_at:null,source:null};
  return {filled:true,masked:maskNik(row.nik),updated_at:row.updated_at||null,source:row.source||null};
}

// Kolom ringkas untuk baris pendaftar di dashboard admin.
export function withNikSummary(reg,row){
  const s=nikSummary(row);
  return {...reg,nik_filled:s.filled,nik_masked:s.masked,nik_updated_at:s.updated_at,nik_source:s.source};
}

// NIK yang sama sudah dipakai peserta lain (aktif, bukan akun TEST) di event yang sama?
export async function nikDuplicate(db,{eventId,nik,registrationId}){
  const {data,error}=await db.from('registration_nik').select('registration_id').eq('event_id',eventId).eq('nik',nik).neq('registration_id',registrationId);
  if(error)throw new Error('Data NIK belum siap. Pastikan migration 023 sudah dijalankan.');
  const ids=(data||[]).map(r=>r.registration_id);
  if(!ids.length)return null;
  const {data:regs}=await db.from('registrations').select('id,registration_code,full_name,lifecycle_status,is_test_account').in('id',ids);
  return (regs||[]).find(r=>!r.is_test_account&&r.lifecycle_status!=='test'&&!['withdrawn','rejected'].includes(r.lifecycle_status))||null;
}

// Simpan (insert/update) NIK satu pendaftaran.
export async function saveNik(db,{reg,nik,source,actorEmail,consent=false}){
  const now=new Date().toISOString();
  const {data:prev,error:prevError}=await db.from('registration_nik').select('nik').eq('registration_id',reg.id).maybeSingle();
  if(prevError)throw new Error('Data NIK belum siap. Pastikan migration 023 sudah dijalankan.');
  if(prev?.nik===nik)return {created:false,changed:false};
  const row={registration_id:reg.id,event_id:reg.event_id,nik,source,updated_by:actorEmail||null,updated_at:now};
  if(consent)row.consent_at=now;
  const {error}=await db.from('registration_nik').upsert(row,{onConflict:'registration_id'});
  if(error){console.error('save nik:',error);throw new Error('NIK gagal disimpan. Coba lagi beberapa saat lagi.')}
  return {created:!prev,changed:!!prev};
}

export async function deleteNik(db,registrationId){
  const {error}=await db.from('registration_nik').delete().eq('registration_id',registrationId);
  if(error)throw new Error('NIK gagal dihapus.');
}

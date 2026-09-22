import fs from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const csvPath=process.argv[2];
if(!csvPath){console.error('Usage: npm run import:wordpress -- /path/export.csv');process.exit(1)}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key){console.error('Supabase env belum dikonfigurasi.');process.exit(1)}
const db=createClient(url,key,{auth:{persistSession:false}});
const text=await fs.readFile(csvPath,'utf8');
const rows=parse(text,{columns:true,skip_empty_lines:true,bom:true,relax_column_count:true});
const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
const {data:event,error:eventError}=await db.from('events').select('*').eq('slug',slug).single();
if(eventError)throw eventError;
const normalizePhone=v=>{let d=String(v||'').replace(/\D/g,'');if(d.startsWith('0'))d=`62${d.slice(1)}`;else if(d.startsWith('8'))d=`62${d}`;return d};
const mapStatus=v=>{const s=String(v||'').toLowerCase();if(s.includes('terverifikasi'))return'verified';if(s.includes('ditolak'))return'rejected';return'pending'};
const overall=(req,pay)=>req==='valid'&&pay==='verified'?'verified':pay==='verified'?'requirements_incomplete':'requirements_incomplete';
let ok=0,failed=0,skipped=0;
for(const row of rows){try{const code=row['Kode Pendaftaran']?.trim();const email=row['Email']?.trim().toLowerCase();if(!code||!email){skipped++;continue}const pay=mapStatus(row['Status Pembayaran']);const phone=row['Nomor WhatsApp']||'';const payload={event_id:event.id,registration_code:code,full_name:row['Nama Lengkap & Gelar']||'',email,normalized_email:email,whatsapp:phone,normalized_whatsapp:normalizePhone(phone)||null,attendance_mode:row['Mode Keikutsertaan']||null,practice_type:row['Jenis Wahana']||null,practice_name:row['Nama Wahana']||null,university:row['Homebase PTF']||'',requirements_status:'incomplete',payment_status:pay,overall_status:overall('incomplete',pay),legacy_source:'wordpress-v1.0.9',legacy_payment_proof_url:row['Bukti Transfer']||null,created_at:row['Waktu Registrasi']?new Date(String(row['Waktu Registrasi']).replace(' ','T')+'+07:00').toISOString():new Date().toISOString()};const {data:reg,error}=await db.from('registrations').upsert(payload,{onConflict:'registration_code'}).select('*').single();if(error)throw error;const proof=row['Bukti Transfer']?.trim();if(proof){const {data:exists}=await db.from('registration_documents').select('id').eq('registration_id',reg.id).eq('document_type','payment_proof').maybeSingle();if(!exists){const res=await fetch(proof);if(!res.ok)throw new Error(`download proof HTTP ${res.status}`);const buf=Buffer.from(await res.arrayBuffer());const contentType=res.headers.get('content-type')||'application/octet-stream';const ext=contentType.includes('pdf')?'.pdf':contentType.includes('png')?'.png':'.jpg';const storagePath=`${reg.id}/payment_proof/legacy-${Date.now()}${ext}`;const up=await db.storage.from('preseptor-private').upload(storagePath,buf,{contentType});if(up.error)throw up.error;await db.from('registration_documents').insert({registration_id:reg.id,document_type:'payment_proof',storage_path:storagePath,original_name:path.basename(new URL(proof).pathname)||`legacy${ext}`,mime_type:contentType,file_size:buf.length,status:pay==='verified'?'valid':'pending'});}}ok++;console.log('OK',code)}catch(e){failed++;console.error('FAIL',row['Kode Pendaftaran'],e.message)}}
console.log({total:rows.length,ok,failed,skipped});if(failed)process.exitCode=2;

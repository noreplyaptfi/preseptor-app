import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { createClient } from '@supabase/supabase-js';

function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null}
function has(name){return process.argv.includes(name)}
function requiredEnv(name){const v=process.env[name];if(!v)throw new Error(`${name} belum dikonfigurasi.`);return v}
function normalizePhone(v=''){let d=String(v).replace(/\D/g,'');if(d.startsWith('0'))d=`62${d.slice(1)}`;else if(d.startsWith('8'))d=`62${d}`;return d||null}
function mimeFor(name=''){const x=name.toLowerCase();if(x.endsWith('.pdf'))return'application/pdf';if(x.endsWith('.png'))return'image/png';if(x.endsWith('.jpg')||x.endsWith('.jpeg'))return'image/jpeg';return'application/octet-stream'}
function safeExt(name=''){const ext=path.extname(name).toLowerCase();return ['.pdf','.png','.jpg','.jpeg'].includes(ext)?ext:'.bin'}
function syntheticEmail(code){return `legacy-${String(code).toLowerCase().replace(/[^a-z0-9]+/g,'-')}@migration.invalid`}
function overall(pay){return pay==='verified'?'requirements_incomplete':'requirements_incomplete'}
function short(v,n=40){v=String(v??'');return v.length>n?`${v.slice(0,n-1)}…`:v}

const manifestPath=arg('--manifest');
const proofsPath=arg('--proofs');
const commit=has('--commit');
const purgeTest=has('--purge-app-test');
if(!manifestPath||!proofsPath){
  console.error('Usage: npm run import:legacy -- --manifest "path\\manifest.json" --proofs "path\\Bukti.zip" [--purge-app-test] [--commit]');
  process.exit(1);
}

const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
if(!Array.isArray(manifest?.registrations))throw new Error('Manifest tidak valid.');
const url=requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const key=requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const zip=new AdmZip(proofsPath);
const zipEntries=new Map(zip.getEntries().filter(e=>!e.isDirectory).map(e=>[path.basename(e.entryName),e]));

const {data:event,error:eventError}=await db.from('events').select('*').eq('slug',slug).single();
if(eventError||!event)throw eventError||new Error(`Event ${slug} tidak ditemukan.`);

const rows=manifest.registrations;
const duplicateEmails=new Map();
for(const r of rows){const e=String(r.email||'').toLowerCase();duplicateEmails.set(e,(duplicateEmails.get(e)||0)+1)}
const missingProof=rows.filter(r=>!r.payment_proof_filename||!zipEntries.has(r.payment_proof_filename));
const badRows=rows.filter(r=>!r.registration_code||!r.full_name||!r.email||!r.whatsapp||!['Online','Offline'].includes(r.attendance_mode));
const phones=new Map();
for(const r of rows){const p=normalizePhone(r.whatsapp);if(p)phones.set(p,(phones.get(p)||0)+1)}
const duplicatePhones=[...phones.entries()].filter(([,n])=>n>1);
const existingCodes=(await db.from('registrations').select('registration_code,email,legacy_source').in('registration_code',rows.map(r=>r.registration_code))).data||[];
const {data:currentRegs}=await db.from('registrations').select('id,registration_code,email,legacy_source,created_at').eq('event_id',event.id).order('created_at',{ascending:true});
const appTestRows=(currentRegs||[]).filter(r=>!r.legacy_source&&!rows.some(x=>x.registration_code===r.registration_code));

console.log('\n=== APTFI PRESEPTOR - FINAL WORDPRESS CUTOVER ===');
console.log(`Mode                 : ${commit?'COMMIT':'DRY RUN'}`);
console.log(`Event                : ${event.title} (${slug})`);
console.log(`Source registrations : ${rows.length}`);
console.log(`Verified payment     : ${rows.filter(r=>r.payment_status==='verified').length}`);
console.log(`Pending payment      : ${rows.filter(r=>r.payment_status!=='verified').length}`);
console.log(`Online / Offline     : ${rows.filter(r=>r.attendance_mode==='Online').length} / ${rows.filter(r=>r.attendance_mode==='Offline').length}`);
console.log(`Proof files matched  : ${rows.length-missingProof.length}/${rows.length}`);
console.log(`Duplicate email group: ${[...duplicateEmails.values()].filter(n=>n>1).length}`);
console.log(`Duplicate phone group: ${duplicatePhones.length}`);
console.log(`Existing source codes: ${existingCodes.length}`);
console.log(`Existing app/test rows: ${appTestRows.length}`);
if(missingProof.length)console.log('Missing proofs:',missingProof.map(x=>`${x.registration_code}:${x.payment_proof_filename}`).join(', '));
if(badRows.length)console.log('Invalid source rows:',badRows.map(x=>x.registration_code||'?').join(', '));
if(duplicatePhones.length)console.log('Duplicate normalized phones:',duplicatePhones);
if(appTestRows.length){console.log('Current non-legacy rows:');for(const r of appTestRows)console.log(` - ${r.registration_code} | ${r.email}`)}

if(missingProof.length||badRows.length||duplicatePhones.length){
  throw new Error('Validasi source gagal. Import dibatalkan.');
}
if(!commit){
  console.log('\nDRY RUN selesai. Tidak ada perubahan database/storage.');
  console.log('Jika hasil benar, jalankan ulang dengan --commit. Tambahkan --purge-app-test bila data dummy webapp memang boleh dihapus.');
  process.exit(0);
}
if(appTestRows.length&&!purgeTest){
  throw new Error('Masih ada data webapp/test. Jalankan dengan --purge-app-test hanya jika data tersebut memang dummy dan boleh dihapus.');
}

if(purgeTest&&appTestRows.length){
  const ids=appTestRows.map(r=>r.id);
  const {data:docs,error:docsError}=await db.from('registration_documents').select('storage_path').in('registration_id',ids);
  if(docsError)throw docsError;
  const storagePaths=(docs||[]).map(d=>d.storage_path).filter(Boolean);
  if(storagePaths.length){const rem=await db.storage.from('preseptor-private').remove(storagePaths);if(rem.error)throw rem.error}
  const del=await db.from('registrations').delete().in('id',ids);if(del.error)throw del.error;
  console.log(`Purged ${ids.length} app/test registrations.`);
}

const claimedEmail=new Set();
let imported=0,updated=0,failed=0;
const report=[];
for(const source of rows){
  try{
    const originalEmail=String(source.email).trim().toLowerCase();
    const duplicated=(duplicateEmails.get(originalEmail)||0)>1;
    const useOriginal=!claimedEmail.has(originalEmail);
    const authEmail=useOriginal?originalEmail:syntheticEmail(source.registration_code);
    claimedEmail.add(originalEmail);
    const needsEmailUpdate=duplicated&&!useOriginal;
    const paymentVerified=source.payment_status==='verified';
    const payload={
      event_id:event.id,
      registration_code:source.registration_code,
      full_name:source.full_name,
      email:authEmail,
      normalized_email:needsEmailUpdate?null:authEmail,
      legacy_contact_email:needsEmailUpdate?originalEmail:null,
      email_needs_update:needsEmailUpdate,
      whatsapp:source.whatsapp,
      normalized_whatsapp:normalizePhone(source.whatsapp),
      university:source.university||'',
      attendance_mode:source.attendance_mode,
      participant_type:null,
      practice_type:source.practice_type||null,
      practice_name:source.practice_name||null,
      practice_years:0,
      teaching_years:0,
      requirements_status:'incomplete',
      payment_status:source.payment_status||'pending',
      overall_status:overall(source.payment_status),
      payment_verified_at:paymentVerified?(source.last_sync_at||source.registered_at):null,
      payment_verified_by:paymentVerified?'legacy-wordpress':null,
      legacy_source:'wordpress-v1.0.9-final-cutover',
      legacy_payment_proof_url:source.payment_proof_url||null,
      legacy_imported_at:new Date().toISOString(),
      legacy_metadata:{source_row:source.row,source_file:manifest.source_file||null,last_sync_at:source.last_sync_at||null,original_status:source.payment_status,original_email:originalEmail},
      amount_due:Number(event.registration_fee||1000000),
      created_at:source.registered_at,
      updated_at:new Date().toISOString()
    };
    const existing=(await db.from('registrations').select('id').eq('registration_code',source.registration_code).maybeSingle()).data;
    const op=existing
      ? await db.from('registrations').update(payload).eq('id',existing.id).select('*').single()
      : await db.from('registrations').insert(payload).select('*').single();
    if(op.error)throw op.error;
    const reg=op.data;
    if(existing)updated++;else imported++;

    const proofEntry=zipEntries.get(source.payment_proof_filename);
    const proofBuffer=proofEntry.getData();
    const mime=mimeFor(source.payment_proof_filename);
    const ext=safeExt(source.payment_proof_filename);
    const digest=crypto.createHash('sha256').update(proofBuffer).digest('hex').slice(0,16);
    const storagePath=`${reg.id}/payment_proof/legacy-${digest}${ext}`;
    const {data:currentDocs,error:docReadError}=await db.from('registration_documents').select('*').eq('registration_id',reg.id).eq('document_type','payment_proof').order('created_at',{ascending:false});
    if(docReadError)throw docReadError;
    if(!(currentDocs||[]).some(d=>d.storage_path===storagePath)){
      const up=await db.storage.from('preseptor-private').upload(storagePath,proofBuffer,{contentType:mime,upsert:true,cacheControl:'3600'});
      if(up.error)throw up.error;
      const ins=await db.from('registration_documents').insert({
        registration_id:reg.id,
        document_type:'payment_proof',
        storage_path:storagePath,
        original_name:source.payment_proof_filename,
        mime_type:mime,
        file_size:proofBuffer.length,
        status:paymentVerified?'valid':'pending',
        reviewed_at:paymentVerified?(source.last_sync_at||source.registered_at):null,
        reviewed_by:paymentVerified?'legacy-wordpress':null,
        review_note:paymentVerified?'Status pembayaran terverifikasi pada sistem WordPress sebelum cutover.':null,
        next_action:null,
        created_at:source.registered_at
      });
      if(ins.error)throw ins.error;
    }
    await db.from('activity_logs').insert({registration_id:reg.id,actor_type:'system',actor_email:null,action:'legacy_wordpress_final_import',metadata:{source:'wordpress-v1.0.9',source_row:source.row,email_needs_update:needsEmailUpdate,payment_status:source.payment_status}});
    report.push({code:source.registration_code,name:source.full_name,status:'OK',email:authEmail,contact_email:originalEmail,email_needs_update:needsEmailUpdate,payment:source.payment_status,proof:source.payment_proof_filename});
    console.log(`OK   ${source.registration_code} | ${short(source.full_name)}${needsEmailUpdate?' | EMAIL NEEDS UPDATE':''}`);
  }catch(error){
    failed++;
    report.push({code:source.registration_code,name:source.full_name,status:'FAILED',error:error.message});
    console.error(`FAIL ${source.registration_code} | ${error.message}`);
  }
}

const summary={source_total:rows.length,inserted:imported,updated,failed,email_needs_update:report.filter(x=>x.email_needs_update).length,completed_at:new Date().toISOString(),report};
const reportPath=path.resolve(process.cwd(),`migration-report-${Date.now()}.json`);
await fs.writeFile(reportPath,JSON.stringify(summary,null,2),'utf8');
console.log('\n=== RESULT ===');
console.log({inserted:imported,updated,failed,email_needs_update:summary.email_needs_update});
console.log(`Report: ${reportPath}`);
if(failed)process.exitCode=2;

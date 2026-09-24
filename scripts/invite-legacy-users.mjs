import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

function has(name){return process.argv.includes(name)}
function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null}

const commit=has('--commit');
const force=has('--force');
const onlyCode=arg('--code');
const hoursRaw=Number(arg('--hours')||48);
const expiryHours=Number.isFinite(hoursRaw)&&hoursRaw>=1&&hoursRaw<=168?hoursRaw:48;

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const resend=process.env.RESEND_API_KEY;
const site=(process.env.NEXT_PUBLIC_SITE_URL||'').replace(/\/$/,'');
const from=process.env.EMAIL_FROM||'APTFI Preseptor <noreply@aptfi.or.id>';

if(!url||!key)throw new Error('Konfigurasi Supabase belum lengkap.');
if(commit&&!resend)throw new Error('RESEND_API_KEY belum diatur.');
if(commit&&(!site||!/^https:\/\//i.test(site)||/localhost|127\.0\.0\.1/i.test(site))){
  throw new Error('NEXT_PUBLIC_SITE_URL harus URL production HTTPS, mis. https://preseptor.aptfi.or.id');
}

const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
const {data:event,error:eventError}=await db.from('events').select('id').eq('slug',slug).single();
if(eventError||!event)throw eventError||new Error('Event tidak ditemukan.');

let q=db.from('registrations')
  .select('id,registration_code,full_name,email,email_needs_update,legacy_source')
  .eq('event_id',event.id)
  .not('legacy_source','is',null)
  .order('created_at',{ascending:true});
if(onlyCode)q=q.eq('registration_code',onlyCode);
const {data:regs,error}=await q;
if(error)throw error;

const eligible=(regs||[]).filter(r=>!r.email_needs_update&&!String(r.email).endsWith('@migration.invalid'));
const ids=eligible.map(r=>r.id);
let sentIds=new Set();
if(ids.length){
  const {data:logs,error:logError}=await db.from('email_logs')
    .select('registration_id,status')
    .in('registration_id',ids)
    .eq('email_type','legacy_activation')
    .eq('status','sent');
  if(logError)throw logError;
  sentIds=new Set((logs||[]).map(x=>x.registration_id));
}
const targets=force?eligible:eligible.filter(r=>!sentIds.has(r.id));

console.log('=== APTFI PRESEPTOR - LEGACY ACCOUNT INVITATION ===');
console.log(`Mode                : ${commit?'COMMIT':'DRY RUN'}`);
console.log(`Site URL            : ${site||'(belum diatur)'}`);
console.log(`Legacy registrations: ${(regs||[]).length}`);
console.log(`Eligible email      : ${eligible.length}`);
console.log(`Already sent        : ${eligible.length-targets.length}${force?' (akan dikirim ulang karena --force)':''}`);
console.log(`Invitation targets  : ${targets.length}`);
console.log(`Skipped email issue : ${(regs||[]).length-eligible.length}`);
console.log(`Link berlaku        : ${expiryHours} jam`);
if(onlyCode)console.log(`Registration filter : ${onlyCode}`);

if(!commit){
  console.log('\nDRY RUN selesai. Tidak ada email yang dikirim.');
  console.log('Jalankan ulang dengan --commit untuk mengirim hanya undangan yang belum pernah sukses dikirim.');
  process.exit(0);
}

async function findUser(email){
  for(let page=1;page<=20;page++){
    const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
    if(error)throw error;
    const u=(data.users||[]).find(x=>String(x.email||'').toLowerCase()===email.toLowerCase());
    if(u)return u;
    if((data.users||[]).length<1000)break;
  }
  return null;
}
async function ensureUser(email){
  let u=await findUser(email);
  if(u)return u;
  const {data,error}=await db.auth.admin.createUser({
    email,
    password:crypto.randomBytes(48).toString('base64url'),
    email_confirm:true
  });
  if(error)throw error;
  return data.user;
}
function hash(t){return crypto.createHash('sha256').update(t).digest('hex')}
function shell(name,activationUrl,code){
  return `<!doctype html><html><body style="margin:0;background:#f3f7ff;font-family:Arial,Helvetica,sans-serif;color:#101d4b"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" style="max-width:640px;background:#fff;border:1px solid #dce7f7;border-radius:20px;overflow:hidden"><tr><td style="padding:28px 32px;background:#11165a;color:#fff"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700">APTFI · Preseptor</div><h1 style="margin:10px 0 0;font-size:26px">Akses Dashboard Peserta</h1></td></tr><tr><td style="padding:30px 32px"><p>Yth. ${name},</p><p>Pendaftaran Anda telah dipindahkan ke sistem baru APTFI. Anda <strong>tidak perlu mendaftar ulang</strong>.</p><div style="padding:16px;background:#eef4ff;border-radius:12px"><small>Nomor pendaftaran</small><div style="font-size:18px;font-weight:700;color:#1554dd">${code}</div></div><p>Silakan aktifkan akun dan buat password melalui tombol berikut. Setelah login, Anda dapat melihat status pendaftaran dan melengkapi persyaratan yang masih diperlukan.</p><div style="margin:26px 0"><a href="${activationUrl}" style="display:inline-block;background:#1554dd;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Aktifkan akun peserta</a></div><p style="font-size:12px;color:#718096">Tautan berlaku ${expiryHours} jam dan hanya dapat digunakan satu kali. Jika tautan kedaluwarsa, Anda dapat meminta aktivasi/reset password baru dari halaman login peserta.</p></td></tr></table></td></tr></table></body></html>`;
}

let sent=0,failed=0;
for(const r of targets){
  try{
    const user=await ensureUser(r.email);
    const token=crypto.randomBytes(32).toString('base64url');
    const now=new Date();
    const expires=new Date(now.getTime()+expiryHours*60*60*1000);
    await db.from('auth_password_tokens')
      .update({used_at:now.toISOString()})
      .eq('email',r.email)
      .eq('audience','participant')
      .is('used_at',null);
    const ins=await db.from('auth_password_tokens').insert({
      token_hash:hash(token),email:r.email,user_id:user.id,audience:'participant',purpose:'activate',
      next_path:'/dashboard',expires_at:expires.toISOString()
    });
    if(ins.error)throw ins.error;
    const activationUrl=`${site}/auth/set-password?token=${encodeURIComponent(token)}`;
    const resp=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from,to:[r.email],
        subject:'Aktivasi Dashboard Peserta - Pelatihan Preseptor APTFI',
        html:shell(r.full_name,activationUrl,r.registration_code)
      })
    });
    const body=await resp.json().catch(()=>({}));
    if(!resp.ok)throw new Error(body.message||`Email HTTP ${resp.status}`);
    await db.from('email_logs').insert({
      registration_id:r.id,email_type:'legacy_activation',recipient:r.email,status:'sent',provider_id:body.id||null
    });
    sent++;
    console.log('SENT',r.registration_code,r.email);
  }catch(e){
    failed++;
    console.error('FAIL',r.registration_code,e.message);
    await db.from('email_logs').insert({
      registration_id:r.id,email_type:'legacy_activation',recipient:r.email,status:'failed',error_message:String(e.message||e)
    }).catch(()=>{});
  }
}
console.log('\n=== RESULT ===');
console.log({sent,failed,skipped_already_sent:eligible.length-targets.length,skipped_email_issue:(regs||[]).length-eligible.length});
if(failed)process.exitCode=2;

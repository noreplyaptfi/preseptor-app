import { createClient } from '@supabase/supabase-js';
function arg(name){const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null}
const code=arg('--code'),email=String(arg('--email')||'').trim().toLowerCase();
if(!code||!email||!email.includes('@')){console.error('Usage: npm run fix:legacy-email -- --code APT-PRS-... --email peserta@domain.com');process.exit(1)}
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error('Konfigurasi Supabase belum lengkap.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
const {data:event}=await db.from('events').select('id').eq('slug',slug).single();
const {data:reg,error}=await db.from('registrations').select('*').eq('registration_code',code).eq('event_id',event.id).maybeSingle();
if(error||!reg)throw error||new Error('Pendaftaran tidak ditemukan.');
const {data:conflict}=await db.from('registrations').select('registration_code').eq('event_id',event.id).ilike('email',email).neq('id',reg.id).maybeSingle();
if(conflict)throw new Error(`Email sudah dipakai oleh ${conflict.registration_code}.`);
const oldContact=reg.legacy_contact_email||reg.email;
const up=await db.from('registrations').update({email,normalized_email:email,email_needs_update:false,legacy_contact_email:oldContact,updated_at:new Date().toISOString()}).eq('id',reg.id);
if(up.error)throw up.error;
await db.from('activity_logs').insert({registration_id:reg.id,actor_type:'system',action:'legacy_email_corrected',metadata:{previous_contact_email:oldContact,new_email:email}});
console.log(`OK ${code} -> ${email}`);

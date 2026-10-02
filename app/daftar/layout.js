import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { resolveAllModeRegistrationWindows } from '../../lib/registration-mode-window';
import { ACTIVE_REGISTRATION_STATUSES } from '../../lib/registration-lifecycle';

export const dynamic='force-dynamic';
export const revalidate=0;

async function publicRegistrationAvailable(){
  const db=getSupabaseAdmin();
  const {data:event,error}=await db.from('events').select('*').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').single();
  if(error||!event)return false;
  const windows=resolveAllModeRegistrationWindows(event);
  if(!windows.Online.isOpen&&!windows.Offline.isOpen)return false;
  const [total,online,offline]=await Promise.all([
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES).eq('attendance_mode','Online'),
    db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',event.id).in('lifecycle_status',ACTIVE_REGISTRATION_STATUSES).eq('attendance_mode','Offline')
  ]);
  if(total.error||online.error||offline.error)return false;
  const totalFull=Number(event.quota_total||0)>0&&Number(total.count||0)>=Number(event.quota_total);
  if(totalFull)return false;
  const onlineAvailable=windows.Online.isOpen&&!(Number(event.quota_online||0)>0&&Number(online.count||0)>=Number(event.quota_online));
  const offlineAvailable=windows.Offline.isOpen&&!(Number(event.quota_offline||0)>0&&Number(offline.count||0)>=Number(event.quota_offline));
  return onlineAvailable||offlineAvailable;
}

export default async function RegistrationLayout({children}){
  const available=await publicRegistrationAvailable();
  if(!available)redirect('/?pendaftaran=ditutup');
  return children;
}

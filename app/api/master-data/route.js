import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { eventForSlug,masterOptions } from '../../../lib/master-data';
export const dynamic='force-dynamic';

export async function GET(){
  const db=getSupabaseAdmin();
  const {event,error}=await eventForSlug(db);if(error||!event)return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
  try{const options=await masterOptions(db,event.id,{activeOnly:true});return NextResponse.json({options},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=300'}})}catch(e){console.error('master public:',e);return NextResponse.json({message:'Data master belum tersedia. Pastikan migration v0.4.9 sudah dijalankan.'},{status:500})}
}

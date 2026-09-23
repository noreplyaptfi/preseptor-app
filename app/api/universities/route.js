import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';

export const dynamic='force-dynamic';

export async function GET(){
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('universities').select('name').eq('active',true).order('name',{ascending:true});
  if(error) return NextResponse.json({message:'Daftar homebase belum tersedia.'},{status:500});
  return NextResponse.json({universities:(data||[]).map(x=>x.name)},{headers:{'Cache-Control':'no-store'}});
}

import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

const roles=['super_admin','event_admin'];
function cleanName(value=''){return String(value||'').replace(/\s+/g,' ').trim().slice(0,220)}

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('universities').select('*').order('active',{ascending:false}).order('name',{ascending:true});
  if(error) return NextResponse.json({message:'Gagal membaca data homebase.'},{status:500});
  return NextResponse.json({universities:data||[]});
}

export async function POST(request){
  const auth=await requireAdmin(request,roles);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json();
  const name=cleanName(body.name);
  if(name.length<3) return NextResponse.json({message:'Nama perguruan tinggi minimal 3 karakter.'},{status:422});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('universities').insert({name,active:true}).select('*').single();
  if(error){
    if(error.code==='23505') return NextResponse.json({message:'Homebase tersebut sudah ada.'},{status:409});
    return NextResponse.json({message:'Gagal menambahkan homebase.'},{status:500});
  }
  return NextResponse.json({ok:true,university:data});
}

export async function PATCH(request){
  const auth=await requireAdmin(request,roles);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json();
  if(!body.id) return NextResponse.json({message:'ID homebase tidak valid.'},{status:422});
  const patch={updated_at:new Date().toISOString()};
  if(body.name!==undefined){const name=cleanName(body.name);if(name.length<3)return NextResponse.json({message:'Nama perguruan tinggi minimal 3 karakter.'},{status:422});patch.name=name}
  if(body.active!==undefined) patch.active=!!body.active;
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('universities').update(patch).eq('id',body.id).select('*').single();
  if(error){
    if(error.code==='23505') return NextResponse.json({message:'Nama homebase tersebut sudah digunakan.'},{status:409});
    return NextResponse.json({message:'Gagal memperbarui homebase.'},{status:500});
  }
  return NextResponse.json({ok:true,university:data});
}

export async function DELETE(request){
  const auth=await requireAdmin(request,roles);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json().catch(()=>({}));
  if(!body.id) return NextResponse.json({message:'ID homebase tidak valid.'},{status:422});
  const db=getSupabaseAdmin();
  const {error}=await db.from('universities').update({active:false,updated_at:new Date().toISOString()}).eq('id',body.id);
  if(error) return NextResponse.json({message:'Gagal menonaktifkan homebase.'},{status:500});
  return NextResponse.json({ok:true});
}

'use client';
import { getSupabaseBrowser } from './supabase-browser';

// v0.8.0 — Unduh file dari API yang butuh token login (sertifikat PDF, dsb.).
export async function downloadWithAuth(url,fallbackName='dokumen.pdf'){
  const {data}=await getSupabaseBrowser().auth.getSession();
  const t=data.session?.access_token||'';
  if(!t)throw new Error('Sesi berakhir. Silakan login kembali.');
  const r=await fetch(url,{headers:{Authorization:`Bearer ${t}`},cache:'no-store'});
  if(!r.ok){
    const j=await r.json().catch(()=>({}));
    throw new Error(j.message||'Unduhan gagal. Coba lagi.');
  }
  const blob=await r.blob();
  const m=/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition')||'');
  const name=m?.[1]||fallbackName;
  const href=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=href;a.download=name;a.rel='noopener';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(href),60000);
  return name;
}

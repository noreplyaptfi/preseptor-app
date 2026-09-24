'use client';
import { getSupabaseBrowser } from './supabase-browser';

export async function parseApiResponse(response){
  const text=await response.text();
  if(!text) return {};
  try{return JSON.parse(text)}catch{return {message:response.ok?'Respons server tidak valid.':`Server menolak permintaan (${response.status}).`}}
}

export function fileMeta(file){return file&&file.size?{name:file.name,type:file.type,size:file.size}:null}

export async function uploadSignedFiles(uploads,fileMap,onProgress){
  const entries=Object.entries(uploads||{});
  const supabase=getSupabaseBrowser();
  for(let i=0;i<entries.length;i++){
    const [kind,target]=entries[i];
    const file=fileMap[kind];
    if(!file) throw new Error(`File ${kind} tidak ditemukan.`);
    onProgress?.({step:i+1,total:entries.length,kind,fileName:file.name});
    const {error}=await supabase.storage.from('preseptor-private').uploadToSignedUrl(target.path,target.token,file,{contentType:file.type,cacheControl:'3600'});
    if(error) throw new Error(`Gagal mengunggah ${file.name}. Periksa koneksi internet lalu coba lagi.`);
  }
}

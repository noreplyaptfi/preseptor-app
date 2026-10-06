'use client';
import { useEffect } from 'react';
import { toast } from '../lib/ui-feedback';

// v0.7.2 — Menjembatani state notice/error lama ke toast global.
// notice ditampilkan sebagai toast sukses lalu dibersihkan (onNotice),
// error ditampilkan sebagai toast error setiap kali nilainya berubah.
export default function FeedbackBridge({notice,error,onNotice,onError}){
  useEffect(()=>{if(notice){toast.success(notice);onNotice?.()}},[notice]);
  useEffect(()=>{if(error){toast.error(error);onError?.()}},[error]);
  return null;
}

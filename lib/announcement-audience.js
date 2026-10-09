// v0.8.3 — Aturan penerima pengumuman (aman dipakai di server maupun browser).
// Email pengumuman tidak dikirim ke peserta yang ditolak atau mengundurkan diri,
// dan tidak dikirim ke alamat email yang belum valid.
// v0.8.5 — + Peserta SKP, dan Peserta SKP yang belum mengisi NIK (pengingat NIK).
import { nikFilled } from './nik';

export const ANNOUNCEMENT_AUDIENCES=[
  {value:'all',label:'Semua peserta aktif'},
  {value:'verified',label:'Peserta aktif terverifikasi'},
  {value:'online',label:'Peserta aktif Online'},
  {value:'offline',label:'Peserta aktif Offline'},
  {value:'skp',label:'Peserta SKP'},
  {value:'skp_nik_missing',label:'Peserta SKP yang belum mengisi NIK'}
];

export const ANNOUNCEMENT_AUDIENCE_VALUES=ANNOUNCEMENT_AUDIENCES.map(a=>a.value);

const INACTIVE=['withdrawn','rejected'];

// Siapa yang melihat pengumuman di dashboard (perilaku lama, tidak berubah).
export function announcementMatches(reg,audience){
  if(audience==='all') return true;
  if(audience==='online') return reg.attendance_mode==='Online';
  if(audience==='offline') return reg.attendance_mode==='Offline';
  if(audience==='verified') return reg.overall_status==='verified';
  // Pengumuman SKP tampil di dashboard semua peserta SKP (termasuk yang sudah mengisi NIK).
  if(audience==='skp'||audience==='skp_nik_missing') return !!reg.skp_eligible;
  return false;
}

export function emailDeliverable(reg){
  const email=String(reg?.email||'');
  return !!email&&!reg?.email_needs_update&&!email.endsWith('@migration.invalid');
}

export function activeForAnnouncement(reg){
  return !INACTIVE.includes(String(reg?.lifecycle_status||'active'));
}

// Siapa yang menerima EMAIL pengumuman.
export function announcementRecipient(reg,audience){
  // Email pengingat NIK hanya untuk peserta SKP yang NIK-nya masih kosong.
  if(audience==='skp_nik_missing'&&nikFilled(reg)) return false;
  return emailDeliverable(reg)&&activeForAnnouncement(reg)&&announcementMatches(reg,audience);
}

export function countAnnouncementRecipients(regs,audience){
  return (regs||[]).filter(r=>announcementRecipient(r,audience)).length;
}

// v0.8.3 — Aturan penerima pengumuman (aman dipakai di server maupun browser).
// Email pengumuman tidak dikirim ke peserta yang ditolak atau mengundurkan diri,
// dan tidak dikirim ke alamat email yang belum valid.

export const ANNOUNCEMENT_AUDIENCES=[
  {value:'all',label:'Semua peserta aktif'},
  {value:'verified',label:'Peserta aktif terverifikasi'},
  {value:'online',label:'Peserta aktif Online'},
  {value:'offline',label:'Peserta aktif Offline'}
];

const INACTIVE=['withdrawn','rejected'];

// Siapa yang melihat pengumuman di dashboard (perilaku lama, tidak berubah).
export function announcementMatches(reg,audience){
  if(audience==='all') return true;
  if(audience==='online') return reg.attendance_mode==='Online';
  if(audience==='offline') return reg.attendance_mode==='Offline';
  if(audience==='verified') return reg.overall_status==='verified';
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
  return emailDeliverable(reg)&&activeForAnnouncement(reg)&&announcementMatches(reg,audience);
}

export function countAnnouncementRecipients(regs,audience){
  return (regs||[]).filter(r=>announcementRecipient(r,audience)).length;
}

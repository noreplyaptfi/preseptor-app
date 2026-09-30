export const requestLabels={email_change:'Perubahan email',attendance_mode_change:'Perubahan mode kehadiran',withdrawal:'Pengunduran diri'};
export const requestStatuses=['pending','approved','rejected','cancelled'];
export const refundStatuses=['requested','under_review','ready','processing','refunded','rejected','cancelled'];
export function htmlEscape(value=''){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
export function requestEmailHtml({name,title,message,note=''}){
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17204f"><h2>${htmlEscape(title)}</h2><p>Yth. ${htmlEscape(name)},</p><p>${htmlEscape(message)}</p>${note?`<p><strong>Catatan panitia:</strong><br>${htmlEscape(note)}</p>`:''}<p>Silakan masuk ke Dashboard Peserta untuk melihat status terbaru.</p><p>Panitia Pelatihan Preseptor APTFI</p></div>`;
}

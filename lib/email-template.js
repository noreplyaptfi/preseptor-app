function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function emailShell({ eyebrow = 'APTFI · Preseptor', title, intro = '', body = '', ctaLabel = '', ctaUrl = '', footer = '' }) {
  return `<!doctype html><html><body style="margin:0;background:#f3f7ff;font-family:Arial,Helvetica,sans-serif;color:#101d4b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7ff;padding:28px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #dce7f7;border-radius:20px;overflow:hidden">
      <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#11165a,#1554dd);color:#fff">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;opacity:.85">${escapeHtml(eyebrow)}</div>
        <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2">${escapeHtml(title)}</h1>
      </td></tr>
      <tr><td style="padding:30px 32px">
        ${intro ? `<p style="margin:0 0 18px;line-height:1.65;color:#465779">${intro}</p>` : ''}
        ${body}
        ${ctaUrl ? `<div style="margin:26px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#1554dd;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">${escapeHtml(ctaLabel || 'Buka')}</a></div>` : ''}
        <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#718096">${footer || 'Email ini dikirim otomatis oleh sistem APTFI. Jika Anda tidak meminta tindakan ini, abaikan email ini.'}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export function passwordLinkEmail({ name = '', action = 'Atur password', url, audience = 'participant' }) {
  const isAdmin = audience === 'admin';
  return emailShell({
    eyebrow: isAdmin ? 'APTFI · Panel Panitia' : 'APTFI · Preseptor',
    title: action,
    intro: name ? `Yth. ${escapeHtml(name)},` : 'Yth. Bapak/Ibu,',
    body: `<p style="line-height:1.65;color:#465779">Klik tombol di bawah untuk ${action.toLowerCase()}. Tautan bersifat pribadi, hanya dapat dipakai satu kali, dan berlaku selama 30 menit.</p>`,
    ctaLabel: action,
    ctaUrl: url,
    footer: 'Jangan meneruskan tautan ini kepada orang lain. APTFI tidak pernah meminta password Anda melalui email.'
  });
}

export function registrationEmail({ name, registrationCode, activationUrl }) {
  return emailShell({
    title: 'Pendaftaran berhasil diterima',
    intro: `Yth. ${escapeHtml(name)},`,
    body: `<p style="line-height:1.65;color:#465779">Pendaftaran Pelatihan Preseptor APTFI sudah kami terima.</p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#eef4ff;border:1px solid #cbdcff">
        <div style="font-size:12px;color:#66769a">Nomor pendaftaran</div>
        <div style="font-size:20px;font-weight:700;color:#1554dd;margin-top:4px">${escapeHtml(registrationCode)}</div>
      </div>
      <p style="line-height:1.65;color:#465779">Status dokumen dan pembayaran saat ini menunggu verifikasi panitia. Tagihan / invoice tersedia di Dashboard Peserta. Gunakan Dashboard Peserta untuk memantau status.</p>`,
    ctaLabel: activationUrl ? 'Aktifkan akun peserta' : '',
    ctaUrl: activationUrl || '',
    footer: activationUrl ? 'Atur password melalui tombol di atas. Jika tautan sudah kedaluwarsa, Anda dapat meminta tautan baru dari halaman login.' : 'Anda dapat mengakses Dashboard Peserta menggunakan email pendaftaran.'
  });
}

export function rejectionEmail({name,registrationCode,documentLabel,reason,nextAction,dashboardUrl}){
  return emailShell({
    title:`Perlu perbaikan: ${documentLabel}`,
    intro:`Yth. ${escapeHtml(name)},`,
    body:`<p style="line-height:1.65;color:#465779">Panitia telah memeriksa <strong>${escapeHtml(documentLabel)}</strong> pada pendaftaran <strong>${escapeHtml(registrationCode)}</strong>. Dokumen tersebut perlu diperbaiki.</p>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#fff4f3;border:1px solid #ffc9c5">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#a63b35;font-weight:700">Alasan / catatan</div>
        <div style="margin-top:7px;line-height:1.6;color:#7b2925">${escapeHtml(reason)}</div>
      </div>
      <div style="margin:20px 0;padding:18px;border-radius:14px;background:#eef4ff;border:1px solid #cbdcff">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#244b9a;font-weight:700">Langkah selanjutnya</div>
        <div style="margin-top:7px;line-height:1.6;color:#31476f">${escapeHtml(nextAction)}</div>
      </div>`,
    ctaLabel:'Buka Dashboard Peserta',
    ctaUrl:dashboardUrl,
    footer:'Silakan lakukan perbaikan melalui Dashboard Peserta. Jika membutuhkan bantuan, hubungi panitia melalui kanal resmi kegiatan.'
  });
}

export function paymentVerifiedEmail({name,registrationCode,dashboardUrl}){
  return emailShell({
    title:'Pembayaran terverifikasi',
    intro:`Yth. ${escapeHtml(name)},`,
    body:`<p style="line-height:1.65;color:#465779">Pembayaran untuk Pelatihan Preseptor APTFI telah <strong>TERVERIFIKASI</strong>.</p><div style="margin:20px 0;padding:18px;border-radius:14px;background:#eef4ff;border:1px solid #cbdcff"><div style="font-size:12px;color:#66769a">Nomor pendaftaran</div><div style="font-size:20px;font-weight:700;color:#1554dd;margin-top:4px">${escapeHtml(registrationCode)}</div></div><p style="line-height:1.65;color:#465779">Kwitansi pembayaran sudah tersedia di Dashboard Peserta. Status lengkap pendaftaran juga dapat dipantau dari halaman yang sama.</p>`,
    ctaLabel:'Buka Dashboard Peserta',
    ctaUrl:dashboardUrl
  });
}


export function announcementEmail({subject,bodyHtml,dashboardUrl}){
  return emailShell({
    eyebrow:'APTFI · Pengumuman Preseptor',
    title:subject,
    intro:'Yth. Bapak/Ibu Peserta,',
    body:`<div style="line-height:1.7;color:#465779">${bodyHtml}</div>`,
    ctaLabel:'Buka Pengumuman di Dashboard',
    ctaUrl:dashboardUrl,
    footer:'Pengumuman ini dikirim oleh panitia Pelatihan Preseptor APTFI.'
  });
}

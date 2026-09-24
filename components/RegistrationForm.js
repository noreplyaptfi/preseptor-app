'use client';
import { useEffect, useState } from 'react';
import UniversityCombobox from './UniversityCombobox';
import { fileMeta, parseApiResponse, uploadSignedFiles } from '../lib/direct-upload-client';

function FileUpload({name,label,description,required=true}){
  const [fileName,setFileName]=useState('');
  return <label className={`upload-card ${fileName?'has-file':''}`}>
    <input type="file" name={name} accept="image/jpeg,image/png,application/pdf" required={required} onChange={e=>setFileName(e.target.files?.[0]?.name||'')} />
    <span className="upload-icon">↑</span>
    <span className="upload-copy"><strong>{label}</strong><small>{fileName||description}</small></span>
    <span className="upload-action">{fileName?'Ganti':'Pilih file'}</span>
  </label>
}

function ChoiceCard({name,value,checked,onChange,title,description,disabled=false,badge=''}){
  return <label className={`choice-input-card ${checked?'selected':''} ${disabled?'disabled':''}`}>
    <input type="radio" name={name} value={value} checked={checked} onChange={onChange} required disabled={disabled} />
    <span className="choice-radio"/>
    <span><strong>{title}</strong><small>{description}</small>{badge&&<em className="choice-capacity">{badge}</em>}</span>
  </label>
}

export default function RegistrationForm(){
  const [type,setType]=useState('');
  const [mode,setMode]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState(null);
  const [universities,setUniversities]=useState([]);
  const [resetKey,setResetKey]=useState(0);
  const [availability,setAvailability]=useState(null);
  const [uploadProgress,setUploadProgress]=useState('');
  async function loadAvailability(){try{const r=await fetch('/api/public/settings',{cache:'no-store'});const j=await r.json();if(r.ok)setAvailability(j.availability||null)}catch{}}
  useEffect(()=>{fetch('/api/universities').then(async r=>{if(!r.ok)throw new Error('homebase');const j=await r.json();return j.universities||[]}).then(setUniversities).catch(()=>fetch('/universities.json').then(r=>r.json()).then(setUniversities).catch(()=>setUniversities([])));loadAvailability();},[]);
  const practitioner=['practitioner','lecturer_practitioner'].includes(type);
  const lecturer=['lecturer','lecturer_practitioner'].includes(type);

  async function submit(e){
    e.preventDefault();
    const form=e.currentTarget;
    setBusy(true);setMessage(null);setUploadProgress('Memeriksa data pendaftaran...');
    const fd=new FormData(form);
    const files={
      stra:fd.get('stra_proof'),
      experience:fd.get('experience_proof'),
      payment_proof:fd.get('payment_proof')
    };
    const payload={
      full_name:fd.get('full_name'),email:fd.get('email'),whatsapp:fd.get('whatsapp'),university:fd.get('university'),
      participant_type:fd.get('participant_type'),stra_number:fd.get('stra_number'),practice_type:fd.get('practice_type'),practice_name:fd.get('practice_name'),practice_years:fd.get('practice_years'),teaching_years:fd.get('teaching_years'),attendance_mode:fd.get('attendance_mode'),confirm_data:fd.get('confirm_data'),website:fd.get('website'),
      files:{stra:fileMeta(files.stra),experience:fileMeta(files.experience),payment_proof:fileMeta(files.payment_proof)}
    };
    try{
      const prep=await fetch('/api/register/prepare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const prepJson=await parseApiResponse(prep);
      if(!prep.ok){const err=new Error(prepJson.message||'Pendaftaran gagal diproses.');err.duplicate=!!prepJson.duplicate;throw err;}
      setUploadProgress('Menyiapkan unggahan dokumen...');
      await uploadSignedFiles(prepJson.uploads,files,({step,total,fileName})=>setUploadProgress(`Mengunggah dokumen ${step}/${total}: ${fileName}`));
      setUploadProgress('Menyimpan pendaftaran...');
      const final=await fetch('/api/register/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:prepJson.sessionId})});
      const j=await parseApiResponse(final);
      if(!final.ok){const err=new Error(j.message||'Pendaftaran gagal disimpan.');err.duplicate=!!j.duplicate;throw err;}
      form.reset();setType('');setMode('');setResetKey(v=>v+1);await loadAvailability();
      setMessage({ok:true,text:`Pendaftaran berhasil. Nomor pendaftaran: ${j.registrationCode}`,code:j.registrationCode,emailSent:j.emailSent});
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(err){
      const friendly=err?.message==='Failed to fetch'?'Koneksi ke server terputus saat mengirim data. Pastikan internet stabil lalu coba kembali. Dokumen yang besar kini diunggah langsung ke penyimpanan aman.':(err?.message||'Pendaftaran gagal diproses.');
      setMessage({ok:false,text:friendly,duplicate:!!err.duplicate});window.scrollTo({top:0,behavior:'smooth'});
    }finally{setBusy(false);setUploadProgress('')}
  }

  return <div className="registration-layout">
    <aside className="form-sidebar">
      <div className="form-sidebar-card">
        <div className="eyebrow brand-blue">Form Pendaftaran</div>
        <h2>Siapkan sekitar 8–10 menit.</h2>
        <p>Isi data dengan benar karena informasi ini digunakan untuk verifikasi dan akun peserta.</p>
        <ol className="form-step-list"><li><span>01</span>Identitas</li><li><span>02</span>Profesi & STRA</li><li><span>03</span>Dokumen</li><li><span>04</span>Mode</li><li><span>05</span>Pembayaran</li><li><span>06</span>Konfirmasi</li></ol>
        <div className="sidebar-note"><strong>Perlu bantuan?</strong><span>Baca panduan sebelum melanjutkan.</span><a href="/panduan">Buka panduan →</a></div>
      </div>
    </aside>

    <form onSubmit={submit} encType="multipart/form-data" className="registration-form">
      {message&&<div className={`alert form-message ${message.ok?'alert-success':'alert-error'}`}>{message.ok?<div className="success-card"><div className="success-icon">✓</div><div><strong>{message.text}</strong><p>{message.emailSent?'Email aktivasi akun sudah dikirim. Buka email tersebut untuk membuat password dan masuk ke Dashboard Peserta.':'Pendaftaran tersimpan. Jika email aktivasi belum masuk, gunakan menu Aktivasi akun di halaman login.'}</p><a href="/login">Masuk ke Dashboard Peserta →</a></div></div>:<div><strong>{message.duplicate?'Pendaftaran sudah terdeteksi':'Pendaftaran belum dapat diproses'}</strong><p>{message.text}</p>{message.duplicate&&<a className="btn btn-secondary btn-small" href="/login">Masuk ke akun yang sudah ada</a>}</div>}</div>}

      <section className="form-section-card" id="identitas">
        <div className="form-section-heading"><span className="section-number">01</span><div><div className="eyebrow brand-blue">Data Peserta</div><h2>Identitas utama</h2><p>Gunakan email dan WhatsApp aktif. Data ini juga membantu sistem mencegah pendaftaran ganda.</p></div></div>
        <div className="grid grid-2">
          <div className="field"><label>Nama lengkap beserta gelar <b>*</b></label><input name="full_name" required maxLength="255" placeholder="Contoh: apt. Ahmad Fauzan, M.Farm." /></div>
          <div className="field"><label>Email aktif <b>*</b></label><input name="email" type="email" required placeholder="nama@email.com"/><small>Dipakai untuk login dan seluruh notifikasi pendaftaran.</small></div>
          <div className="field"><label>Nomor WhatsApp <b>*</b></label><input name="whatsapp" inputMode="tel" required placeholder="08xxxxxxxxxx"/></div>
          <div className="field"><label>Homebase perguruan tinggi <b>*</b></label><UniversityCombobox name="university" universities={universities} required/><small>Ketik nama kampus lalu pilih dari daftar yang muncul.</small></div>
        </div>
      </section>

      <section className="form-section-card" id="profesi">
        <div className="form-section-heading"><span className="section-number">02</span><div><div className="eyebrow brand-blue">Kelayakan Peserta</div><h2>Profesi, pengalaman, dan STRA</h2><p>Pilih kategori yang paling menggambarkan aktivitas profesional Anda saat ini.</p></div></div>
        <div className="eligibility-banner"><span>✓</span><div><strong>Syarat singkat</strong><p>Memiliki STRA; praktisi memenuhi masa praktik sesuai fasilitas; atau dosen telah mengajar minimal 2 tahun.</p></div></div>
        <div className="field"><label>Kategori peserta <b>*</b></label><div className="choice-input-grid three"><ChoiceCard name="participant_type" value="practitioner" checked={type==='practitioner'} onChange={e=>setType(e.target.value)} title="Praktisi" description="Apotek, RS, industri, PBF, atau puskesmas"/><ChoiceCard name="participant_type" value="lecturer" checked={type==='lecturer'} onChange={e=>setType(e.target.value)} title="Dosen" description="Pengalaman mengajar minimal 2 tahun"/><ChoiceCard name="participant_type" value="lecturer_practitioner" checked={type==='lecturer_practitioner'} onChange={e=>setType(e.target.value)} title="Dosen & Praktisi" description="Memiliki dua aktivitas profesional"/></div></div>
        <div className="field"><label>Nomor STRA <b>*</b></label><input name="stra_number" required maxLength="100" placeholder="Masukkan nomor STRA sesuai dokumen"/><small>Nomor STRA digunakan sebagai salah satu identitas unik untuk mencegah pendaftaran ganda.</small></div>
        {practitioner&&<div className="grid grid-3 conditional-fields"><div className="field"><label>Jenis tempat praktik <b>*</b></label><select name="practice_type" required><option value="">Pilih tempat praktik</option><option>Apotek</option><option>Rumah Sakit (RS)</option><option>Industri</option><option>PBF</option><option>Puskesmas</option></select></div><div className="field"><label>Nama tempat praktik <b>*</b></label><input name="practice_name" required placeholder="Nama fasilitas / perusahaan"/></div><div className="field"><label>Lama praktik <b>*</b></label><div className="input-suffix"><input name="practice_years" type="number" min="0" step="0.5" required placeholder="3"/><span>tahun</span></div></div></div>}
        {lecturer&&<div className="field conditional-fields"><label>Lama mengajar sebagai dosen <b>*</b></label><div className="input-suffix compact"><input name="teaching_years" type="number" min="0" step="0.5" required placeholder="2"/><span>tahun</span></div></div>}
      </section>

      <section className="form-section-card" id="dokumen">
        <div className="form-section-heading"><span className="section-number">03</span><div><div className="eyebrow brand-blue">Dokumen Persyaratan</div><h2>Unggah bukti pendukung</h2><p>Pastikan teks pada dokumen dapat dibaca. Format JPG, PNG, atau PDF maksimal 5 MB per file.</p></div></div>
        <div className="upload-grid"><FileUpload key={`stra-${resetKey}`} name="stra_proof" label="Bukti STRA" description="Upload scan/foto STRA yang jelas"/><FileUpload key={`exp-${resetKey}`} name="experience_proof" label="Bukti pengalaman" description="Surat keterangan, SK, atau dokumen relevan"/></div>
      </section>

      <section className="form-section-card" id="mode">
        <div className="form-section-heading"><span className="section-number">04</span><div><div className="eyebrow brand-blue">Keikutsertaan</div><h2>Pilih mode pelatihan</h2><p>Pilih salah satu mode yang akan diikuti selama kegiatan.</p></div></div>
        <div className="choice-input-grid two"><ChoiceCard name="attendance_mode" value="Online" checked={mode==='Online'} onChange={e=>setMode(e.target.value)} title="Online" description="Mengikuti melalui Zoom Meeting" disabled={availability?.Online===false} badge={availability?.Online===false?'Kuota penuh':''}/><ChoiceCard name="attendance_mode" value="Offline" checked={mode==='Offline'} onChange={e=>setMode(e.target.value)} title="Offline" description="Kampus Farmasi Universitas Andalas" disabled={availability?.Offline===false} badge={availability?.Offline===false?'Kuota penuh':''}/></div>
      </section>

      <section className="form-section-card" id="pembayaran">
        <div className="form-section-heading"><span className="section-number">05</span><div><div className="eyebrow brand-blue">Pembayaran</div><h2>Konfirmasi biaya pendaftaran</h2><p>Lakukan transfer lalu unggah bukti pembayaran untuk diverifikasi panitia.</p></div></div>
        <div className="payment-card"><div><small>Biaya pendaftaran</small><strong>Rp 1.000.000</strong></div><div><small>Bank tujuan</small><strong>BNI · 6666512055</strong><span>a.n APTFI</span></div></div>
        <FileUpload key={`pay-${resetKey}`} name="payment_proof" label="Bukti pembayaran" description="Upload bukti transfer yang dapat dibaca dengan jelas"/>
      </section>

      <section className="form-section-card submit-section" id="konfirmasi">
        <div className="form-section-heading"><span className="section-number">06</span><div><div className="eyebrow brand-blue">Konfirmasi</div><h2>Periksa sebelum dikirim</h2><p>Setelah dikirim, Anda akan menerima nomor pendaftaran dan email aktivasi akun peserta.</p></div></div>
        <label className="agreement"><input type="checkbox" name="confirm_data" value="1" required/><span>Saya menyatakan bahwa data dan dokumen yang saya unggah benar, milik saya, dan dapat dipertanggungjawabkan.</span></label>
        <input name="website" className="hidden" tabIndex="-1" autoComplete="off"/>
        <div className="submit-actions"><a href="/panduan" className="text-link">Baca panduan kembali</a><div className="submit-progress-wrap">{busy&&uploadProgress&&<small className="submit-progress">{uploadProgress}</small>}<button className="btn btn-brand-primary submit-button" disabled={busy}>{busy?'Memproses...':'Kirim Pendaftaran'}</button></div></div>
      </section>
    </form>
  </div>
}

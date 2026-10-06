'use client';
import { useEffect,useMemo,useState } from 'react';

// v0.7.0 — Panel peserta untuk Pretest, Evaluasi, dan Posttest.

const LABEL={pretest:'Pretest',posttest:'Posttest',evaluation:'Evaluasi'};

function fmtDate(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
function keyOf(questionId,targetId){return targetId?`${questionId}::${targetId}`:questionId}
function isAnswered(v){return !(v===undefined||v===null||String(v).trim()==='')}

function draftKey(kind,moduleId){return `aptfi-${kind}-${moduleId}-draft`}
function readDraft(kind,moduleId){try{const raw=localStorage.getItem(draftKey(kind,moduleId));return raw?JSON.parse(raw):{}}catch{return {}}}
function writeDraft(kind,moduleId,answers){try{localStorage.setItem(draftKey(kind,moduleId),JSON.stringify(answers))}catch{}}
function clearDraft(kind,moduleId){try{localStorage.removeItem(draftKey(kind,moduleId))}catch{}}

export default function AssessmentParticipantPanel({kind,data,loading,refresh,token,onOpenAttendance}){
  const label=LABEL[kind]||'Assessment';
  const [showForm,setShowForm]=useState(false),[result,setResult]=useState(null);

  if(loading&&!data)return <section className="participant-card"><div className="participant-loading compact"><div className="spinner"/><p>Memuat {label}...</p></div></section>;
  if(!data||data.configured===false)return <Locked icon="◷" title={`${label} belum tersedia`} text={data?.message||`Panitia belum menyiapkan ${label}.`}/>;
  if(!data.eligible)return <Locked icon="🔒" title="Belum memenuhi syarat" text={`${label} hanya tersedia untuk peserta dengan pendaftaran yang sudah terverifikasi.`}/>;
  if(data.attendance?.required&&!data.attendance?.satisfied)return <Locked icon="✓" title="Presensi terlebih dahulu" text={`Lakukan presensi ${data.attendance?.day?.title||`Hari ${data.module?.requires_day_number}`} sebelum mengerjakan ${label}.`}>
    {onOpenAttendance&&<button className="btn btn-secondary" onClick={onOpenAttendance}>Buka Kehadiran</button>}
  </Locked>;

  const m=data.module||{};
  const single=Number(m.max_attempts)===1;
  const attempts=data.attempts||[];

  // Modul sekali kirim (Pretest, Evaluasi) yang sudah dikirim.
  if(single&&attempts.length){
    const a=data.attempt;
    return <section className="participant-card pretest-participant completed">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">{label}</div><h2>{kind==='evaluation'?'Terima kasih':'Sudah selesai'}</h2><p>{kind==='evaluation'?'Evaluasi Anda sudah kami terima. Masukan Anda sangat berarti bagi pelatihan berikutnya.':'Jawaban Anda sudah tersimpan dan tidak dapat dikirim ulang.'}</p></div><span className="status status-ok">Selesai</span></div>
      {result&&<div className="alert alert-success">{result}</div>}
      <div className="pretest-result-card">
        <div><span>Dikirim</span><strong>{fmtDate(a?.submitted_at)} WIB</strong></div>
        {a?.percent!==null&&a?.percent!==undefined&&<><div><span>Skor</span><strong>{a.score} / {a.max_score}</strong></div><div><span>Nilai</span><strong>{a.percent}%</strong></div></>}
      </div>
    </section>;
  }

  const closedCopy=data.state==='upcoming'?`${label} belum dibuka.`:data.state==='closed'?`Waktu ${label} sudah ditutup.`:data.state==='inactive'?`${label} belum diaktifkan panitia.`:data.attemptsLeft===0?`Batas pengerjaan ${label} sudah tercapai.`:`Soal ${label} belum tersedia.`;
  const schedule=m.open_at?<small>Jadwal: {fmtDate(m.open_at)} – {fmtDate(m.close_at)} WIB</small>:null;

  // Posttest: ringkasan nilai terbaik + riwayat attempt.
  const summary=attempts.length>0&&!single?<section className="participant-card assessment-summary">
    <div className="participant-card-head"><div><div className="eyebrow brand-blue">{label}</div><h2>{data.passed===true?'Lulus':data.passed===false?'Belum mencapai batas lulus':'Hasil Anda'}</h2>
      <p>{m.pass_percent!==null&&m.pass_percent!==undefined?`Batas lulus ${m.pass_percent}. `:''}Nilai terbaik dari {attempts.length} attempt yang digunakan.{data.canStart?' Anda masih dapat mengerjakan ulang selama jadwal dibuka.':''}</p></div>
      {data.passed!==null&&data.passed!==undefined&&<span className={`status ${data.passed?'status-ok':'status-pending'}`}>{data.passed?'Lulus':'Belum lulus'}</span>}
    </div>
    {result&&<div className="alert alert-success">{result}</div>}
    <div className="pretest-result-card">
      <div><span>Nilai terbaik</span><strong>{data.best?.percent??'—'}{data.best?.percent!==null&&data.best?.percent!==undefined?'%':''}</strong></div>
      <div><span>Skor terbaik</span><strong>{data.best?.score!==null&&data.best?.score!==undefined?`${data.best.score} / ${data.best.max_score}`:'—'}</strong></div>
      <div><span>Jumlah attempt</span><strong>{attempts.length}{data.attemptsLeft!==null&&data.attemptsLeft!==undefined?` (sisa ${data.attemptsLeft})`:''}</strong></div>
    </div>
    <ol className="assessment-attempt-list">{attempts.map(a=><li key={a.id}><span>Attempt {a.attempt_no}</span><strong>{a.percent!==null&&a.percent!==undefined?`${a.percent}%`:'Terkirim'}</strong><small>{fmtDate(a.submitted_at)} WIB</small></li>)}</ol>
    {data.canStart&&!showForm&&<button className="btn btn-brand-primary" onClick={()=>{setResult(null);setShowForm(true)}}>Kerjakan {label} lagi</button>}
    {!data.canStart&&<p className="muted">{closedCopy}</p>}
  </section>:null;

  if(!data.canStart)return <>{summary}{!summary&&<Locked icon="◷" title={`${label} belum dapat dikerjakan`} text={closedCopy}>{schedule}<button className="btn btn-secondary" onClick={refresh}>Periksa kembali</button></Locked>}</>;

  const formVisible=attempts.length===0||showForm;
  return <>
    {summary}
    {formVisible&&<AssessmentForm kind={kind} label={label} data={data} token={token}
      onDone={async(message)=>{setResult(message);setShowForm(false);await refresh()}}
      onCancel={attempts.length?()=>setShowForm(false):null}/>}
  </>;
}

function Locked({icon,title,text,children}){
  return <section className="participant-card pretest-participant locked"><div className="access-lock">{icon}</div><h2>{title}</h2><p>{text}</p>{children}</section>;
}

function AssessmentForm({kind,label,data,token,onDone,onCancel}){
  const m=data.module;
  const questions=data.questions||[],targets=data.targets||[];
  const units=useMemo(()=>targets.length?targets.flatMap(t=>questions.map(q=>({q,t}))):questions.map(q=>({q,t:null})),[questions,targets]);
  const [answers,setAnswers]=useState(()=>({...(data.prefill||{}),...readDraft(kind,m.id)}));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  useEffect(()=>{writeDraft(kind,m.id,answers)},[answers,kind,m.id]);

  const required=units.filter(u=>u.q.required);
  const answered=required.filter(u=>isAnswered(answers[keyOf(u.q.id,u.t?.id)])).length;
  const set=(k,v)=>setAnswers(x=>({...x,[k]:v}));

  async function submit(e){
    e.preventDefault();
    const missing=required.find(u=>!isAnswered(answers[keyOf(u.q.id,u.t?.id)]));
    if(missing){
      const n=questions.indexOf(missing.q)+1;
      setError(`Pertanyaan nomor ${n}${missing.t?` untuk ${missing.t.name}`:''} belum dijawab.`);
      document.getElementById(`aq-${keyOf(missing.q.id,missing.t?.id)}`)?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    const confirmText=kind==='posttest'?'Kirim jawaban Posttest? Nilai terbaik dari semua attempt yang akan digunakan.':`Kirim ${label}? Setelah dikirim, jawaban tidak dapat diubah.`;
    if(!confirm(confirmText))return;
    try{
      setBusy(true);setError('');
      const t=await token();
      const payload={};
      for(const u of units){const k=keyOf(u.q.id,u.t?.id);if(isAnswered(answers[k]))payload[k]=answers[k]}
      const r=await fetch(`/api/me/${kind}`,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify({answers:payload})});
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.message||`${label} gagal dikirim.`);
      clearDraft(kind,m.id);
      let message=`${label} berhasil dikirim.`;
      if(kind==='evaluation')message='Evaluasi berhasil dikirim. Terima kasih atas masukan Anda.';
      else if(j.attempt?.percent!==null&&j.attempt?.percent!==undefined){
        message=`${label} berhasil dikirim. Nilai attempt ini ${j.attempt.percent}%.`;
        if(kind==='posttest'&&j.best)message+=` Nilai terbaik Anda ${j.best.percent}%${j.passed===true?' — Lulus.':j.passed===false?' — belum mencapai batas lulus.':'.'}`;
      }
      await onDone(message);
    }catch(err){setError(err.message)}
    finally{setBusy(false)}
  }

  let lastSection=null;
  const renderQuestion=(q,i,t)=>{
    const k=keyOf(q.id,t?.id);
    const showSection=!t&&q.section&&q.section!==lastSection;
    if(!t)lastSection=q.section;
    return <div key={k}>
      {showSection&&<h3 className="assessment-section-title">{q.section}</h3>}
      <fieldset id={`aq-${k}`} className="pretest-question">
        <legend><span>{i+1}</span>{q.question_text}{!q.required&&<em className="assessment-optional">opsional</em>}</legend>
        {q.question_type==='single_choice'&&<div className="pretest-choice-list">{q.options.map(o=><label key={o.id} className={answers[k]===o.id?'selected':''}><input type="radio" name={k} value={o.id} checked={answers[k]===o.id} onChange={()=>set(k,o.id)}/><span>{o.option_text}</span></label>)}</div>}
        {q.question_type==='likert'&&<LikertInput name={k} q={q} value={answers[k]} onChange={v=>set(k,v)}/>}
        {q.question_type==='text'&&<textarea className="assessment-textarea" rows="4" maxLength={4000} value={answers[k]||''} onChange={e=>set(k,e.target.value)} placeholder="Tulis jawaban Anda..."/>}
      </fieldset>
    </div>;
  };

  return <form className="participant-card pretest-participant" onSubmit={submit} noValidate>
    <div className="participant-card-head"><div><div className="eyebrow brand-blue">Assessment Hari-H</div><h2>{m.title}</h2><p>{m.description||'Jawab semua pertanyaan, lalu kirim.'}</p></div>{data.testAccount&&<span className="status status-info">TEST</span>}</div>
    {data.testAccount&&<div className="alert alert-info">Mode TEST bypass jadwal, tetapi hasilnya tidak masuk statistik resmi.</div>}
    {m.close_at&&<p className="assessment-deadline">Ditutup {fmtDate(m.close_at)} WIB. Jawaban tersimpan otomatis di perangkat ini sampai Anda mengirimnya.</p>}
    <div className="pretest-questionnaire">
      {targets.length?targets.map((t,ti)=><section key={t.id} className="assessment-target-card">
        <header><span>{ti+1}/{targets.length}</span><div><h3>{t.name}</h3>{t.affiliation&&<small>{t.affiliation}</small>}{t.topic&&<p>{t.topic}</p>}</div></header>
        {questions.map((q,i)=>renderQuestion(q,i,t))}
      </section>):questions.map((q,i)=>renderQuestion(q,i,null))}
    </div>
    {error&&<div className="alert alert-error">{error}</div>}
    <div className="pretest-submit">
      <span>{answered} / {required.length} wajib terjawab</span>
      <div className="assessment-submit-actions">
        {onCancel&&<button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Batal</button>}
        <button className="btn btn-brand-primary" disabled={busy}>{busy?'Mengirim...':`Kirim ${label}`}</button>
      </div>
    </div>
  </form>;
}

function LikertInput({name,q,value,onChange}){
  const min=Number(q.scale_min??1),max=Number(q.scale_max??5);
  const values=[];for(let v=min;v<=max;v++)values.push(v);
  return <div className="assessment-likert">
    <div className="assessment-likert-scale" role="radiogroup">
      {values.map(v=><label key={v} className={Number(value)===v?'selected':''}><input type="radio" name={name} value={v} checked={Number(value)===v} onChange={()=>onChange(v)}/><span>{v}</span></label>)}
    </div>
    {(q.scale_min_label||q.scale_max_label)&&<div className="assessment-likert-labels"><small>{min} = {q.scale_min_label||'—'}</small><small>{max} = {q.scale_max_label||'—'}</small></div>}
  </div>;
}

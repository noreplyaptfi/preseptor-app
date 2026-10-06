'use client';
import { useEffect,useMemo,useState } from 'react';
import { confirmDialog,toast } from '../lib/ui-feedback';

// v0.7.1 — Panel peserta untuk Pretest, Evaluasi, dan Posttest (tampilan dirapikan).

const LABEL={pretest:'Pretest',posttest:'Posttest',evaluation:'Evaluasi'};

function fmtDate(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
function fmtTime(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
function keyOf(questionId,targetId){return targetId?`${questionId}::${targetId}`:questionId}
function isAnswered(v){return !(v===undefined||v===null||String(v).trim()==='')}

function draftKey(kind,moduleId){return `aptfi-${kind}-${moduleId}-draft`}
function readDraft(kind,moduleId){try{const raw=localStorage.getItem(draftKey(kind,moduleId));return raw?JSON.parse(raw):{}}catch{return {}}}
function writeDraft(kind,moduleId,answers){try{localStorage.setItem(draftKey(kind,moduleId),JSON.stringify(answers))}catch{}}
function clearDraft(kind,moduleId){try{localStorage.removeItem(draftKey(kind,moduleId))}catch{}}

export default function AssessmentParticipantPanel({kind,data,loading,refresh,token,onOpenAttendance}){
  const label=LABEL[kind]||'Assessment';
  const [showForm,setShowForm]=useState(false);

  if(loading&&!data)return <section className="participant-card"><div className="participant-loading compact"><div className="spinner"/><p>Memuat {label}...</p></div></section>;
  if(!data||data.configured===false)return <Locked icon="◷" title={`${label} belum tersedia`} text={data?.message||`Panitia belum menyiapkan ${label}.`}/>;
  if(!data.eligible)return <Locked icon="🔒" title="Belum memenuhi syarat" text={`${label} hanya tersedia untuk peserta dengan pendaftaran yang sudah terverifikasi.`}/>;
  if(data.attendance?.required&&!data.attendance?.satisfied)return <Locked icon="✓" title="Presensi terlebih dahulu" text={`Lakukan presensi ${data.attendance?.day?.title||`Hari ${data.module?.requires_day_number}`} sebelum mengerjakan ${label}.`}>
    {onOpenAttendance&&<button className="btn btn-brand-primary" onClick={onOpenAttendance}>Buka Kehadiran</button>}
  </Locked>;

  const m=data.module||{};
  const single=Number(m.max_attempts)===1;
  const attempts=data.attempts||[];

  // Modul sekali kirim (Pretest, Evaluasi) yang sudah dikirim.
  if(single&&attempts.length){
    const a=data.attempt;
    const scored=a?.percent!==null&&a?.percent!==undefined;
    return <section className="participant-card aq-done">
      <div className="aq-done-icon">✓</div>
      <div className="eyebrow brand-blue">{label}</div>
      <h2>{kind==='evaluation'?'Terima kasih atas evaluasi Anda':`${label} sudah dikirim`}</h2>
      <p>{kind==='evaluation'?'Masukan Anda sangat berarti untuk pelatihan berikutnya.':'Jawaban Anda sudah tersimpan dan tidak dapat dikirim ulang.'}</p>
      <div className="aq-done-stats">
        {scored&&<div className="aq-score"><strong>{a.percent}</strong><span>nilai</span></div>}
        {scored&&<div><span>Skor</span><strong>{a.score} / {a.max_score}</strong></div>}
        <div><span>Dikirim</span><strong>{fmtDate(a?.submitted_at)} WIB</strong></div>
      </div>
    </section>;
  }

  const closedCopy=data.state==='upcoming'?`${label} belum dibuka.`:data.state==='closed'?`Waktu ${label} sudah ditutup.`:data.state==='inactive'?`${label} belum diaktifkan panitia.`:data.attemptsLeft===0?`Batas pengerjaan ${label} sudah tercapai.`:`Soal ${label} belum tersedia.`;

  const summary=attempts.length>0&&!single?<PosttestSummary label={label} data={data} canRetry={data.canStart&&!showForm} closedCopy={closedCopy} onRetry={()=>setShowForm(true)}/>:null;

  if(!data.canStart)return <>{summary}{!summary&&<Locked icon="◷" title={`${label} belum dapat dikerjakan`} text={closedCopy}>
    {m.open_at&&<p className="aq-schedule">Jadwal {fmtDate(m.open_at)} – {fmtTime(m.close_at)} WIB</p>}
    <button className="btn btn-secondary" onClick={refresh}>Periksa kembali</button>
  </Locked>}</>;

  const formVisible=attempts.length===0||showForm;
  return <>
    {summary}
    {formVisible&&<AssessmentForm kind={kind} label={label} data={data} token={token}
      onDone={async(message)=>{toast.success(message);setShowForm(false);await refresh()}}
      onCancel={attempts.length?()=>setShowForm(false):null}/>}
  </>;
}

function Locked({icon,title,text,children}){
  return <section className="participant-card pretest-participant locked"><div className="access-lock">{icon}</div><h2>{title}</h2><p>{text}</p>{children}</section>;
}

function PosttestSummary({label,data,canRetry,closedCopy,onRetry}){
  const m=data.module||{},attempts=data.attempts||[],best=data.best;
  const pass=m.pass_percent;
  const bestId=best?.id;
  return <section className={`participant-card aq-summary ${data.passed===true?'passed':data.passed===false?'not-passed':''}`}>
    <div className="aq-summary-main">
      <div className="aq-score big"><strong>{best?.percent??'—'}</strong><span>terbaik</span></div>
      <div className="aq-summary-text">
        <div className="eyebrow brand-blue">{label}</div>
        <h2>{data.passed===true?'Selamat, Anda lulus':data.passed===false?'Belum mencapai batas lulus':'Hasil Anda'}</h2>
        <p>{pass!==null&&pass!==undefined?`Batas lulus ${pass}. `:''}Nilai terbaik dari {attempts.length} attempt yang digunakan.</p>
        {data.passed!==null&&data.passed!==undefined&&<span className={`status ${data.passed?'status-ok':'status-pending'}`}>{data.passed?'Lulus':'Belum lulus'}</span>}
      </div>
    </div>
    <div className="aq-attempts">
      <div className="aq-attempts-head"><strong>Riwayat attempt</strong>{data.attemptsLeft!==null&&data.attemptsLeft!==undefined?<small>sisa {data.attemptsLeft}</small>:<small>tanpa batas selama jadwal dibuka</small>}</div>
      <ol>{attempts.map(a=><li key={a.id} className={a.id===bestId?'best':''}>
        <span>#{a.attempt_no}</span>
        <div className="aq-bar"><i style={{width:`${Math.max(0,Math.min(100,a.percent||0))}%`}}/></div>
        <strong>{a.percent!==null&&a.percent!==undefined?a.percent:'—'}</strong>
        <small>{fmtTime(a.submitted_at)}{a.id===bestId?' · terbaik':''}</small>
      </li>)}</ol>
    </div>
    {canRetry&&<button className="btn btn-brand-primary aq-wide" onClick={onRetry}>Kerjakan {label} lagi</button>}
    {!data.canStart&&<p className="aq-note">{closedCopy}</p>}
  </section>;
}

function AssessmentForm({kind,label,data,token,onDone,onCancel}){
  const m=data.module;
  const questions=data.questions||[],targets=data.targets||[];
  const units=useMemo(()=>targets.length?targets.flatMap(t=>questions.map(q=>({q,t}))):questions.map(q=>({q,t:null})),[questions,targets]);
  const [answers,setAnswers]=useState(()=>({...(data.prefill||{}),...readDraft(kind,m.id)}));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[step,setStep]=useState(0);

  useEffect(()=>{writeDraft(kind,m.id,answers)},[answers,kind,m.id]);

  const required=units.filter(u=>u.q.required);
  const answered=required.filter(u=>isAnswered(answers[keyOf(u.q.id,u.t?.id)])).length;
  const pct=required.length?Math.round(answered/required.length*100):100;
  const set=(k,v)=>{setAnswers(x=>({...x,[k]:v}));if(error)setError('')};
  const targetDone=t=>questions.every(q=>!q.required||isAnswered(answers[keyOf(q.id,t.id)]));

  function focusUnit(u){
    if(u.t){const idx=targets.findIndex(t=>t.id===u.t.id);if(idx>=0)setStep(idx)}
    setTimeout(()=>document.getElementById(`aq-${keyOf(u.q.id,u.t?.id)}`)?.scrollIntoView({behavior:'smooth',block:'center'}),60);
  }

  async function submit(e){
    e?.preventDefault?.();
    const missing=required.find(u=>!isAnswered(answers[keyOf(u.q.id,u.t?.id)]));
    if(missing){
      const n=questions.indexOf(missing.q)+1;
      setError(`Pertanyaan nomor ${n}${missing.t?` untuk ${missing.t.name}`:''} belum dijawab.`);
      focusUnit(missing);
      return;
    }
    const confirmText=kind==='posttest'?'Nilai terbaik dari semua attempt yang akan digunakan. Anda masih bisa mengulang selama jadwal dibuka.':'Setelah dikirim, jawaban tidak dapat diubah.';
    if(!await confirmDialog({title:`Kirim ${label}?`,description:confirmText,confirmLabel:`Ya, kirim ${label}`}))return;
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
      if(kind==='evaluation')message='Evaluasi berhasil dikirim.';
      else if(j.attempt?.percent!==null&&j.attempt?.percent!==undefined){
        message=`${label} berhasil dikirim. Nilai attempt ini ${j.attempt.percent}.`;
        if(kind==='posttest'&&j.best)message+=` Nilai terbaik ${j.best.percent}${j.passed===true?' — Lulus.':j.passed===false?' — belum mencapai batas lulus.':'.'}`;
      }
      await onDone(message);
    }catch(err){setError(err.message)}
    finally{setBusy(false)}
  }

  const header=<div className="aq-head">
    <div>
      <div className="eyebrow brand-blue">{label}{data.testAccount&&<span className="status status-info">TEST</span>}</div>
      <h2>{m.title}</h2>
      {m.description&&<p>{m.description}</p>}
    </div>
    <div className="aq-meta">
      {m.close_at&&<span>⏱ Ditutup {fmtTime(m.close_at)} WIB</span>}
      <span>{targets.length?`${targets.length} pemateri × ${questions.length} pertanyaan`:`${questions.length} pertanyaan`}</span>
      <span>💾 Jawaban tersimpan otomatis</span>
    </div>
    {data.testAccount&&<div className="alert alert-info">Mode TEST: jadwal dilewati, hasil tidak masuk statistik resmi.</div>}
  </div>;

  const footer=<div className="aq-footer">
    <div className="aq-progress"><div><i style={{width:`${pct}%`}}/></div><span>{answered}/{required.length} wajib terjawab</span></div>
    {error&&<div className="aq-error">{error}</div>}
  </div>;

  // Evaluasi: satu pemateri per langkah.
  if(targets.length){
    const t=targets[Math.min(step,targets.length-1)];
    const last=step>=targets.length-1;
    return <form className="participant-card aq-form" onSubmit={submit} noValidate>
      {header}
      <nav className="aq-steps" aria-label="Pemateri">{targets.map((x,i)=><button type="button" key={x.id} className={`${i===step?'current':''} ${targetDone(x)?'done':''}`} onClick={()=>setStep(i)} title={x.name}><b>{targetDone(x)?'✓':i+1}</b></button>)}</nav>
      <section className="aq-target">
        <div className="aq-target-head"><span>Pemateri {step+1} dari {targets.length}</span><h3>{t.name}</h3>{t.affiliation&&<small>{t.affiliation}</small>}{t.topic&&<p>{t.topic}</p>}</div>
        <div className="aq-list compact">{questions.map((q,i)=><QuestionItem key={keyOf(q.id,t.id)} q={q} index={i} k={keyOf(q.id,t.id)} value={answers[keyOf(q.id,t.id)]} onChange={set}/>)}</div>
      </section>
      {footer}
      <div className="aq-actions">
        <button type="button" className="btn btn-secondary" disabled={step===0||busy} onClick={()=>{setStep(s=>Math.max(0,s-1));window.scrollTo?.({top:0,behavior:'smooth'})}}>← Sebelumnya</button>
        {!last&&<button type="button" className="btn btn-brand-primary" disabled={busy} onClick={()=>{setStep(s=>Math.min(targets.length-1,s+1));window.scrollTo?.({top:0,behavior:'smooth'})}}>Berikutnya →</button>}
        {last&&<button type="submit" className="btn btn-brand-primary" disabled={busy}>{busy?'Mengirim...':`Kirim ${label}`}</button>}
      </div>
    </form>;
  }

  // Pretest / Posttest: daftar soal per kelompok.
  const groups=[];
  questions.forEach((q,i)=>{const g=groups[groups.length-1];if(g&&g.section===(q.section||null))g.items.push({q,i});else groups.push({section:q.section||null,items:[{q,i}]})});

  return <form className="participant-card aq-form" onSubmit={submit} noValidate>
    {header}
    {groups.map((g,gi)=><section key={gi} className="aq-group">
      {g.section&&<h3 className="aq-group-title">{g.section}<small>{g.items.length} pertanyaan</small></h3>}
      <div className="aq-list">{g.items.map(({q,i})=><QuestionItem key={q.id} q={q} index={i} k={q.id} value={answers[q.id]} onChange={set}/>)}</div>
    </section>)}
    {footer}
    <div className="aq-actions sticky">
      {onCancel&&<button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Batal</button>}
      <button type="submit" className="btn btn-brand-primary" disabled={busy}>{busy?'Mengirim...':`Kirim ${label}`}</button>
    </div>
  </form>;
}

function QuestionItem({q,index,k,value,onChange}){
  const done=isAnswered(value);
  const opts=q.options||[];
  const inline=q.question_type==='single_choice'&&opts.length<=4&&opts.every(o=>String(o.option_text||'').length<=24);
  return <div id={`aq-${k}`} className={`aq-item ${done?'answered':''}`} role="group" aria-labelledby={`aq-${k}-label`}>
    <div className="aq-item-head">
      <span className="aq-num">{done?'✓':index+1}</span>
      <p id={`aq-${k}-label`}>{q.question_text}{!q.required&&<em>opsional</em>}</p>
    </div>
    {q.question_type==='single_choice'&&<div className={`aq-choices ${inline?'inline':''}`} style={inline?{gridTemplateColumns:`repeat(${opts.length},minmax(0,1fr))`}:undefined}>
      {opts.map(o=><label key={o.id} className={value===o.id?'selected':''}><input type="radio" name={k} value={o.id} checked={value===o.id} onChange={()=>onChange(k,o.id)}/><span>{o.option_text}</span></label>)}
    </div>}
    {q.question_type==='likert'&&<LikertInput name={k} q={q} value={value} onChange={v=>onChange(k,v)}/>}
    {q.question_type==='text'&&<textarea className="aq-textarea" rows="3" maxLength={4000} value={value||''} onChange={e=>onChange(k,e.target.value)} placeholder="Tulis jawaban Anda..."/>}
  </div>;
}

function LikertInput({name,q,value,onChange}){
  const min=Number(q.scale_min??1),max=Number(q.scale_max??5);
  const values=[];for(let v=min;v<=max;v++)values.push(v);
  return <div className="aq-likert">
    <div className="aq-likert-scale" role="radiogroup" style={{gridTemplateColumns:`repeat(${values.length},minmax(0,1fr))`}}>
      {values.map(v=><label key={v} className={Number(value)===v?'selected':''}><input type="radio" name={name} value={v} checked={Number(value)===v} onChange={()=>onChange(v)}/><span>{v}</span></label>)}
    </div>
    {(q.scale_min_label||q.scale_max_label)&&<div className="aq-likert-labels"><small>{q.scale_min_label||''}</small><small>{q.scale_max_label||''}</small></div>}
  </div>;
}

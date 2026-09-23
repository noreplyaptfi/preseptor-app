'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

function normalize(value=''){
  return String(value).toLocaleLowerCase('id-ID').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim();
}

export default function UniversityCombobox({name='university',universities=[],required=false,placeholder='Cari nama perguruan tinggi',defaultValue=''}){
  const rootRef=useRef(null);
  const inputRef=useRef(null);
  const [query,setQuery]=useState(defaultValue||'');
  const [open,setOpen]=useState(false);
  const [activeIndex,setActiveIndex]=useState(-1);

  const filtered=useMemo(()=>{
    const q=normalize(query);
    const base=q?universities.filter(item=>normalize(item).includes(q)):universities;
    return base.slice(0,80);
  },[query,universities]);

  useEffect(()=>{setQuery(defaultValue||'')},[defaultValue]);

  useEffect(()=>{
    function onPointerDown(event){
      if(rootRef.current&&!rootRef.current.contains(event.target)){
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown',onPointerDown);
    return()=>document.removeEventListener('pointerdown',onPointerDown);
  },[]);

  function choose(value){
    setQuery(value);
    setOpen(false);
    setActiveIndex(-1);
    requestAnimationFrame(()=>inputRef.current?.focus());
  }

  function onKeyDown(event){
    if(!open&&(event.key==='ArrowDown'||event.key==='Enter')){
      setOpen(true);
      return;
    }
    if(event.key==='ArrowDown'){
      event.preventDefault();
      setActiveIndex(i=>Math.min(i+1,filtered.length-1));
    }else if(event.key==='ArrowUp'){
      event.preventDefault();
      setActiveIndex(i=>Math.max(i-1,0));
    }else if(event.key==='Enter'&&open&&activeIndex>=0&&filtered[activeIndex]){
      event.preventDefault();
      choose(filtered[activeIndex]);
    }else if(event.key==='Escape'){
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return <div className="university-combobox" ref={rootRef}>
    <div className={`university-combobox-control ${open?'is-open':''}`}>
      <span className="university-search-icon" aria-hidden="true">⌕</span>
      <input
        ref={inputRef}
        name={name}
        required={required}
        value={query}
        placeholder={placeholder}
        autoComplete="organization"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${name}-listbox`}
        aria-autocomplete="list"
        onFocus={()=>{setOpen(true);setActiveIndex(0)}}
        onClick={()=>setOpen(true)}
        onChange={event=>{setQuery(event.target.value);setOpen(true);setActiveIndex(0)}}
        onKeyDown={onKeyDown}
      />
      {query?<button type="button" className="university-clear" aria-label="Hapus pilihan" onClick={()=>{setQuery('');setOpen(true);setActiveIndex(0);inputRef.current?.focus()}}>×</button>:<button type="button" className="university-toggle" aria-label={open?'Tutup daftar':'Buka daftar'} onClick={()=>{setOpen(v=>!v);setActiveIndex(0);inputRef.current?.focus()}}>{open?'⌃':'⌄'}</button>}
    </div>
    {open&&<div className="university-options" id={`${name}-listbox`} role="listbox">
      <div className="university-options-head"><strong>{query?'Hasil pencarian':'Pilih perguruan tinggi'}</strong><span>{filtered.length}{universities.length>80&&!query?'+':''} pilihan</span></div>
      <div className="university-options-scroll">
        {filtered.length?filtered.map((item,index)=><button
          type="button"
          role="option"
          aria-selected={query===item}
          className={`${index===activeIndex?'is-active':''} ${query===item?'is-selected':''}`}
          key={item}
          onMouseEnter={()=>setActiveIndex(index)}
          onPointerDown={event=>event.preventDefault()}
          onClick={()=>choose(item)}
        ><span>{item}</span>{query===item&&<em>✓</em>}</button>):<div className="university-empty"><strong>Nama tidak ditemukan</strong><span>Coba gunakan kata kunci yang lebih singkat.</span></div>}
      </div>
      <div className="university-options-foot">Ketik sebagian nama kampus untuk mempersempit hasil.</div>
    </div>}
  </div>
}

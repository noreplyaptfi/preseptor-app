'use client';

// v0.8.2 — Pemindai QR dari kamera di dalam aplikasi (tanpa aplikasi kamera bawaan HP).
// - Memakai BarcodeDetector bawaan browser bila tersedia (Chrome Android, cepat & hemat baterai).
// - Selain itu memakai jsQR (iPhone/Safari, browser desktop). jsQR dimuat hanya saat dibutuhkan.

const SCAN_INTERVAL_MS=140;
const MAX_SIDE=720;

export function cameraSupported(){
  return typeof navigator!=='undefined'&&!!navigator.mediaDevices?.getUserMedia;
}

export function cameraErrorMessage(err){
  const name=err?.name||'';
  if(name==='NotAllowedError'||name==='SecurityError')return 'Izin kamera ditolak. Buka pengaturan situs di browser (ikon gembok di samping alamat), izinkan Kamera, lalu muat ulang halaman.';
  if(name==='NotFoundError'||name==='OverconstrainedError')return 'Kamera tidak ditemukan di perangkat ini.';
  if(name==='NotReadableError'||name==='AbortError')return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera/Zoom lalu coba lagi.';
  if(typeof window!=='undefined'&&window.isSecureContext===false)return 'Kamera hanya dapat dipakai di alamat https.';
  if(name==='NotSupportedError'||name==='TypeError')return 'Browser ini tidak mendukung kamera di halaman web. Buka halaman ini di Chrome/Safari (bukan dari dalam WhatsApp), atau gunakan aplikasi kamera HP / input manual.';
  return 'Kamera tidak dapat dibuka. Gunakan input manual atau aplikasi kamera HP.';
}

async function nativeDetector(){
  try{
    if(typeof window==='undefined'||!('BarcodeDetector' in window))return null;
    const formats=await window.BarcodeDetector.getSupportedFormats?.();
    if(Array.isArray(formats)&&!formats.includes('qr_code'))return null;
    const detector=new window.BarcodeDetector({formats:['qr_code']});
    return async source=>{
      const found=await detector.detect(source);
      return found?.[0]?.rawValue||'';
    };
  }catch{return null}
}

async function jsqrDetector(){
  const mod=await import('jsqr');
  const jsQR=mod.default||mod;
  const canvas=document.createElement('canvas');
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  return async video=>{
    const vw=video.videoWidth,vh=video.videoHeight;
    if(!vw||!vh)return '';
    const scale=Math.min(1,MAX_SIDE/Math.max(vw,vh));
    const w=Math.round(vw*scale),h=Math.round(vh*scale);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    ctx.drawImage(video,0,0,w,h);
    const img=ctx.getImageData(0,0,w,h);
    const code=jsQR(img.data,w,h,{inversionAttempts:'dontInvert'});
    return code?.data||'';
  };
}

// Membuat pemindai untuk elemen <video>. onResult(text) dipanggil setiap QR terbaca
// (pemanggil bertanggung jawab menahan/melanjutkan lewat pause()/resume()).
export function createQrScanner(video,{onResult,onStateChange}={}){
  let stream=null,detect=null,timer=null,paused=false,running=false,busy=false,engine='';
  let facing='environment';

  function setState(s,extra){onStateChange?.({state:s,engine,facing,...extra})}

  async function loop(){
    if(!running)return;
    if(!paused&&!busy&&video.readyState>=2){
      busy=true;
      try{
        const text=await detect(video);
        if(text&&running&&!paused)onResult?.(text);
      }catch{}
      busy=false;
    }
    timer=setTimeout(loop,SCAN_INTERVAL_MS);
  }

  async function openStream(){
    const tries=[
      {video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},audio:false},
      {video:{facingMode:facing},audio:false},
      {video:true,audio:false}
    ];
    let lastErr;
    for(const c of tries){
      try{return await navigator.mediaDevices.getUserMedia(c)}catch(e){lastErr=e;if(e?.name==='NotAllowedError'||e?.name==='SecurityError')break}
    }
    throw lastErr;
  }

  async function start(){
    if(running)return;
    if(!cameraSupported())throw Object.assign(new Error('unsupported'),{name:'NotSupportedError'});
    setState('starting');
    stream=await openStream();
    video.setAttribute('playsinline','');
    video.muted=true;
    video.srcObject=stream;
    try{await video.play()}catch{}
    if(!detect){
      detect=await nativeDetector();
      engine=detect?'native':'jsqr';
      if(!detect)detect=await jsqrDetector();
    }
    running=true;paused=false;
    setState('scanning');
    loop();
  }

  function stop(){
    running=false;
    clearTimeout(timer);timer=null;
    if(stream){for(const t of stream.getTracks())t.stop()}
    stream=null;
    try{video.pause()}catch{}
    video.srcObject=null;
    setState('idle');
  }

  async function switchCamera(){
    facing=facing==='environment'?'user':'environment';
    if(running){stop();await start()}
  }

  return {
    start,stop,switchCamera,
    pause(){paused=true;if(running)setState('paused')},
    resume(){paused=false;if(running)setState('scanning')},
    get running(){return running},
    get engine(){return engine},
    get facing(){return facing}
  };
}

// Umpan balik singkat saat QR terbaca. AudioContext dibuat dari klik pengguna (tombol "Buka kamera").
export function createFeedback(){
  let ctx=null;
  return {
    unlock(){
      try{
        const AC=window.AudioContext||window.webkitAudioContext;
        if(AC&&!ctx)ctx=new AC();
        ctx?.resume?.();
      }catch{}
    },
    play(kind){
      try{navigator.vibrate?.(kind==='ok'?80:kind==='warn'?[60,60,60]:[160,80,160])}catch{}
      try{
        if(!ctx)return;
        const tones=kind==='ok'?[[880,0,.12]]:kind==='warn'?[[660,0,.09],[660,.14,.09]]:[[220,0,.18],[220,.24,.18]];
        for(const [freq,at,dur] of tones){
          const o=ctx.createOscillator(),g=ctx.createGain();
          o.type='sine';o.frequency.value=freq;
          g.gain.setValueAtTime(.0001,ctx.currentTime+at);
          g.gain.exponentialRampToValueAtTime(.25,ctx.currentTime+at+.01);
          g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+at+dur);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime+at);o.stop(ctx.currentTime+at+dur+.02);
        }
      }catch{}
    }
  };
}

'use client';
import { useEffect, useState } from 'react';
export default function MaintenanceCountdown({ until }) {
  const calc = () => Math.max(0, new Date(until).getTime() - Date.now());
  const [left, setLeft] = useState(calc());
  useEffect(() => { const t=setInterval(()=>setLeft(calc()),1000); return()=>clearInterval(t); }, [until]);
  const total=Math.floor(left/1000), days=Math.floor(total/86400), hours=Math.floor((total%86400)/3600), minutes=Math.floor((total%3600)/60), seconds=total%60;
  const pad=n=>String(n).padStart(2,'0');
  return <div className="countdown"><div><strong>{pad(days)}</strong><small>hari</small></div><div><strong>{pad(hours)}</strong><small>jam</small></div><div><strong>{pad(minutes)}</strong><small>menit</small></div><div><strong>{pad(seconds)}</strong><small>detik</small></div></div>;
}

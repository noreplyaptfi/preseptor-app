'use client';
import { usePathname } from 'next/navigation';

export default function SupportWhatsApp(){
  const pathname=usePathname();
  if(pathname?.startsWith('/admin')) return null;
  const text=encodeURIComponent('Halo Admin APTFI, saya membutuhkan bantuan terkait pendaftaran Pelatihan Preseptor 2026.');
  return <a className="support-whatsapp" href={`https://wa.me/6288238935083?text=${text}`} target="_blank" rel="noreferrer" aria-label="Hubungi Admin APTFI melalui WhatsApp">
    <span className="support-whatsapp-icon">WA</span><span className="support-whatsapp-label"><strong>Butuh bantuan?</strong><small>WhatsApp Admin</small></span>
  </a>;
}

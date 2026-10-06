import './globals.css';
import { Lato } from 'next/font/google';
import SupportWhatsApp from '../components/SupportWhatsApp';
import UiFeedbackHost from '../components/UiFeedbackHost';

const lato=Lato({
  subsets:['latin'],
  weight:['400','700','900'],
  display:'swap',
  variable:'--font-lato'
});

export const metadata={
  title:'Pelatihan Preseptor APTFI 2026',
  description:'Pendaftaran Pelatihan Preseptor Asosiasi Pendidikan Tinggi Farmasi Indonesia (APTFI).',
  robots:{index:true,follow:true}
};

// v0.7.3 — warna bar browser HP mengikuti navy APTFI. Favicon dari app/icon.png & app/apple-icon.png.
export const viewport={themeColor:'#11185d'};

export default function RootLayout({children}){
  return <html lang="id"><body className={lato.variable}>{children}<SupportWhatsApp/><UiFeedbackHost/></body></html>;
}

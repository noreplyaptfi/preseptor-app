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

export default function RootLayout({children}){
  return <html lang="id"><body className={lato.variable}>{children}<SupportWhatsApp/><UiFeedbackHost/></body></html>;
}

// v0.7.0 — Bank soal standar APTFI Pelatihan Preseptor 2026.
// Sumber:
//   - Pretest_Pelatihan_Preseptor_APTFI (Google Forms + kunci jawaban)
//   - Posttest_Pelatihan_Preseptor_APTFI.docx (kunci = highlight kuning)
//   - Kuesioner_Kepuasan_Pelatihan_Preseptor_APTFI.docx
//   - Rundown updated 28-09-26 (daftar pemateri)
// Data peserta (email, nama, tempat praktik, lama praktik, lama membimbing) TIDAK
// ditanyakan ulang karena sudah ada di data pendaftaran dan ikut di export Excel.
// Dimuat dari Admin lewat tombol "Muat bank soal standar APTFI".

const BS=(text,correct)=>({type:'single_choice',section:'Benar atau Salah',text,points:1,required:true,options:[{text:'Benar',correct:correct==='Benar'},{text:'Salah',correct:correct==='Salah'}]});
const ESSAY=(text,required=true,section='Esai')=>({type:'text',section,text,points:0,required});
const LIKERT=(text,minLabel,maxLabel)=>({type:'likert',section:'Penilaian Narasumber',text,points:0,required:true,scale_min:1,scale_max:5,scale_min_label:minLabel,scale_max_label:maxLabel});

const PRETEST=[
  {type:'single_choice',section:'Pengalaman Pelatihan',text:'Apakah Saudara pernah mengikuti pelatihan preseptor sebelumnya?',points:0,required:true,options:[{text:'Belum',correct:false},{text:'Sudah',correct:false}]},
  ESSAY('Apabila Saudara sudah pernah mengikuti pelatihan preseptor, berapa kali Saudara mengikutinya? (kosongkan bila belum pernah)',false,'Pengalaman Pelatihan'),
  BS('Preseptor secara teori adalah semua praktisi di tempat pekerjaan kefarmasian','Benar'),
  BS('Learning level dari PKPA seharusnya adalah berada pada level 2','Salah'),
  BS('Pedagogi adalah pendidikan yang mengacu pada proses pembelajaran kepada peserta didik','Benar'),
  BS('Membantu pekerjaan preseptor adalah tujuan dari praktek kerja profesi apoteker','Salah'),
  BS('Memberikan ruang belajar yang seluas luasnya adalah peran preseptor sebagai edukator','Benar'),
  BS('Interprofesional Education diikuti oleh satu program studi dari beberapa tingkatan','Salah'),
  BS('Menciptakan lingkungan yang positif adalah peran preseptor sebagai fasilitator','Benar'),
  BS('Open Mind adalah karakter positif dari generasi Z','Benar'),
  BS('Model pembimbingan klinis yang menyediakan dukungan pembelajaran dari senior ke junior adalah model apprenticeship','Benar'),
  BS('Mempraktekkan profesi sesuai etika legal adalah peran preseptor sebagai panutan','Benar'),
  BS('Model "near peer teaching" adalah ketika dua atau lebih praktisi berbagi tanggung jawab dalam proses pembimbingan maupun evaluasi terhadap mahasiswa','Benar'),
  BS('Menilai kemampuan komunikasi mahasiswa hanya bisa dinilai dari verbal','Salah'),
  BS('Ekspresi dan intonasi adalah bentuk komunikasi non verbal','Benar'),
  BS('Asertif adalah kemampuan menyampaikan pendapat','Benar'),
  BS('Stereotype adalah pendapat bahwa semua orang memiliki karakter yang sama','Benar'),
  ESSAY('Tuliskan tujuan Saudara dalam mengikuti pelatihan preseptor ini, selain kewajiban dari Institusi Pendidikan penyelenggara Program Studi Profesi Apoteker.'),
  ESSAY('Untuk Saudara preseptor; aspek pengetahuan, sikap dan keterampilan apa yang masih harus dibekali kepada preseptee sebelum PKPA oleh PSPA sehingga tercapai kompetensi yang diharapkan sesuai standar profesi?')
];

const POSTTEST=[
  BS('Preseptor secara bahasa diartikan sebagai orang yang mengajar dan memberikan bimbingan','Benar'),
  BS('Mentor adalah seseorang yang berperan memberi jawaban, masukan atau training khusus','Benar'),
  BS('Pedagogi adalah pendidikan yang mengacu pada proses pembelajaran kepada peserta didik','Benar'),
  BS('Memperkenalkan lingkungan kerja adalah tujuan dari praktek kerja profesi apoteker','Benar'),
  BS('Memberikan ruang belajar yang seluas luasnya adalah peran preseptor sebagai edukator','Benar'),
  BS('ROI adalah indikator efisiensi dalam pengelolaan obat','Benar'),
  BS('Menciptakan lingkungan yang positif adalah peran preseptor sebagai fasilitator','Benar'),
  BS('Open Mind adalah karakter positif dari generasi Z','Benar'),
  BS('Model pembimbingan klinis yang menyediakan dukungan pembelajaran dari senior ke junior adalah model apprenticeship','Benar'),
  BS('Mempraktekkan profesi sesuai etika legal adalah peran preseptor sebagai panutan','Benar'),
  BS('Model near peer teaching adalah ketika dua atau lebih praktisi berbagi tanggung jawab dalam proses pembimbingan maupun evaluasi terhadap mahasiswa','Benar'),
  BS('Menganggukkan kepala adalah salah satu contoh verbal message','Salah'),
  BS('Ruang konseling yang panas merupakan salah satu kendala pelaksanaan konseling','Benar'),
  BS('Asertif adalah kemampuan menyampaikan pendapat','Benar'),
  BS('Stereotype adalah pendapat bahwa semua orang memiliki karakter yang sama','Benar'),
  ESSAY('Setelah mengikuti pelatihan ini, apakah tujuan yang anda tuliskan sebelum pelatihan dimulai, sudah tercapai? Jika belum, mohon dituliskan penjelasannya'),
  ESSAY('Dengan perkembangan teknologi dan praktek kesehatan, apa sajakah kompetensi apoteker yang belum atau perlu dikembangkan untuk dituangkan dalam kurikulum apoteker?'),
  ESSAY('Untuk kelancaran Bapak Ibu sebagai preseptor, apa yang perlu dibekali kepada mahasiswa PKPA oleh prodi, baik teori dan keterampilannya?'),
  ESSAY('Tuliskan saran untuk kegiatan ini, terima kasih',false,'Saran')
];

const EVALUATION=[
  LIKERT('Narasumber menyampaikan materi dengan baik','Sangat kurang','Sangat baik'),
  LIKERT('Narasumber menguasai materi yang disampaikan dengan baik','Sangat tidak menguasai','Sangat menguasai'),
  LIKERT('Narasumber berkomunikasi dengan peserta pelatihan dengan baik','Sangat kurang','Sangat baik'),
  LIKERT('Narasumber menjawab semua pertanyaan peserta pelatihan dengan baik','Sangat kurang','Sangat baik'),
  ESSAY('Saran',false,'Saran')
];

// Satu evaluasi per pemateri. Pemateri dengan 2 topik dievaluasi sekali.
// Topik 7 (Sharing Experiences, PP APTFI) tidak dimasukkan; dapat ditambah dari Admin.
const EVALUATION_TARGETS=[
  {name:'Prof. Dr. apt. Yandi Syukri, M.Si.',affiliation:'Universitas Islam Indonesia',topic:'Topik 1: Pedagogik dalam pendidikan profesi apoteker · Topik 2: Kasus 1: Pedagogik dan peran preseptor'},
  {name:'Dr. apt. Iis Wahyuningsih, M.Si.',affiliation:'Universitas Ahmad Dahlan',topic:'Topik 3: Peran Preseptor sebagai Role Model dan Edukator'},
  {name:'Prof. Dr. apt. Satibi, M.Si.',affiliation:'Universitas Gadjah Mada',topic:'Topik 4: Keterampilan Manajemen'},
  {name:'Dr. apt. Lusy Noviani, MM',affiliation:'Kepala Instalasi Farmasi, RS Atma Jaya',topic:'Topik 5: Peran Preseptor sebagai Fasilitator dan Evaluator'},
  {name:'Prof. apt. Umi Athiyah, M.Si.',affiliation:'Universitas Airlangga',topic:'Topik 6: Komunikasi Interpersonal dan Manajemen Konflik'},
  {name:'Prof. Surakit Nathisuwan',affiliation:'Dean Faculty of Pharmacy, Mahidol University',topic:'Topik 8: Interprofessional Education and Interprofessional Collaboration · Topik 9: Kasus 2: Komunikasi interpersonal, IPE dan manajemen konflik'}
];

export const STANDARD_BANKS={
  pretest:{questions:PRETEST,targets:[]},
  posttest:{questions:POSTTEST,targets:[]},
  evaluation:{questions:EVALUATION,targets:EVALUATION_TARGETS}
};

export function standardBank(kind){
  return STANDARD_BANKS[kind]||null;
}

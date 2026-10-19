/**
 * seed.js - Data contoh (dummy) titik rawan banjir rob & abrasi
 * di pesisir Kota Bengkulu.
 *
 * Catatan: koordinat dan angka bersifat perkiraan untuk keperluan
 * praktikum/demo, bukan data resmi instansi.
 *
 * Jalankan `npm run seed` untuk menulis ulang data contoh.
 */
import { ensureDirs, hitung, newId, pool, write } from './db.js';

const sumber = 'Data contoh (dummy) praktikum Web GIS';

/** @typedef {'rob'|'abrasi'} Jenis */

const SEED = [
  // ================= BANJIR ROB =================
  {
    nama: 'Kelurahan Malabero',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Tinggi',
    lat: -3.7865,
    lng: 102.2585,
    tinggiRob: 92,
    luasTerdampakHa: 14.5,
    kkTerdampak: 780,
    tahun: 2024,
    deskripsi:
      'Permukiman padat dekat Benteng Marlborough. Rob masuk hingga 500 m ke darat saat pasang purnama dan sering menggenangi ruas Jalan Malabero.',
  },
  {
    nama: 'Kelurahan Pasar Bengkulu',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Tinggi',
    lat: -3.7883,
    lng: 102.2601,
    tinggiRob: 88,
    luasTerdampakHa: 11.2,
    kkTerdampak: 640,
    tahun: 2024,
    deskripsi:
      'Area pasar dan permukiman tepi pantai. Aktivitas ekonomi terhenti saat rob datang pada September-Februari.',
  },
  {
    nama: 'Kelurahan Tengah Padang',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Sedang',
    lat: -3.7908,
    lng: 102.2532,
    tinggiRob: 64,
    luasTerdampakHa: 8.4,
    kkTerdampak: 410,
    tahun: 2024,
    deskripsi:
      'Genangan rob terutama di gang-gang permukiman warga di belakang garis pantai Tapak Paderi.',
  },
  {
    nama: 'Kelurahan Berkas',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Sedang',
    lat: -3.7858,
    lng: 102.2648,
    tinggiRob: 58,
    luasTerdampakHa: 7.1,
    kkTerdampak: 355,
    tahun: 2023,
    deskripsi:
      'Rob menggenangi jalan lingkungan dan pekarangan rumah warga selama 2-4 jam per kejadian.',
  },
  {
    nama: 'Kelurahan Jitra',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Rendah',
    lat: -3.787,
    lng: 102.2622,
    tinggiRob: 41,
    luasTerdampakHa: 5.3,
    kkTerdampak: 210,
    tahun: 2024,
    deskripsi:
      'Genangan tipis di saluran drainase dan halaman rumah; belum sampai masuk ke dalam bangunan.',
  },
  {
    nama: 'Kelurahan Kebun Keling',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Sedang',
    lat: -3.7916,
    lng: 102.25,
    tinggiRob: 62,
    luasTerdampakHa: 6.8,
    kkTerdampak: 298,
    tahun: 2023,
    deskripsi:
      'Hujan bersamaan pasang laut menyebabkan banjir gabungan (rob + luapan drainase kota).',
  },
  {
    nama: 'Kelurahan Penurunan',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Tinggi',
    lat: -3.7892,
    lng: 102.2518,
    tinggiRob: 95,
    luasTerdampakHa: 13.7,
    kkTerdampak: 720,
    tahun: 2024,
    deskripsi:
      'Titik rob terdalam di Kota Bengkulu. Air laut naik hingga 95 cm dan bertahan sampai air surut (4-6 jam).',
  },
  {
    nama: 'Kelurahan Bumi Ayu',
    kecamatan: 'Teluk Segara',
    jenis: 'rob',
    kategori: 'Rendah',
    lat: -3.7924,
    lng: 102.2468,
    tinggiRob: 38,
    luasTerdampakHa: 4.9,
    kkTerdampak: 185,
    tahun: 2023,
    deskripsi:
      'Rob hanya menggenangi jalan pantai dan area parkir wisata Pantai Panjang.',
  },
  {
    nama: 'Kelurahan Kandang Limun',
    kecamatan: 'Muara Bangkahulu',
    jenis: 'rob',
    kategori: 'Tinggi',
    lat: -3.7732,
    lng: 102.274,
    tinggiRob: 86,
    luasTerdampakHa: 12.1,
    kkTerdampak: 560,
    tahun: 2024,
    deskripsi:
      'Pertemuan air sungai dan laut; rob diperparah kiriman air Sungai Bengkulu saat hujan di hulu.',
  },
  {
    nama: 'Kelurahan Sumber Jaya',
    kecamatan: 'Kampung Melayu',
    jenis: 'rob',
    kategori: 'Sedang',
    lat: -3.7702,
    lng: 102.2778,
    tinggiRob: 60,
    luasTerdampakHa: 7.6,
    kkTerdampak: 330,
    tahun: 2024,
    deskripsi:
      'Rob menggenangi kawasan tambak dan permukiman nelayan di sekitar muara.',
  },
  {
    nama: 'Kelurahan Padang Harapan',
    kecamatan: 'Kampung Melayu',
    jenis: 'rob',
    kategori: 'Rendah',
    lat: -3.767,
    lng: 102.2808,
    tinggiRob: 36,
    luasTerdampakHa: 4.2,
    kkTerdampak: 160,
    tahun: 2023,
    deskripsi: 'Genangan rob ringan di bagian hilir drainase menuju sungai.',
  },
  {
    nama: 'Kelurahan Tanjung Jaya',
    kecamatan: 'Sungai Serut',
    jenis: 'rob',
    kategori: 'Sedang',
    lat: -3.7648,
    lng: 102.2848,
    tinggiRob: 55,
    luasTerdampakHa: 6.4,
    kkTerdampak: 275,
    tahun: 2024,
    deskripsi:
      'Rob masuk melalui saluran yang terhubung langsung ke Sungai Serut tanpa pintu air.',
  },
  {
    nama: 'Kelurahan Surabaya',
    kecamatan: 'Sungai Serut',
    jenis: 'rob',
    kategori: 'Tinggi',
    lat: -3.7618,
    lng: 102.2878,
    tinggiRob: 90,
    luasTerdampakHa: 10.8,
    kkTerdampak: 495,
    tahun: 2024,
    deskripsi:
      'Wilayah paling utara yang terdampak rob; sebagian rumah panggung warga tergenang hingga lantai.',
  },
  {
    nama: 'Kelurahan Rawa Makmur',
    kecamatan: 'Muara Bangkahulu',
    jenis: 'rob',
    kategori: 'Sedang',
    lat: -3.7622,
    lng: 102.2232,
    tinggiRob: 57,
    luasTerdampakHa: 9.1,
    kkTerdampak: 380,
    tahun: 2023,
    deskripsi:
      'Lahan rendah rawa belakang pantai; rob tertahan lama karena elevasi di bawah muka laut.',
  },

  // ================= ABRASI =================
  {
    nama: 'Pantai Panjang - Segmen Utara',
    kecamatan: 'Teluk Segara',
    jenis: 'abrasi',
    kategori: 'Tinggi',
    lat: -3.794,
    lng: 102.243,
    lajuAbrasi: 2.4,
    luasTerdampakHa: 9.6,
    kkTerdampak: 210,
    tahun: 2024,
    deskripsi:
      'Garis pantai mundur hingga 2,4 m/tahun. Beberapa pohon cemara laut tumbang di titik terdampak.',
  },
  {
    nama: 'Pantai Panjang - Segmen Selatan',
    kecamatan: 'Selebar',
    jenis: 'abrasi',
    kategori: 'Sedang',
    lat: -3.803,
    lng: 102.2335,
    lajuAbrasi: 1.6,
    luasTerdampakHa: 7.2,
    kkTerdampak: 165,
    tahun: 2024,
    deskripsi:
      'Abrasi mengancam jalur pedestrian dan warung wisata di sisi selatan pantai.',
  },
  {
    nama: 'Pantai Jakat',
    kecamatan: 'Teluk Segara',
    jenis: 'abrasi',
    kategori: 'Tinggi',
    lat: -3.7748,
    lng: 102.2702,
    lajuAbrasi: 2.8,
    luasTerdampakHa: 6.4,
    kkTerdampak: 240,
    tahun: 2024,
    deskripsi:
      'Abrasi tercepat di Kota Bengkulu akibat gelombang Samudra Hindia dan hilangnya sabuk mangrove.',
  },
  {
    nama: 'Pantai Tapak Paderi',
    kecamatan: 'Teluk Segara',
    jenis: 'abrasi',
    kategori: 'Sedang',
    lat: -3.7782,
    lng: 102.2652,
    lajuAbrasi: 1.9,
    luasTerdampakHa: 4.8,
    kkTerdampak: 150,
    tahun: 2023,
    deskripsi:
      'Ombak tinggi musim barat mengikis dinding pantai dan merusak warung kuliner pinggir laut.',
  },
  {
    nama: 'Pantai Zakat',
    kecamatan: 'Teluk Segara',
    jenis: 'abrasi',
    kategori: 'Tinggi',
    lat: -3.7722,
    lng: 102.2722,
    lajuAbrasi: 2.6,
    luasTerdampakHa: 5.5,
    kkTerdampak: 205,
    tahun: 2024,
    deskripsi:
      'Bangunan di tepi pantai berjarak < 15 m dari garis pantai; abrasi mengancam fondasi bangunan.',
  },
  {
    nama: 'Muara Sungai Bengkulu',
    kecamatan: 'Kampung Melayu',
    jenis: 'abrasi',
    kategori: 'Tinggi',
    lat: -3.7735,
    lng: 102.2735,
    lajuAbrasi: 3.1,
    luasTerdampakHa: 8.2,
    kkTerdampak: 260,
    tahun: 2024,
    deskripsi:
      'Perubahan mulut sungai dan sedimentasi; dinding pemecah gelombang mulai rusak.',
  },
  {
    nama: 'Kelurahan Betungan',
    kecamatan: 'Selebar',
    jenis: 'abrasi',
    kategori: 'Sedang',
    lat: -3.8098,
    lng: 102.238,
    lajuAbrasi: 1.4,
    luasTerdampakHa: 6.1,
    kkTerdampak: 140,
    tahun: 2023,
    deskripsi:
      'Abrasi mengancam akses jalan dan lahan pertanian warga di belakang pantai.',
  },
  {
    nama: 'Kelurahan Sumur Dewa',
    kecamatan: 'Selebar',
    jenis: 'abrasi',
    kategori: 'Rendah',
    lat: -3.8042,
    lng: 102.2452,
    lajuAbrasi: 0.9,
    luasTerdampakHa: 3.4,
    kkTerdampak: 95,
    tahun: 2023,
    deskripsi:
      'Abrasi ringan, masih tertahan oleh vegetasi cemara dan batu penahan alami.',
  },
  {
    nama: 'Kelurahan Pekan Sabtu',
    kecamatan: 'Selebar',
    jenis: 'abrasi',
    kategori: 'Sedang',
    lat: -3.7972,
    lng: 102.2402,
    lajuAbrasi: 1.7,
    luasTerdampakHa: 5.0,
    kkTerdampak: 130,
    tahun: 2024,
    deskripsi:
      'Garis pantai mundur mendekati area permakaman dan permukiman nelayan.',
  },
  {
    nama: 'Kelurahan Kampung Kelawi',
    kecamatan: 'Sungai Serut',
    jenis: 'abrasi',
    kategori: 'Rendah',
    lat: -3.7582,
    lng: 102.292,
    lajuAbrasi: 1.1,
    luasTerdampakHa: 2.8,
    kkTerdampak: 80,
    tahun: 2023,
    deskripsi:
      'Abrasi ringan di pantai berlumpur; mangrove muda ditanam warga sejak 2022.',
  },
];

/** Bangun daftar titik lengkap dengan id dan metadata. */
export function buatSeedSpots() {
  const now = new Date().toISOString();
  return SEED.map((item) => ({
    id: newId('sp'),
    tinggiRob: null,
    lajuAbrasi: null,
    terverifikasi: true,
    sumber,
    ...item,
    createdAt: now,
    updatedAt: now,
  }));
}

/* =====================================================
   Data contoh laporan warga
   ===================================================== */
const SEED_REPORTS = [
  {
    hariLalu: 2,
    jenis: 'rob',
    namaPelapor: 'Ahmad Fauzi',
    kontak: '0813-6411-2201',
    alamat: 'Jl. Malabero No. 24, RT 02',
    kecamatan: 'Teluk Segara',
    lat: -3.7866,
    lng: 102.2583,
    deskripsi:
      'Air laut naik sekitar 40 cm ke jalan sejak pukul 19.00. Sekitar 15 rumah tergenang dan akses jalan tertutup.',
    status: 'pending',
  },
  {
    hariLalu: 5,
    jenis: 'abrasi',
    namaPelapor: 'Siti Rahmawati',
    kontak: '0821-7733-9080',
    alamat: 'Pantai Jakat, belakang warung kuliner',
    kecamatan: 'Teluk Segara',
    lat: -3.7749,
    lng: 102.2701,
    deskripsi:
      'Daratan pantai terkikis sekitar 1 meter dalam sepekan terakhir. Satu warung sudah dipindahkan pemiliknya.',
    status: 'pending',
  },
  {
    hariLalu: 9,
    jenis: 'rob',
    namaPelapor: 'Budi Santoso',
    kontak: '0852-6712-4455',
    alamat: 'Kelurahan Penurunan, gang 3',
    kecamatan: 'Teluk Segara',
    lat: -3.7893,
    lng: 102.2517,
    deskripsi:
      'Rob paling parah bulan ini, air masuk ke dalam rumah sampai lantai. Warga mengungsi ke rumah kerabat.',
    status: 'pending',
  },
  {
    hariLalu: 14,
    jenis: 'abrasi',
    namaPelapor: 'Rina Marlina',
    kontak: '0813-3900-7712',
    alamat: 'Muara Sungai Bengkulu',
    kecamatan: 'Kampung Melayu',
    lat: -3.7734,
    lng: 102.2733,
    deskripsi:
      'Dinding pemecah gelombang mulai miring dan sebagian batu sudah jatuh. Perlu penanganan segera.',
    status: 'pending',
  },
  {
    hariLalu: 21,
    jenis: 'rob',
    namaPelapor: 'Hendra Gunawan',
    kontak: '0878-2211-3344',
    alamat: 'Kelurahan Surabaya, dekat dermaga',
    kecamatan: 'Sungai Serut',
    lat: -3.7619,
    lng: 102.2877,
    deskripsi:
      'Genangan rob setinggi 60 cm bertahan sekitar 4 jam. Sekitar 30 KK terdampak, sekolah dasar terpaksa diliburkan.',
    status: 'diverifikasi',
  },
  {
    hariLalu: 38,
    jenis: 'abrasi',
    namaPelapor: 'Dewi Lestari',
    kontak: '0812-7788-1200',
    alamat: 'Pantai Panjang, segmen utara',
    kecamatan: 'Teluk Segara',
    lat: -3.7941,
    lng: 102.2429,
    deskripsi:
      'Beberapa pohon cemara laut tumbang akibat abrasi. Jalur pejalan kaki retak sepanjang kurang lebih 20 meter.',
    status: 'diverifikasi',
  },
  {
    hariLalu: 62,
    jenis: 'rob',
    namaPelapor: 'Joko Prasetyo',
    kontak: '0857-1122-8899',
    alamat: 'Kelurahan Kandang Limun',
    kecamatan: 'Muara Bangkahulu',
    lat: -3.7733,
    lng: 102.2741,
    deskripsi:
      'Rob diperparah kiriman air sungai saat hujan hulu. Ketinggian air sekitar 70 cm di jalan lingkungan.',
    status: 'diverifikasi',
  },
  {
    hariLalu: 95,
    jenis: 'rob',
    namaPelapor: 'Warga Anonim',
    kontak: '-',
    alamat: '-',
    kecamatan: 'Selebar',
    lat: -3.805,
    lng: 102.24,
    deskripsi: 'Laporan tanpa lokasi jelas dan tidak dapat diverifikasi di lapangan.',
    status: 'ditolak',
  },
];

/** Ubah selisih hari menjadi tanggal ISO (YYYY-MM-DD). */
function tanggalMundur(hari) {
  const d = new Date();
  d.setDate(d.getDate() - hari);
  return d.toISOString().slice(0, 10);
}

/** Bangun daftar laporan contoh lengkap dengan id dan status. */
export function buatSeedReports() {
  return SEED_REPORTS.map((r) => {
    const tanggal = tanggalMundur(r.hariLalu);
    const createdAt = new Date(`${tanggal}T09:30:00`).toISOString();
    const updatedAt = new Date(`${tanggal}T13:00:00`).toISOString();
    const catatanAdmin =
      r.status === 'ditolak'
        ? 'Lokasi tidak jelas, tidak dapat diverifikasi.'
        : r.status === 'diverifikasi'
          ? 'Terverifikasi melalui pengecekan lapangan.'
          : '';
    return {
      id: newId('rp'),
      jenis: r.jenis,
      namaPelapor: r.namaPelapor,
      kontak: r.kontak,
      alamat: r.alamat,
      kecamatan: r.kecamatan,
      lat: r.lat,
      lng: r.lng,
      deskripsi: r.deskripsi,
      tanggal,
      foto: null,
      status: r.status,
      catatanAdmin,
      createdAt,
      updatedAt,
    };
  });
}

/** Tulis data contoh bila belum ada, atau selalu bila dipaksa. */
export async function seed({ force = false } = {}) {
  ensureDirs();
  const hasil = { spots: false, reports: false };

  if (force || (await hitung('spots')) === 0) {
    const spots = buatSeedSpots();
    await write('spots', spots);
    hasil.spots = spots.length;
  }

  if (force || (await hitung('reports')) === 0) {
    const reports = buatSeedReports();
    await write('reports', reports);
    hasil.reports = reports.length;
  }

  return hasil;
}

// Dijalankan langsung: node lib/seed.js --force
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  const hasil = await seed({ force });
  if (hasil.spots || hasil.reports) {
    console.log(`Data contoh ditulis ke database MySQL:`);
    console.log(`  - ${hasil.spots || 0} titik rawan (rob & abrasi)`);
    console.log(`  - ${hasil.reports || 0} laporan warga`);
  } else {
    console.log('Data sudah ada. Gunakan --force untuk menulis ulang.');
  }
  await pool.end(); // tutup pool koneksi agar proses selesai
}

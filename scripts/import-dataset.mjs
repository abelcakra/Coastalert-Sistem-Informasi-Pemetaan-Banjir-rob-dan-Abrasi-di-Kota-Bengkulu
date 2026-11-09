/**
 * import-dataset.mjs - Validasi & impor data/spots.json + data/reports.json.
 *
 * Contoh:
 *   node scripts/import-dataset.mjs --dry-run
 *   DB_NAME=coastalert_phase1_test node scripts/import-dataset.mjs
 *   DB_NAME=coastalert_phase1_test node scripts/import-dataset.mjs --replace --yes
 *
 * Mode --replace hanya mengganti baris aktif yang tidak ada di JSON. Baris
 * arsip dan seluruh laporan yang sudah ada tetap dipertahankan. Operasi ini
 * wajib memakai --yes dan wajib menunjuk database non-produksi, atau memakai
 * --allow-production secara sadar. Sebelum mengganti, isi tabel lama disimpan
 * ke folder backup/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bacaData } from '../lib/seed.js';
import { hitung, pool, read, transaksi, write } from '../lib/db.js';
import {
  JENIS,
  KATEGORI,
  STATUS_KOORDINAT,
  STATUS_LAPORAN,
  POLA_TANGGAL,
  normalisasiAngka as angkaAtauNull,
  normalisasiTeks as teks,
} from '../lib/normalisasi.js';
import { klasifikasiTitik } from '../lib/wilayah.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const replace = args.includes('--replace');
const yes = args.includes('--yes');
const allowProduction = args.includes('--allow-production');
const namaDb = process.env.DB_NAME || 'coastalert';
const targetProduksi = namaDb === 'coastalert';

if (dryRun && replace) {
  console.error('Pilih salah satu: --dry-run atau --replace.');
  process.exit(1);
}
if (replace && !yes) {
  console.error('Mode --replace mengubah banyak data. Jalankan dengan --replace --yes setelah backup.');
  process.exit(1);
}
if (!dryRun && targetProduksi && !allowProduction) {
  console.error(`Target database "${namaDb}" dianggap produksi.`);
  console.error('Gunakan DB_NAME=coastalert_phase1_test, atau tambahkan --allow-production secara sadar.');
  process.exit(1);
}

function normalisasiSpot(row, index) {
  const errors = [];
  const id = teks(row.id);
  const nama = teks(row.nama);
  const jenis = JENIS.includes(row.jenis) ? row.jenis : null;
  const jenisAncaman =
    teks(row.jenisAncaman) ||
    (jenis === 'rob' ? 'Banjir Rob' : jenis === 'abrasi' ? 'Abrasi' : '');
  const lat = angkaAtauNull(row.lat);
  const lng = angkaAtauNull(row.lng);
  const tanggal = teks(row.tanggal);

  if (!id) errors.push(`Baris ${index + 1}: id wajib diisi.`);
  if (!nama) errors.push(`Baris ${index + 1}: nama wajib diisi.`);
  if (!jenis) errors.push(`Baris ${index + 1}: jenis harus "rob" atau "abrasi".`);
  if (jenisAncaman.length > 100) {
    errors.push(`Baris ${index + 1}: jenisAncaman maksimal 100 karakter.`);
  }
  if (lat === null || lat < -90 || lat > 90) errors.push(`Baris ${index + 1}: latitude tidak valid.`);
  if (lng === null || lng < -180 || lng > 180) errors.push(`Baris ${index + 1}: longitude tidak valid.`);
  let statusLokasi = 'dalam';
  if (lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    const lokasi = klasifikasiTitik(lat, lng);
    if (lokasi.status === 'luar') {
      // Titik di luar batas tetap disimpan oleh database sebagai arsip.
      // Jangan menolaknya, karena menghapus/menolak berarti kehilangan data.
      statusLokasi = 'luar';
    } else if (lokasi.status === 'manual') {
      errors.push(`Baris ${index + 1}: ${lokasi.alasan || 'koordinat tidak dapat diperiksa.'}`);
    }
  }
  if (tanggal && !POLA_TANGGAL.test(tanggal)) {
    errors.push(
      `Baris ${index + 1}: tanggal harus YYYY-MM-DD atau "YYYY-MM-DD s.d. YYYY-MM-DD".`
    );
  }

  let kategori = null;
  if (row.kategori && row.kategori !== 'Belum diverifikasi') {
    if (!KATEGORI.includes(row.kategori)) {
      errors.push(`Baris ${index + 1}: kategori "${row.kategori}" tidak dikenal.`);
    } else {
      kategori = row.kategori;
    }
  }

  const statusKoordinat = STATUS_KOORDINAT.includes(row.statusKoordinat)
    ? row.statusKoordinat
    : 'perkiraan';

  const terverifikasi =
    row.terverifikasi === true ||
    row.terverifikasi === 1 ||
    row.terverifikasi === '1' ||
    row.terverifikasi === 'true' ||
    row.statusVerifikasi === 'terverifikasi';

  const now = new Date().toISOString();
  return {
    errors,
    statusLokasi,
    data: {
      id,
      nama,
      kecamatan: teks(row.kecamatan),
      jenis,
      jenisAncaman,
      kategori,
      statusKoordinat,
      lat,
      lng,
      tinggiRob: jenis === 'rob' ? angkaAtauNull(row.tinggiRob) : null,
      lajuAbrasi: jenis === 'abrasi' ? angkaAtauNull(row.lajuAbrasi) : null,
      luasTerdampakHa: angkaAtauNull(row.luasTerdampakHa),
      kkTerdampak: angkaAtauNull(row.kkTerdampak),
      tahun: angkaAtauNull(row.tahun),
      tanggal: tanggal || null,
      deskripsi: teks(row.deskripsi),
      sumber: teks(row.sumber),
      terverifikasi,
      createdAt: teks(row.createdAt) || now,
      updatedAt: teks(row.updatedAt) || now,
    },
  };
}

function normalisasiLaporan(row, index) {
  const errors = [];
  const id = teks(row.id);
  const jenis = JENIS.includes(row.jenis) ? row.jenis : null;
  const lat = angkaAtauNull(row.lat);
  const lng = angkaAtauNull(row.lng);
  if (id && !jenis) errors.push(`Laporan ${index + 1}: jenis tidak valid.`);
  if (id && (lat === null || lat < -90 || lat > 90)) {
    errors.push(`Laporan ${index + 1}: latitude tidak valid.`);
  }
  if (id && (lng === null || lng < -180 || lng > 180)) {
    errors.push(`Laporan ${index + 1}: longitude tidak valid.`);
  }
  return {
    errors,
    data: {
      ...row,
      id,
      jenis,
      lat,
      lng,
      namaPelapor: teks(row.namaPelapor),
      status: STATUS_LAPORAN.includes(row.status) ? row.status : 'pending',
    },
  };
}

function ringkas(spots) {
  const perJenis = { rob: 0, abrasi: 0 };
  const perJenisAncaman = {};
  const perKoordinat = { perkiraan: 0, referensi_lokasi: 0, terverifikasi: 0 };
  const perKategori = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  let terverifikasi = 0;

  for (const s of spots) {
    perJenis[s.jenis] += 1;
    perJenisAncaman[s.jenisAncaman] = (perJenisAncaman[s.jenisAncaman] || 0) + 1;
    perKoordinat[s.statusKoordinat] = (perKoordinat[s.statusKoordinat] || 0) + 1;
    if (s.kategori) perKategori[s.kategori] += 1;
    if (s.terverifikasi) terverifikasi += 1;
  }

  return { perJenis, perJenisAncaman, perKoordinat, perKategori, terverifikasi };
}

async function migrasiSkema() {
  const [kolom] = await pool.query("SHOW COLUMNS FROM `spots` LIKE 'statusKoordinat'");
  if (!kolom.length) {
    await pool.query(
      "ALTER TABLE `spots` ADD COLUMN `statusKoordinat` ENUM('perkiraan','referensi_lokasi','terverifikasi') NOT NULL DEFAULT 'perkiraan' AFTER `kategori`"
    );
    console.log('Skema: kolom statusKoordinat ditambahkan.');
  }
  const [kolomJenisAncaman] = await pool.query(
    "SHOW COLUMNS FROM `spots` LIKE 'jenisAncaman'"
  );
  if (!kolomJenisAncaman.length) {
    await pool.query(
      "ALTER TABLE `spots` ADD COLUMN `jenisAncaman` VARCHAR(100) NOT NULL DEFAULT '' AFTER `jenis`"
    );
    console.log('Skema: kolom jenisAncaman ditambahkan.');
  }
  await pool.query(
    "ALTER TABLE `spots` MODIFY COLUMN `kategori` ENUM('Rendah','Sedang','Tinggi') NULL DEFAULT NULL"
  );
  await pool.query(
    "ALTER TABLE `spots` MODIFY COLUMN `terverifikasi` TINYINT(1) NOT NULL DEFAULT 0"
  );
  const [kolomTanggal] = await pool.query("SHOW COLUMNS FROM `spots` LIKE 'tanggal'");
  if (!kolomTanggal.length) {
    await pool.query("ALTER TABLE `spots` ADD COLUMN `tanggal` VARCHAR(40) NULL AFTER `tahun`");
    console.log('Skema: kolom tanggal ditambahkan.');
  }
}

function simpanBackup(spots, reports) {
  const folder = path.join(ROOT, 'backup', `dataset-import-${Date.now()}`);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, 'spots-lama.json'), JSON.stringify(spots, null, 2));
  fs.writeFileSync(path.join(folder, 'reports-lama.json'), JSON.stringify(reports, null, 2));
  return folder;
}

async function main() {
  const sumberSpots = bacaData('spots');
  const sumberReports = bacaData('reports');

  const spots = [];
  const reports = [];
  const errors = [];
  const ids = new Set();
  let jumlahArsip = 0;

  sumberSpots.forEach((row, index) => {
    const hasil = normalisasiSpot(row, index);
    if (hasil.errors.length) errors.push(...hasil.errors);
    if (hasil.statusLokasi !== 'dalam') jumlahArsip += 1;
    if (hasil.data.id && ids.has(hasil.data.id)) {
      errors.push(`ID duplikat: ${hasil.data.id}`);
    }
    ids.add(hasil.data.id);
    spots.push(hasil.data);
  });

  const idsLaporan = new Set();
  sumberReports.forEach((row, index) => {
    const hasil = normalisasiLaporan(row, index);
    if (hasil.errors.length) errors.push(...hasil.errors);
    if (hasil.data.id && idsLaporan.has(hasil.data.id)) {
      errors.push(`ID laporan duplikat: ${hasil.data.id}`);
    }
    idsLaporan.add(hasil.data.id);
    reports.push(hasil.data);
  });

  if (errors.length) {
    console.error('Validasi gagal:');
    for (const err of errors) console.error(`- ${err}`);
    process.exitCode = 1;
    return;
  }

  const rekap = ringkas(spots);
  console.log('Validasi berhasil.');
  console.log(`- Catatan sumber : ${spots.length} (${rekap.perJenis.rob} rob, ${rekap.perJenis.abrasi} abrasi)`);
  console.log('- Jenis ancaman :');
  for (const [nama, jumlah] of Object.entries(rekap.perJenisAncaman)) {
    console.log(`  • ${nama}: ${jumlah}`);
  }
  console.log(
    `- Tingkat rawan : ${rekap.perKategori.Rendah} Rendah, ${rekap.perKategori.Sedang} Sedang, ${rekap.perKategori.Tinggi} Tinggi`
  );
  console.log(`- Terverifikasi  : ${rekap.terverifikasi}`);
  console.log(`- Belum verifikasi: ${spots.length - rekap.terverifikasi}`);
  console.log(
    `- Status koordinat: ${rekap.perKoordinat.perkiraan} perkiraan, ${rekap.perKoordinat.referensi_lokasi} referensi lokasi, ${rekap.perKoordinat.terverifikasi} terverifikasi`
  );
  console.log(`- Di luar batas  : ${jumlahArsip} (disimpan sebagai arsip)`);
  console.log(`- Laporan warga  : ${reports.length}`);

  if (dryRun) {
    console.log('Mode --dry-run: tidak ada data yang ditulis ke database.');
    return;
  }

  await migrasiSkema();

  if (replace) {
    const lamaSpots = await read('spots', { termasukArsip: true });
    const lamaReports = await read('reports', { termasukArsip: true });
    const folder = simpanBackup(lamaSpots, lamaReports);
    console.log(`Backup data lama disimpan di: ${folder}`);

    // Ganti hanya baris aktif yang tidak ada di JSON. write() mempertahankan
    // baris arsip, dan laporan sengaja memakai mode upsert agar laporan lama
    // tidak pernah hilang hanya karena data/reports.json kosong.
    await transaksi(async (koneksi) => {
      await write('spots', spots, { mode: 'replace', preserveArchives: true, koneksi });
      await write('reports', reports, { mode: 'upsert', koneksi });
    });
    console.log('Mode --replace: data aktif diganti; arsip dan laporan lama dipertahankan.');
  } else {
    await transaksi(async (koneksi) => {
      await write('spots', spots, { mode: 'upsert', koneksi });
      await write('reports', reports, { mode: 'upsert', koneksi });
    });
    console.log('Mode tambah/ubah: data dimasukkan berdasarkan id tanpa menghapus baris lain.');
  }

  console.log(
    `Selesai. spots aktif=${await hitung('spots')}, total=${await hitung('spots', { termasukArsip: true })}, reports=${await hitung('reports')}.`
  );
}

try {
  await main();
} catch (err) {
  console.error('Impor gagal:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

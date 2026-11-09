/**
 * setup-db.mjs - Siapkan database MySQL (Laragon) untuk CoastAlert.
 *
 * Yang dilakukan:
 *   1. Membuat database `coastalert` (bila belum ada).
 *   2. Membuat tabel `spots` dan `reports` (bila belum ada).
 *   3. Memindahkan (migrasi) data dari data/*.json ke MySQL bila tabel masih kosong.
 *
 * Jalankan:
 *   npm run db:setup            -> buat database + tabel + migrasi data JSON
 *   npm run db:setup -- --force --yes
 *                               -> hapus tabel lalu buat ulang + impor ulang dari JSON
 *
 * `--force` bersifat destruktif dan wajib disertai `--yes`. Jika database
 * berisi laporan tetapi data/reports.json kosong, force dibatalkan kecuali
 * memakai --discard-reports secara sadar.
 *
 * Konfigurasi koneksi mengikuti variabel lingkungan yang sama dengan lib/db.js
 * (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const KONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const NAMA_DB = process.env.DB_NAME || 'coastalert';
const force = process.argv.includes('--force');
const yes = process.argv.includes('--yes');
const discardReports = process.argv.includes('--discard-reports');

if (force && !yes) {
  console.error('[DIBATALKAN] --force menghapus tabel spots dan reports.');
  console.error('Jalankan dengan konfirmasi eksplisit: npm run db:setup -- --force --yes');
  process.exit(1);
}

function bacaJsonAwal(nama) {
  const berkas = path.join(ROOT, 'data', `${nama}.json`);
  if (!fs.existsSync(berkas)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(berkas, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ---------------- Definisi tabel ---------------- */

const DDL_SPOTS = `
  CREATE TABLE IF NOT EXISTS \`spots\` (
    seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    kecamatan VARCHAR(100) NOT NULL DEFAULT '',
    jenis ENUM('rob','abrasi') NOT NULL,
    jenisAncaman VARCHAR(100) NOT NULL DEFAULT '',
    kategori ENUM('Rendah','Sedang','Tinggi') NULL DEFAULT NULL,
    statusKoordinat ENUM('perkiraan','referensi_lokasi','terverifikasi') NOT NULL DEFAULT 'perkiraan',
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    tinggiRob DOUBLE NULL,
    lajuAbrasi DOUBLE NULL,
    luasTerdampakHa DOUBLE NULL,
    kkTerdampak INT NULL,
    tahun INT NULL,
    tanggal VARCHAR(40) NULL,
    deskripsi TEXT,
    sumber VARCHAR(200) DEFAULT '',
    terverifikasi TINYINT(1) NOT NULL DEFAULT 0,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL,
    INDEX idx_spots_jenis (jenis),
    INDEX idx_spots_kecamatan (kecamatan)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const DDL_REPORTS = `
  CREATE TABLE IF NOT EXISTS \`reports\` (
    seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    kode VARCHAR(20) NULL UNIQUE,
    jenis ENUM('rob','abrasi') NOT NULL DEFAULT 'rob',
    namaPelapor VARCHAR(150) NOT NULL,
    kontak VARCHAR(100) DEFAULT '',
    alamat VARCHAR(255) DEFAULT '',
    kecamatan VARCHAR(100) DEFAULT '',
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    deskripsi TEXT,
    tanggal DATE NULL,
    foto VARCHAR(255) NULL,
    status ENUM('pending','diverifikasi','ditolak') NOT NULL DEFAULT 'pending',
    catatanAdmin TEXT,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL,
    INDEX idx_reports_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

/* ---------------- Langkah 1: database & tabel ---------------- */

console.log(`Menghubungkan ke MySQL di ${KONFIG.host}:${KONFIG.port} (user: ${KONFIG.user})...`);

let koneksi;
try {
  koneksi = await mysql.createConnection(KONFIG);
} catch (err) {
  console.error('\n[GAGAL] Tidak dapat terhubung ke MySQL:', err.message);
  console.error('Pastikan MySQL Laragon sudah berjalan (buka Laragon lalu klik "Start All"),');
  console.error('lalu jalankan lagi: npm run db:setup');
  process.exit(1);
}

await koneksi.query(
  `CREATE DATABASE IF NOT EXISTS \`${NAMA_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
);
console.log(`Database \`${NAMA_DB}\` siap.`);

await koneksi.query(`USE \`${NAMA_DB}\``);

if (force) {
  const [adaReports] = await koneksi
    .query('SELECT COUNT(*) AS n FROM `reports`')
    .catch(() => [[{ n: 0 }]]);
  const jumlahReportsLama = Number(adaReports[0]?.n || 0);
  const reportsJson = bacaJsonAwal('reports');

  if (jumlahReportsLama > 0 && reportsJson.length === 0 && !discardReports) {
    console.error(
      `[DIBATALKAN] Database memiliki ${jumlahReportsLama} laporan, tetapi data/reports.json kosong.`
    );
    console.error('Force akan menghapus laporan tersebut. Backup/ekspor dulu, atau gunakan --discard-reports secara sadar.');
    await koneksi.end();
    process.exit(1);
  }

  console.log('Mode --force: menghapus tabel lama...');
  await koneksi.query('DROP TABLE IF EXISTS `reports`');
  await koneksi.query('DROP TABLE IF EXISTS `spots`');
}

await koneksi.query(DDL_SPOTS);
await koneksi.query(DDL_REPORTS);

// Database lama: pastikan kolom `kode` (untuk melacak status laporan) tersedia.
const [kolomKode] = await koneksi.query("SHOW COLUMNS FROM `reports` LIKE 'kode'");
if (!kolomKode.length) {
  await koneksi.query('ALTER TABLE `reports` ADD COLUMN `kode` VARCHAR(20) NULL UNIQUE AFTER `id`');
  console.log('Kolom `kode` ditambahkan ke tabel reports.');
}

// Database lama: kategori boleh kosong (belum diverifikasi) dan status
// koordinat wajib tersedia agar pin perkiraan tidak disamakan dengan titik ukur.
const [kolomStatusKoordinat] = await koneksi.query(
  "SHOW COLUMNS FROM `spots` LIKE 'statusKoordinat'"
);
if (!kolomStatusKoordinat.length) {
  await koneksi.query(
    "ALTER TABLE `spots` ADD COLUMN `statusKoordinat` ENUM('perkiraan','referensi_lokasi','terverifikasi') NOT NULL DEFAULT 'perkiraan' AFTER `kategori`"
  );
  console.log('Kolom `statusKoordinat` ditambahkan ke tabel spots.');
}
// Database lama: simpan teks jenis ancaman persis dari sumber (mis.
// "Abrasi dan Gelombang Ekstrim") tanpa mengubah nilai `jenis` yang dipakai
// ikon, filter, dan statistik utama.
const [kolomJenisAncaman] = await koneksi.query(
  "SHOW COLUMNS FROM `spots` LIKE 'jenisAncaman'"
);
if (!kolomJenisAncaman.length) {
  await koneksi.query(
    "ALTER TABLE `spots` ADD COLUMN `jenisAncaman` VARCHAR(100) NOT NULL DEFAULT '' AFTER `jenis`"
  );
  console.log('Kolom `jenisAncaman` ditambahkan ke tabel spots.');
}
await koneksi.query(
  "ALTER TABLE `spots` MODIFY COLUMN `kategori` ENUM('Rendah','Sedang','Tinggi') NULL DEFAULT NULL"
);
await koneksi.query(
  "ALTER TABLE `spots` MODIFY COLUMN `terverifikasi` TINYINT(1) NOT NULL DEFAULT 0"
);

// Database lama: simpan tanggal kejadian terpisah dari judul dan tahun.
const [kolomTanggal] = await koneksi.query("SHOW COLUMNS FROM `spots` LIKE 'tanggal'");
if (!kolomTanggal.length) {
  await koneksi.query(
    "ALTER TABLE `spots` ADD COLUMN `tanggal` VARCHAR(40) NULL AFTER `tahun`"
  );
  console.log('Kolom `tanggal` ditambahkan ke tabel spots.');
}

console.log('Tabel `spots` dan `reports` siap.');
await koneksi.end();

/* ---------------- Langkah 2: migrasi data dari JSON ---------------- */

const db = await import('../lib/db.js');

/** Baca berkas data awal (data/spots.json / data/reports.json). */
function bacaJson(nama) {
  const berkas = path.join(ROOT, 'data', `${nama}.json`);
  if (!fs.existsSync(berkas)) return [];
  try {
    return JSON.parse(fs.readFileSync(berkas, 'utf8'));
  } catch (err) {
    console.error(`  (Lewati ${nama}.json — gagal dibaca: ${err.message})`);
    return [];
  }
}

let jumlahSpots = await db.hitung('spots');
let jumlahReports = await db.hitung('reports');

if (jumlahSpots === 0) {
  const data = bacaJson('spots');
  for (const baris of data) await db.insert('spots', baris);
  jumlahSpots = await db.hitung('spots');
  console.log(`Migrasi data JSON: ${jumlahSpots} catatan sumber dimasukkan ke tabel spots.`);
} else {
  console.log(`Tabel spots sudah berisi ${jumlahSpots} baris — migrasi dilewati.`);
}

if (jumlahReports === 0) {
  const data = bacaJson('reports');
  for (const baris of data) await db.insert('reports', baris);
  jumlahReports = await db.hitung('reports');
  console.log(`Migrasi data JSON: ${jumlahReports} laporan warga dimasukkan ke tabel reports.`);
} else {
  console.log(`Tabel reports sudah berisi ${jumlahReports} baris — migrasi dilewati.`);
}

// Lengkapi kode pelacakan untuk laporan yang belum punya (data lama / data contoh).
const { lengkapiKodeLaporan } = await import('../lib/kode.js');
const jumlahKode = await lengkapiKodeLaporan();
if (jumlahKode) console.log(`${jumlahKode} laporan diberi kode pelacakan (contoh: CL-123456).`);

/* ---------------- Selesai ---------------- */

console.log('\n====================================================');
console.log('  Setup database selesai!');
console.log(`  - Database : ${NAMA_DB}`);
console.log(`  - spots    : ${jumlahSpots} baris`);
console.log(`  - reports  : ${jumlahReports} baris`);
console.log('  Selanjutnya: npm start');
console.log('====================================================');

await db.pool.end();

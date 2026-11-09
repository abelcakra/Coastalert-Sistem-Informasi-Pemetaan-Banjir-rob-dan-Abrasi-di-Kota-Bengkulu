/**
 * hapus-arsip-luar-batas.mjs - Hapus HANYA titik arsip di luar batas kota.
 *
 * Mode bawaan adalah pratinjau (tidak menulis apa pun). Penghapusan hanya
 * berjalan dengan --execute --yes, memakai transaksi, dan pada database
 * produksi juga memerlukan --allow-production serta backup yang terverifikasi.
 *
 * Contoh pratinjau:
 *   node scripts/hapus-arsip-luar-batas.mjs
 *
 * Contoh eksekusi setelah disetujui:
 *   node scripts/hapus-arsip-luar-batas.mjs --execute --yes \
 *     --allow-production --backup backup/20261102-before-hapus-arsip-luar-batas
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { klasifikasiTitik } from '../lib/wilayah.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const ARSIP_JSON = process.env.ARSIP_JSON_PATH
  ? path.resolve(process.env.ARSIP_JSON_PATH)
  : path.join(ROOT, 'data', 'arsip', 'spots-di-luar-batas.json');
const args = process.argv.slice(2);
const opsi = new Set(args.filter((a) => a.startsWith('--')));
const nilaiOpsi = (nama) => {
  const i = args.indexOf(nama);
  return i >= 0 ? args[i + 1] : null;
};

const DB_NAME = process.env.DB_NAME || 'coastalert';
const PRODUKSI = !/_test$/i.test(DB_NAME);
const eksekusi = opsi.has('--execute');
const setuju = opsi.has('--yes');
const izinkanProduksi = opsi.has('--allow-production');
const backup = nilaiOpsi('--backup');

if (eksekusi && !setuju) {
  throw new Error('Penghapusan memerlukan --yes. Tidak ada data yang dihapus.');
}
if (eksekusi && PRODUKSI && !izinkanProduksi) {
  throw new Error('Database produksi memerlukan --allow-production. Tidak ada data yang dihapus.');
}
if (eksekusi && !backup) {
  throw new Error('Penghapusan memerlukan --backup <folder-backup-terverifikasi>.');
}

function bacaJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function periksaBackup(folder) {
  const lokasi = path.resolve(ROOT, folder);
  const metadata = bacaJson(path.join(lokasi, 'metadata.json'));
  const verifikasi = bacaJson(path.join(lokasi, 'verification.json'));

  if (!verifikasi.idsCocok) throw new Error('Backup tidak lolos verifikasi ID arsip.');
  if (verifikasi.spotsDb !== 73 || verifikasi.reportsDb !== 1 || verifikasi.arsipJson !== 16) {
    throw new Error('Jumlah data pada backup tidak sesuai baseline (73/1/16).');
  }
  if (!Array.isArray(metadata.arsipIds) || metadata.arsipIds.length !== 16) {
    throw new Error('metadata.json backup tidak memuat 16 ID arsip.');
  }

  // Pastikan checksum file backup masih sama dengan yang tercatat.
  for (const [rel, harap] of Object.entries(metadata.checksumsSha256 || {})) {
    const isi = fs.readFileSync(path.join(lokasi, rel));
    const dapat = crypto.createHash('sha256').update(isi).digest('hex');
    if (dapat !== harap) throw new Error(`Checksum backup berubah: ${rel}`);
  }
}

const daftarJson = bacaJson(ARSIP_JSON);
if (!Array.isArray(daftarJson) || daftarJson.length !== 16) {
  throw new Error(`JSON arsip harus berisi tepat 16 titik, ditemukan ${daftarJson?.length}.`);
}
const idDisetujui = daftarJson.map((s) => s.id);
if (new Set(idDisetujui).size !== 16) throw new Error('ID arsip duplikat pada JSON.');

const koneksi = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
});

const [spots] = await koneksi.query('SELECT * FROM spots ORDER BY seq');
const [[laporan]] = await koneksi.query('SELECT COUNT(*) AS n FROM reports');
const status = new Map(spots.map((s) => [s.id, klasifikasiTitik(s.lat, s.lng).status]));
const aktif = spots.filter((s) => status.get(s.id) === 'dalam');
const arsipDb = spots.filter((s) => status.get(s.id) === 'luar');
const idArsipDb = arsipDb.map((s) => s.id).sort();
const idDisetujuiUrut = [...idDisetujui].sort();

const idAktif = new Set(aktif.map((s) => s.id));
const idDisetujuiSet = new Set(idDisetujui);
const bentrokAktif = idDisetujui.filter((id) => idAktif.has(id));
const hilang = idDisetujui.filter((id) => !status.has(id));
const bukanArsip = idDisetujui.filter((id) => status.has(id) && status.get(id) !== 'luar');

if (JSON.stringify(idArsipDb) !== JSON.stringify(idDisetujuiUrut)) {
  throw new Error('ID arsip database tidak sama persis dengan JSON yang disetujui.');
}
if (bentrokAktif.length || hilang.length || bukanArsip.length) {
  throw new Error(
    `Target tidak aman. Aktif=${bentrokAktif.length}, hilang=${hilang.length}, bukan arsip=${bukanArsip.length}`
  );
}

const ringkasan = {
  database: DB_NAME,
  mode: eksekusi ? 'EKSEKUSI' : 'PRATINJAU (tidak menulis)',
  totalTitik: spots.length,
  titikAktif: aktif.length,
  titikArsip: arsipDb.length,
  laporan: Number(laporan.n),
  targetIds: idDisetujui,
};
console.log(JSON.stringify(ringkasan, null, 2));

if (!eksekusi) {
  for (const s of arsipDb) {
    console.log(`${s.id} | ${s.nama} | ${s.jenis} | ${s.kategori || '-'} | ${s.lat}, ${s.lng} | ${s.kecamatan}`);
  }
  await koneksi.end();
  console.log('Pratinjau selesai. Tidak ada data yang dihapus.');
  process.exit(0);
}

periksaBackup(backup);

const beforeReports = Number(laporan.n);
await koneksi.beginTransaction();
try {
  const tempat = idDisetujui.map(() => '?').join(', ');
  const [terkunci] = await koneksi.query(
    `SELECT id FROM spots WHERE id IN (${tempat}) FOR UPDATE`,
    idDisetujui
  );
  if (terkunci.length !== 16) throw new Error(`Baris terkunci ${terkunci.length}, seharusnya 16.`);

  const [hasil] = await koneksi.query(`DELETE FROM spots WHERE id IN (${tempat})`, idDisetujui);
  if (hasil.affectedRows !== 16) throw new Error(`Terhapus ${hasil.affectedRows}, seharusnya 16.`);

  const [[sisa]] = await koneksi.query('SELECT COUNT(*) AS n FROM spots');
  const [[sisaLaporan]] = await koneksi.query('SELECT COUNT(*) AS n FROM reports');
  if (Number(sisa.n) !== 57) throw new Error(`Sisa titik ${sisa.n}, seharusnya 57.`);
  if (Number(sisaLaporan.n) !== beforeReports) throw new Error('Jumlah laporan berubah; transaksi dibatalkan.');

  await koneksi.commit();
} catch (err) {
  await koneksi.rollback();
  throw err;
} finally {
  await koneksi.end();
}

// Database sudah berkomitmen. Baru setelah itu JSON arsip dikosongkan secara
// atomik. Jika langkah ini gagal, backup tetap tersedia untuk pemulihan.
const sementara = `${ARSIP_JSON}.tmp-${process.pid}`;
fs.writeFileSync(sementara, '[]\n', 'utf8');
fs.renameSync(sementara, ARSIP_JSON);

console.log('Penghapusan selesai: 16 titik arsip dihapus, 57 titik aktif dan laporan tetap utuh.');

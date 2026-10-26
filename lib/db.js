/**
 * db.js - Akses database MySQL (Laragon) untuk CoastAlert.
 *
 * Database yang dipakai: coastalert (default).
 * Konfigurasi bisa diatur lewat variabel lingkungan:
 *   DB_HOST (localhost), DB_PORT (3306), DB_USER (root),
 *   DB_PASSWORD (kosong - bawaan Laragon), DB_NAME (coastalert).
 *
 * Jalankan `npm run db:setup` sekali untuk membuat database + tabel.
 *
 * Semua fungsi baca/tulis bersifat async (mengembalikan Promise).
 * Bentuk data yang dikembalikan tetap sama seperti versi file JSON dulu,
 * sehingga kode route tidak perlu diubah selain menambahkan await.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(ROOT, 'uploads');

/** Nama tabel untuk setiap koleksi. */
const TABEL = {
  spots: 'spots',
  reports: 'reports',
};

/** Daftar kolom yang dipakai aplikasi (juga menentukan bentuk data keluaran). */
const KOLOM = {
  spots: [
    'id', 'nama', 'kecamatan', 'jenis', 'kategori', 'lat', 'lng',
    'tinggiRob', 'lajuAbrasi', 'luasTerdampakHa', 'kkTerdampak', 'tahun',
    'deskripsi', 'sumber', 'terverifikasi', 'createdAt', 'updatedAt',
  ],
  reports: [
    'id', 'kode', 'jenis', 'namaPelapor', 'kontak', 'alamat', 'kecamatan', 'lat', 'lng',
    'deskripsi', 'tanggal', 'foto', 'status', 'catatanAdmin', 'createdAt', 'updatedAt',
  ],
};

/** Kolom yang disimpan sebagai DATETIME (nilai di aplikasi tetap string ISO). */
const KOLOM_WAKTU = ['createdAt', 'updatedAt'];

/** Pool koneksi MySQL (dibuat sekali, dipakai seluruh aplikasi). */
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'coastalert',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // kembalikan DATETIME/DATE sebagai string, bukan objek Date
  charset: 'utf8mb4',
});

/** Pastikan folder unggahan (dan folder data lama) tersedia. */
export function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function tabelOf(collection) {
  const tabel = TABEL[collection];
  if (!tabel) throw new Error(`Koleksi tidak dikenal: ${collection}`);
  return tabel;
}

function kolomOf(collection) {
  const kolom = KOLOM[collection];
  if (!kolom) throw new Error(`Koleksi tidak dikenal: ${collection}`);
  return kolom;
}

/** Buat ID unik, contoh: sp_lx3k9a1b. */
export function newId(prefix = 'id') {
  const acak = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${acak}`;
}

/* ---------------- Konversi nilai ---------------- */

const isoKeSql = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' '); // 'YYYY-MM-DD HH:MM:SS' (UTC)
};

const sqlKeIso = (teks) => {
  const d = new Date(`${String(teks).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Siapkan satu nilai sebelum dikirim ke MySQL. */
function keSql(kolom, nilai) {
  if (nilai === undefined) return null;
  if (KOLOM_WAKTU.includes(kolom) && nilai) return isoKeSql(nilai);
  if (typeof nilai === 'boolean') return nilai ? 1 : 0;
  return nilai;
}

/** Ubah baris database menjadi bentuk data yang dipakai aplikasi. */
function dariBaris(collection, baris) {
  const data = {};
  for (const kolom of kolomOf(collection)) {
    let nilai = baris[kolom];
    if (nilai === undefined) continue;
    if (kolom === 'terverifikasi') nilai = Boolean(nilai);
    if (KOLOM_WAKTU.includes(kolom) && nilai) nilai = sqlKeIso(nilai);
    data[kolom] = nilai;
  }
  return data;
}

/* ---------------- Koneksi ---------------- */

/** Uji koneksi ke MySQL; melempar error bila gagal. */
export async function cekKoneksi() {
  await pool.query('SELECT 1');
}

/* ---------------- Operasi CRUD ---------------- */

/** Baca seluruh baris dari sebuah koleksi (urut sesuai waktu input). */
export async function read(collection) {
  const tabel = tabelOf(collection);
  const [baris] = await pool.query(`SELECT * FROM \`${tabel}\` ORDER BY seq`);
  return baris.map((b) => dariBaris(collection, b));
}

/** Hitung jumlah baris pada sebuah koleksi. */
export async function hitung(collection) {
  const tabel = tabelOf(collection);
  const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${tabel}\``);
  return Number(n);
}

/** Tulis ulang seluruh isi koleksi (hapus semua lalu masukkan baris baru). */
export async function write(collection, rows) {
  const tabel = tabelOf(collection);
  await pool.query(`DELETE FROM \`${tabel}\``);
  for (const row of rows) {
    await insert(collection, row);
  }
  return rows;
}

/** Cari satu baris berdasarkan id. */
export async function find(collection, id) {
  const tabel = tabelOf(collection);
  const [baris] = await pool.query(`SELECT * FROM \`${tabel}\` WHERE id = ? LIMIT 1`, [id]);
  return baris.length ? dariBaris(collection, baris[0]) : null;
}

/** Cari satu baris berdasarkan kolom tertentu (mis. kode laporan). */
export async function cariBerdasarkan(collection, kolom, nilai) {
  const tabel = tabelOf(collection);
  if (!kolomOf(collection).includes(kolom)) throw new Error(`Kolom tidak dikenal: ${kolom}`);
  const [baris] = await pool.query(
    `SELECT * FROM \`${tabel}\` WHERE \`${kolom}\` = ? LIMIT 1`,
    [nilai]
  );
  return baris.length ? dariBaris(collection, baris[0]) : null;
}

/** Tambah satu baris baru; id dibuat otomatis bila tidak diisi. */
export async function insert(collection, row) {
  const tabel = tabelOf(collection);
  const record = {
    ...row,
    id: row.id || newId(collection === 'spots' ? 'sp' : 'rp'),
  };

  const kolom = kolomOf(collection).filter((k) => record[k] !== undefined);
  const tanda = kolom.map(() => '?').join(', ');
  const nama = kolom.map((k) => `\`${k}\``).join(', ');
  const nilai = kolom.map((k) => keSql(k, record[k]));

  await pool.query(`INSERT INTO \`${tabel}\` (${nama}) VALUES (${tanda})`, nilai);
  return find(collection, record.id);
}

/** Ubah sebagian isi baris; kembalikan null bila id tidak ditemukan. */
export async function update(collection, id, patch) {
  const tabel = tabelOf(collection);
  const kolom = kolomOf(collection).filter((k) => k !== 'id' && patch[k] !== undefined);
  if (!kolom.length) return find(collection, id);

  const set = kolom.map((k) => `\`${k}\` = ?`).join(', ');
  const nilai = kolom.map((k) => keSql(k, patch[k]));
  const [hasil] = await pool.query(`UPDATE \`${tabel}\` SET ${set} WHERE id = ?`, [...nilai, id]);

  return hasil.affectedRows ? find(collection, id) : null;
}

/** Hapus satu baris; kembalikan true bila ada yang terhapus. */
export async function remove(collection, id) {
  const tabel = tabelOf(collection);
  const [hasil] = await pool.query(`DELETE FROM \`${tabel}\` WHERE id = ?`, [id]);
  return hasil.affectedRows > 0;
}

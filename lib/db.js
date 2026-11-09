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
import { KATEGORI } from './normalisasi.js';
import { klasifikasiTitik } from './wilayah.js';

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
    'id', 'nama', 'kecamatan', 'jenis', 'jenisAncaman', 'kategori', 'statusKoordinat', 'lat', 'lng',
    'tinggiRob', 'lajuAbrasi', 'luasTerdampakHa', 'kkTerdampak', 'tahun', 'tanggal',
    'deskripsi', 'sumber', 'terverifikasi', 'createdAt', 'updatedAt',
  ],
  reports: [
    'id', 'kode', 'jenis', 'namaPelapor', 'kontak', 'alamat', 'kecamatan', 'lat', 'lng',
    'deskripsi', 'tanggal', 'foto', 'status', 'catatanAdmin', 'createdAt', 'updatedAt',
  ],
};

/** Kolom yang disimpan sebagai DATETIME (nilai di aplikasi tetap string ISO). */
const KOLOM_WAKTU = ['createdAt', 'updatedAt'];

/** Koleksi yang punya koordinat dan harus mengikuti batas Kota Bengkulu. */
const BERLOKASI = new Set(['spots', 'reports']);

/**
 * Status lokasi sebuah baris: 'dalam', 'luar', atau 'manual'.
 * Data lama yang belum punya kolom status tetap diperiksa dari koordinatnya.
 */
export function statusLokasi(data = {}) {
  if (data.statusLokasi) return data.statusLokasi;
  return klasifikasiTitik(data.lat, data.lng).status;
}

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
function keSql(collection, kolom, nilai) {
  if (nilai === undefined) return null;
  if (KOLOM_WAKTU.includes(kolom) && nilai) return isoKeSql(nilai);
  if (typeof nilai === 'boolean') return nilai ? 1 : 0;

  if (collection === 'spots') {
    // Nilai "Belum diverifikasi" dari berkas sumber tidak boleh dipaksa menjadi
    // salah satu kategori risiko. Simpan sebagai NULL agar tidak ikut dihitung.
    if (kolom === 'kategori' && !KATEGORI.includes(nilai)) return null;
    if (kolom === 'terverifikasi') {
      return nilai === true || nilai === 1 || nilai === '1' || nilai === 'true' ? 1 : 0;
    }
  }

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

  // Status verifikasi tidak disimpan sebagai kolom terpisah; nilainya
  // diturunkan dari kolom boolean agar tidak ada dua sumber kebenaran.
  if (collection === 'spots') {
    data.statusVerifikasi = data.terverifikasi ? 'terverifikasi' : 'perlu_verifikasi';
  }

  if (BERLOKASI.has(collection)) {
    data.statusLokasi = statusLokasi(data);
  }

  return data;
}

/* ---------------- Koneksi ---------------- */

/** Uji koneksi ke MySQL; melempar error bila gagal. */
export async function cekKoneksi() {
  await pool.query('SELECT 1');
}

/* ---------------- Operasi CRUD ---------------- */

/**
 * Baca baris dari sebuah koleksi (urut sesuai waktu input).
 *
 * Secara bawaan hanya baris aktif yang dikembalikan. Untuk spots/reports,
 * baris di luar Kota Bengkulu atau yang perlu pemeriksaan manual tidak ikut
 * tampil. Gunakan `{ termasukArsip: true }` untuk audit/backup/arsip.
 */
export async function read(
  collection,
  { termasukArsip = false, koneksi = pool, forUpdate = false } = {}
) {
  const tabel = tabelOf(collection);
  const kunci = forUpdate ? ' FOR UPDATE' : '';
  const [baris] = await koneksi.query(
    `SELECT * FROM \`${tabel}\` ORDER BY seq${kunci}`
  );
  const data = baris.map((b) => dariBaris(collection, b));
  if (termasukArsip || !BERLOKASI.has(collection)) return data;
  return data.filter((row) => row.statusLokasi === 'dalam');
}

/**
 * Hitung jumlah baris pada sebuah koleksi.
 *
 * Secara bawaan hanya baris aktif yang dihitung, sama seperti `read()`.
 * Gunakan `{ termasukArsip: true }` untuk menghitung seluruh isi tabel, atau
 * `{ hanyaArsip: true }` untuk menghitung baris arsip saja.
 */
export async function hitung(
  collection,
  { termasukArsip = false, hanyaArsip = false } = {}
) {
  const tabel = tabelOf(collection);

  if (hanyaArsip && BERLOKASI.has(collection)) {
    const rows = await read(collection, { termasukArsip: true });
    return rows.filter((row) => row.statusLokasi !== 'dalam').length;
  }

  if (termasukArsip || !BERLOKASI.has(collection)) {
    const [[{ n }]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${tabel}\``);
    return Number(n);
  }

  // Status lokasi dihitung dari koordinat, bukan disimpan sebagai kolom.
  // Karena itu hitungan aktif memakai jalur yang sama dengan read().
  return (await read(collection)).length;
}

/** Jalankan pekerjaan tulis dalam satu transaksi, rollback bila gagal. */
export async function transaksi(pekerjaan) {
  const koneksi = await pool.getConnection();
  try {
    await koneksi.beginTransaction();
    const hasil = await pekerjaan(koneksi);
    await koneksi.commit();
    return hasil;
  } catch (err) {
    try {
      await koneksi.rollback();
    } catch (rollbackErr) {
      // Error rollback tidak boleh menyembunyikan error utama.
      console.error('[db] Rollback gagal:', rollbackErr.message);
    }
    throw err;
  } finally {
    koneksi.release();
  }
}

/**
 * Siapkan satu baris untuk INSERT/UPDATE.
 * Hanya kolom yang dikenal yang dikirim; kolom turunan seperti statusLokasi
 * tidak pernah ikut ditulis ke database.
 */
function siapkanBaris(collection, row, index) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new TypeError(`Baris ke-${index + 1} pada ${collection} harus berupa objek.`);
  }

  const record = {
    ...row,
    id: row.id || newId(collection === 'spots' ? 'sp' : 'rp'),
  };
  const kolom = kolomOf(collection).filter((k) => record[k] !== undefined);
  const nilai = kolom.map((k) => keSql(collection, k, record[k]));

  return { record, kolom, nilai };
}

/**
 * Tulis beberapa baris secara aman.
 *
 * mode:
 * - `upsert` (bawaan): tambah/ubah berdasarkan id, tidak menghapus baris lain.
 * - `replace`: tambah/ubah lalu hapus baris aktif yang tidak ada di input.
 *   Baris arsip tetap dipertahankan kecuali `preserveArchives: false`.
 *
 * Seluruh operasi berjalan dalam transaksi. Jika satu baris gagal, semua
 * perubahan pada pemanggilan ini dibatalkan.
 */
export async function write(
  collection,
  rows,
  { mode = 'upsert', preserveArchives = true, koneksi: koneksiLuar = null } = {}
) {
  const tabel = tabelOf(collection);
  if (!Array.isArray(rows)) {
    throw new TypeError(`Data ${collection} harus berupa array.`);
  }
  if (!['upsert', 'replace'].includes(mode)) {
    throw new Error(`Mode penulisan tidak dikenal: ${mode}`);
  }

  const data = rows.map((row, index) => siapkanBaris(collection, row, index));
  const idDipakai = new Set();
  for (const { record } of data) {
    if (idDipakai.has(record.id)) {
      throw new Error(`ID duplikat dalam input ${collection}: ${record.id}`);
    }
    idDipakai.add(record.id);
  }

  const proses = async (koneksi) => {
    for (const { record } of data) {
      const [barisAda] = await koneksi.query(
        `SELECT * FROM \`${tabel}\` WHERE id = ? LIMIT 1 FOR UPDATE`,
        [record.id]
      );

      if (barisAda.length) {
        // Gabungkan dengan baris lama agar pemanggil boleh mengirim patch
        // sebagian. Ini juga mencegah kolom NOT NULL ikut kosong saat update.
        const gabungan = { ...dariBaris(collection, barisAda[0]), ...record };
        const siap = siapkanBaris(collection, gabungan, 0);
        const kolom = siap.kolom.filter((k) => k !== 'id');
        if (!kolom.length) continue;

        const set = kolom.map((k) => `\`${k}\` = ?`).join(', ');
        const nilai = kolom.map((k) => keSql(collection, k, siap.record[k]));
        await koneksi.query(
          `UPDATE \`${tabel}\` SET ${set} WHERE id = ?`,
          [...nilai, record.id]
        );
      } else {
        const { kolom, nilai } = siapkanBaris(collection, record, 0);
        if (!kolom.length) continue;

        const namaKolom = kolom.map((k) => `\`${k}\``).join(', ');
        const tanda = kolom.map(() => '?').join(', ');
        await koneksi.query(
          `INSERT INTO \`${tabel}\` (${namaKolom}) VALUES (${tanda})`,
          nilai
        );
      }
    }

    if (mode === 'replace') {
      const [barisLama] = await koneksi.query(`SELECT * FROM \`${tabel}\``);
      for (const baris of barisLama) {
        const item = dariBaris(collection, baris);
        if (idDipakai.has(item.id)) continue;

        // Jangan menghapus arsip saat mengganti data aktif. Ini menjaga
        // titik di luar batas kota dan laporan yang perlu pemeriksaan manual.
        if (
          preserveArchives &&
          BERLOKASI.has(collection) &&
          item.statusLokasi !== 'dalam'
        ) {
          continue;
        }

        await koneksi.query(`DELETE FROM \`${tabel}\` WHERE id = ?`, [item.id]);
      }
    }

    return data.map(({ record }) => record);
  };

  // Bila pemanggil sudah membuka transaksi (mis. impor dataset yang melibatkan
  // spots dan reports sekaligus), gunakan koneksi yang sama agar commit/rollback
  // dikendalikan oleh transaksi luar tersebut.
  return koneksiLuar ? proses(koneksiLuar) : transaksi(proses);
}

/** Cari satu baris berdasarkan id; hanya baris aktif kecuali diminta arsip. */
export async function find(
  collection,
  id,
  { termasukArsip = false, koneksi = pool, forUpdate = false } = {}
) {
  const tabel = tabelOf(collection);
  const kunci = forUpdate ? ' FOR UPDATE' : '';
  const [baris] = await koneksi.query(
    `SELECT * FROM \`${tabel}\` WHERE id = ? LIMIT 1${kunci}`,
    [id]
  );
  if (!baris.length) return null;
  const data = dariBaris(collection, baris[0]);
  if (!termasukArsip && BERLOKASI.has(collection) && data.statusLokasi !== 'dalam') return null;
  return data;
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
export async function insert(collection, row, { koneksi = pool } = {}) {
  const tabel = tabelOf(collection);
  const record = {
    ...row,
    id: row.id || newId(collection === 'spots' ? 'sp' : 'rp'),
  };

  const kolom = kolomOf(collection).filter((k) => record[k] !== undefined);
  const tanda = kolom.map(() => '?').join(', ');
  const nama = kolom.map((k) => `\`${k}\``).join(', ');
  const nilai = kolom.map((k) => keSql(collection, k, record[k]));

  await koneksi.query(`INSERT INTO \`${tabel}\` (${nama}) VALUES (${tanda})`, nilai);
  // Kembalikan baris apa adanya, termasuk bila laporan berada di luar batas
  // dan akan disimpan sebagai arsip (tidak boleh tampil sebagai data aktif).
  return find(collection, record.id, { termasukArsip: true, koneksi });
}

/** Ubah sebagian isi baris; kembalikan null bila id tidak ditemukan. */
export async function update(collection, id, patch, { koneksi = pool } = {}) {
  const tabel = tabelOf(collection);
  const kolom = kolomOf(collection).filter((k) => k !== 'id' && patch[k] !== undefined);
  if (!kolom.length) return find(collection, id, { termasukArsip: true, koneksi });

  const set = kolom.map((k) => `\`${k}\` = ?`).join(', ');
  const nilai = kolom.map((k) => keSql(collection, k, patch[k]));
  await koneksi.query(`UPDATE \`${tabel}\` SET ${set} WHERE id = ?`, [...nilai, id]);

  // affectedRows bisa 0 bila nilainya sama; baris tetap dianggap ditemukan
  // selama id ada. Ini mencegah update no-op keliru dianggap 404.
  return find(collection, id, { termasukArsip: true, koneksi });
}

/**
 * Hapus satu baris aktif; kembalikan true bila ada yang terhapus.
 * Baris arsip (di luar batas/manual) tidak dapat dihapus lewat jalur ini.
 */
export async function remove(collection, id) {
  if (BERLOKASI.has(collection) && !(await find(collection, id))) return false;
  const tabel = tabelOf(collection);
  const [hasil] = await pool.query(`DELETE FROM \`${tabel}\` WHERE id = ?`, [id]);
  return hasil.affectedRows > 0;
}

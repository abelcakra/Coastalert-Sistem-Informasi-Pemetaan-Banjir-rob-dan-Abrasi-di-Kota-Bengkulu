/**
 * migrasi-kode.mjs - Tambah kolom `kode` pada tabel reports (database lama)
 * lalu isi kode untuk laporan yang sudah ada.
 *
 * Jalankan sekali: node scripts/migrasi-kode.mjs
 */
import mysql from 'mysql2/promise';

const KONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const NAMA_DB = process.env.DB_NAME || 'coastalert';

const koneksi = await mysql.createConnection(KONFIG);
await koneksi.query(`USE \`${NAMA_DB}\``);

const [kolom] = await koneksi.query("SHOW COLUMNS FROM `reports` LIKE 'kode'");
if (!kolom.length) {
  await koneksi.query('ALTER TABLE `reports` ADD COLUMN `kode` VARCHAR(20) NULL UNIQUE AFTER `id`');
  console.log('Kolom `kode` ditambahkan ke tabel reports.');
} else {
  console.log('Kolom `kode` sudah ada.');
}
await koneksi.end();

const { lengkapiKodeLaporan } = await import('../lib/kode.js');
const jumlah = await lengkapiKodeLaporan();
console.log(`${jumlah} laporan diberi kode pelacakan.`);

const { pool } = await import('../lib/db.js');
await pool.end();

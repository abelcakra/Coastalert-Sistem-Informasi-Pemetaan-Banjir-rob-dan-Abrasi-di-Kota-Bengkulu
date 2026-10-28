/**
 * seed.js - Menulis data awal dari data/spots.json & data/reports.json.
 *
 * Data ini adalah catatan sumber yang sudah disiapkan, bukan data dummy.
 * `data/reports.json` boleh berisi array kosong; dalam kondisi itu tabel
 * reports tidak akan diisi laporan sintetis.
 *
 * Jalankan `npm run seed` untuk menulis ulang data awal ke MySQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ensureDirs, hitung, pool, write } from './db.js';

/** Baca satu berkas data awal. */
export function bacaData(nama) {
  const berkas = path.join(DATA_DIR, `${nama}.json`);
  if (!fs.existsSync(berkas)) {
    if (nama === 'reports') return [];
    throw new Error(`Berkas data/${nama}.json tidak ditemukan.`);
  }
  const isi = JSON.parse(fs.readFileSync(berkas, 'utf8'));
  if (!Array.isArray(isi)) throw new Error(`data/${nama}.json harus berupa array.`);
  return isi;
}

/** Tulis data awal bila belum ada, atau selalu bila dipaksa. */
export async function seed({ force = false } = {}) {
  ensureDirs();
  const hasil = { spots: false, reports: false };

  if (force || (await hitung('spots')) === 0) {
    const spots = bacaData('spots');
    await write('spots', spots);
    hasil.spots = spots.length;
  }

  if (force || (await hitung('reports')) === 0) {
    const reports = bacaData('reports');
    await write('reports', reports);
    hasil.reports = reports.length;
  }

  return hasil;
}

// Dijalankan langsung: node lib/seed.js --force
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  const hasil = await seed({ force });
  if (hasil.spots !== false || hasil.reports !== false) {
    console.log('Data awal ditulis ke database MySQL:');
    console.log(`  - ${hasil.spots === false ? 'dilewati' : `${hasil.spots} catatan sumber`}`);
    console.log(`  - ${hasil.reports === false ? 'dilewati' : `${hasil.reports} laporan warga`}`);
  } else {
    console.log('Data sudah ada. Gunakan --force untuk menulis ulang.');
  }
  await pool.end(); // tutup pool koneksi agar proses selesai
}

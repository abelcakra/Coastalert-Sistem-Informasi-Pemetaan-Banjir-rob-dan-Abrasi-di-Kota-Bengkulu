/**
 * seed.js - Menulis data awal dari data/spots.json & data/reports.json.
 *
 * Data ini adalah catatan sumber yang sudah disiapkan, bukan data dummy.
 * `data/reports.json` boleh berisi array kosong; dalam kondisi itu tabel
 * reports tidak akan diisi laporan sintetis.
 *
 * Jalankan `npm run seed` untuk menulis data awal ke MySQL.
 *
 * Penulisan bersifat upsert: data yang sudah ada diperbarui, data arsip dan
 * laporan yang tidak ada di JSON tidak dihapus. `--force` hanya memaksa
 * pembacaan ulang JSON; operasi ini tetap memerlukan `--yes`.
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

/**
 * Tulis data awal bila belum ada, atau perbarui berdasarkan id bila dipaksa.
 *
 * `force` tidak pernah menghapus baris yang tidak ada di data/*.json. Untuk
 * operasi yang benar-benar mengganti isi tabel, gunakan script import dengan
 * mode replace dan konfirmasi eksplisit.
 */
export async function seed({ force = false, allowForce = false } = {}) {
  if (force && !allowForce) {
    throw new Error('Mode --force memerlukan konfirmasi --yes.');
  }

  ensureDirs();
  const hasil = { spots: false, reports: false };

  if (force || (await hitung('spots')) === 0) {
    const spots = bacaData('spots');
    await write('spots', spots, { mode: 'upsert' });
    hasil.spots = spots.length;
  }

  if (force || (await hitung('reports')) === 0) {
    const reports = bacaData('reports');
    // Upsert, bukan replace: laporan yang sudah ada di database tetap aman
    // walaupun data/reports.json kosong.
    await write('reports', reports, { mode: 'upsert' });
    hasil.reports = reports.length;
  }

  return hasil;
}

// Dijalankan langsung: node lib/seed.js --force --yes
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  const force = process.argv.includes('--force');
  const allowForce = process.argv.includes('--yes');

  if (force && !allowForce) {
    console.error('Dibatalkan: --force berpotensi mengubah data dan memerlukan --yes.');
    console.error('Contoh: node lib/seed.js --force --yes');
    process.exitCode = 1;
    await pool.end();
  } else {
    const hasil = await seed({ force, allowForce });
    if (hasil.spots !== false || hasil.reports !== false) {
      console.log('Data awal ditulis ke database MySQL (upsert, tanpa menghapus arsip):');
      console.log(`  - ${hasil.spots === false ? 'dilewati' : `${hasil.spots} catatan sumber`}`);
      console.log(`  - ${hasil.reports === false ? 'dilewati' : `${hasil.reports} laporan warga`}`);
    } else {
      console.log('Data sudah ada. Gunakan --force --yes untuk memperbarui dari JSON.');
    }
    await pool.end(); // tutup pool koneksi agar proses selesai
  }
}

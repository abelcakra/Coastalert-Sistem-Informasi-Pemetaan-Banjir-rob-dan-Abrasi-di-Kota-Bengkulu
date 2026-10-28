/**
 * import-dataset.mjs - Validasi & impor data/spots.json + data/reports.json.
 *
 * Contoh:
 *   node scripts/import-dataset.mjs --dry-run
 *   node scripts/import-dataset.mjs                 # tambah/ubah berdasarkan id
 *   node scripts/import-dataset.mjs --replace --yes # ganti seluruh isi tabel
 *
 * Mode --replace menghapus baris lama, jadi wajib disertai --yes.
 * Sebelum mengganti, isi tabel lama disimpan ke folder backup/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bacaData } from '../lib/seed.js';
import { find, hitung, insert, pool, read, update, write } from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const KATEGORI = ['Rendah', 'Sedang', 'Tinggi'];
const STATUS_KOORDINAT = ['perkiraan', 'referensi_lokasi', 'terverifikasi'];
const JENIS = ['rob', 'abrasi'];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const replace = args.includes('--replace');
const yes = args.includes('--yes');

if (dryRun && replace) {
  console.error('Pilih salah satu: --dry-run atau --replace.');
  process.exit(1);
}
if (replace && !yes) {
  console.error('Mode --replace menghapus data lama. Jalankan dengan --replace --yes setelah backup.');
  process.exit(1);
}

const angkaAtauNull = (nilai) => {
  if (nilai === null || nilai === undefined || nilai === '') return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
};

const teks = (nilai) => String(nilai ?? '').trim();

function normalisasiSpot(row, index) {
  const errors = [];
  const id = teks(row.id);
  const nama = teks(row.nama);
  const jenis = JENIS.includes(row.jenis) ? row.jenis : null;
  const lat = angkaAtauNull(row.lat);
  const lng = angkaAtauNull(row.lng);

  if (!id) errors.push(`Baris ${index + 1}: id wajib diisi.`);
  if (!nama) errors.push(`Baris ${index + 1}: nama wajib diisi.`);
  if (!jenis) errors.push(`Baris ${index + 1}: jenis harus "rob" atau "abrasi".`);
  if (lat === null || lat < -90 || lat > 90) errors.push(`Baris ${index + 1}: latitude tidak valid.`);
  if (lng === null || lng < -180 || lng > 180) errors.push(`Baris ${index + 1}: longitude tidak valid.`);

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
    data: {
      id,
      nama,
      kecamatan: teks(row.kecamatan),
      jenis,
      kategori,
      statusKoordinat,
      lat,
      lng,
      tinggiRob: jenis === 'rob' ? angkaAtauNull(row.tinggiRob) : null,
      lajuAbrasi: jenis === 'abrasi' ? angkaAtauNull(row.lajuAbrasi) : null,
      luasTerdampakHa: angkaAtauNull(row.luasTerdampakHa),
      kkTerdampak: angkaAtauNull(row.kkTerdampak),
      tahun: angkaAtauNull(row.tahun),
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
  if (id && !jenis) errors.push(`Laporan ${index + 1}: jenis tidak valid.`);
  return {
    errors,
    data: {
      ...row,
      id,
      jenis,
      namaPelapor: teks(row.namaPelapor),
      status: ['pending', 'diverifikasi', 'ditolak'].includes(row.status) ? row.status : 'pending',
    },
  };
}

function ringkas(spots) {
  const perJenis = { rob: 0, abrasi: 0 };
  const perKoordinat = { perkiraan: 0, referensi_lokasi: 0, terverifikasi: 0 };
  const perKategori = { Rendah: 0, Sedang: 0, Tinggi: 0 };
  let terverifikasi = 0;

  for (const s of spots) {
    perJenis[s.jenis] += 1;
    perKoordinat[s.statusKoordinat] = (perKoordinat[s.statusKoordinat] || 0) + 1;
    if (s.terverifikasi) {
      terverifikasi += 1;
      if (s.kategori) perKategori[s.kategori] += 1;
    }
  }

  return { perJenis, perKoordinat, perKategori, terverifikasi };
}

async function migrasiSkema() {
  const [kolom] = await pool.query("SHOW COLUMNS FROM `spots` LIKE 'statusKoordinat'");
  if (!kolom.length) {
    await pool.query(
      "ALTER TABLE `spots` ADD COLUMN `statusKoordinat` ENUM('perkiraan','referensi_lokasi','terverifikasi') NOT NULL DEFAULT 'perkiraan' AFTER `kategori`"
    );
    console.log('Skema: kolom statusKoordinat ditambahkan.');
  }
  await pool.query(
    "ALTER TABLE `spots` MODIFY COLUMN `kategori` ENUM('Rendah','Sedang','Tinggi') NULL DEFAULT NULL"
  );
  await pool.query(
    "ALTER TABLE `spots` MODIFY COLUMN `terverifikasi` TINYINT(1) NOT NULL DEFAULT 0"
  );
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

  sumberSpots.forEach((row, index) => {
    const hasil = normalisasiSpot(row, index);
    if (hasil.errors.length) errors.push(...hasil.errors);
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
  console.log(`- Terverifikasi  : ${rekap.terverifikasi}`);
  console.log(`- Belum verifikasi: ${spots.length - rekap.terverifikasi}`);
  console.log(
    `- Status koordinat: ${rekap.perKoordinat.perkiraan} perkiraan, ${rekap.perKoordinat.referensi_lokasi} referensi lokasi, ${rekap.perKoordinat.terverifikasi} terverifikasi`
  );
  console.log(`- Laporan warga  : ${reports.length}`);

  if (dryRun) {
    console.log('Mode --dry-run: tidak ada data yang ditulis ke database.');
    return;
  }

  await migrasiSkema();

  if (replace) {
    const lamaSpots = await read('spots');
    const lamaReports = await read('reports');
    const folder = simpanBackup(lamaSpots, lamaReports);
    console.log(`Backup data lama disimpan di: ${folder}`);
    await write('spots', spots);
    await write('reports', reports);
    console.log('Mode --replace: isi tabel spots dan reports diganti.');
  } else {
    for (const row of spots) {
      const ada = await find('spots', row.id);
      if (ada) await update('spots', row.id, row);
      else await insert('spots', row);
    }
    for (const row of reports) {
      const ada = await find('reports', row.id);
      if (ada) await update('reports', row.id, row);
      else await insert('reports', row);
    }
    console.log('Mode tambah/ubah: data dimasukkan berdasarkan id tanpa menghapus baris lain.');
  }

  console.log(`Selesai. spots=${await hitung('spots')}, reports=${await hitung('reports')}.`);
}

try {
  await main();
} catch (err) {
  console.error('Impor gagal:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

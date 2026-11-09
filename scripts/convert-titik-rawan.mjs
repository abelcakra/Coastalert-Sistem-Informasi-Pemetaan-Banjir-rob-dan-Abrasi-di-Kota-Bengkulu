/**
 * convert-titik-rawan.mjs - Ubah CSV titik_rawan menjadi data/spots.json.
 *
 * Sumber: CSV dengan kolom
 *   nama_lokasi, latitude, longitude, jenis_ancaman, tingkat_rawan,
 *   deskripsi, sumber_data
 *
 * Pemetaan ke struktur aplikasi:
 *   nama_lokasi     -> nama
 *   latitude/lng    -> lat/lng
 *   jenis_ancaman   -> jenisAncaman (teks persis) + jenis (rob/abrasi untuk ikon)
 *   tingkat_rawan   -> kategori (Rendah/Sedang/Tinggi)
 *   deskripsi       -> deskripsi
 *   sumber_data     -> sumber
 *
 * Tidak ada tanggal, tahun, tinggi rob, laju abrasi, luas, atau KK yang
 * dikarang. Nilai yang tidak tersedia di CSV disimpan sebagai null.
 *
 * Jalankan:
 *   node scripts/convert-titik-rawan.mjs --csv "path/titik_rawan.csv"
 *   node scripts/convert-titik-rawan.mjs --csv "path/titik_rawan.csv" --write
 *   node scripts/convert-titik-rawan.mjs --csv "path/titik_rawan.csv" --write --arsip-out "data/arsip/spots-di-luar-batas.json"
 *
 * Tanpa `--write`, script hanya berjalan sebagai pratinjau (dry-run) dan
 * tidak mengubah data/spots.json. Titik di luar batas dipisahkan dari output
 * aktif; titik tersebut hanya ditulis bila `--arsip-out` diberikan.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KATEGORI,
  normalisasiAngka as angkaAtauNull,
  normalisasiTeks as teks,
} from '../lib/normalisasi.js';
import { klasifikasiTitik } from '../lib/wilayah.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'spots.json');
const args = process.argv.slice(2);

const KECAMATAN_DIKENAL = [
  'Kampung Melayu',
  'Teluk Segara',
  'Muara Bangka Hulu',
  'Ratu Samban',
  'Ratu Agung',
  'Sungai Serut',
];

function argValue(nama) {
  const i = process.argv.indexOf(nama);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function parseCsv(teks) {
  const baris = [];
  let sel = '';
  let row = [];
  let dalamKutip = false;
  const bersih = teks.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  for (let i = 0; i < bersih.length; i += 1) {
    const c = bersih[i];
    if (dalamKutip) {
      if (c === '"' && bersih[i + 1] === '"') {
        sel += '"';
        i += 1;
      } else if (c === '"') {
        dalamKutip = false;
      } else {
        sel += c;
      }
    } else if (c === '"') {
      dalamKutip = true;
    } else if (c === ',') {
      row.push(sel);
      sel = '';
    } else if (c === '\n') {
      row.push(sel);
      baris.push(row);
      row = [];
      sel = '';
    } else {
      sel += c;
    }
  }
  if (sel !== '' || row.length) {
    row.push(sel);
    baris.push(row);
  }
  return baris.filter((r) => r.some((s) => s.trim() !== ''));
}

function normalisasiJenis(nilai) {
  const t = teks(nilai).toLowerCase();
  if (t === 'banjir rob' || t === 'rob') return 'rob';
  if (t.includes('abrasi')) return 'abrasi';
  return null;
}

/** Ambil nama kecamatan dari deskripsi, mendukung "Kec." dan "Kecamatan". */
function ambilKecamatan(deskripsi) {
  const pola = [
    /\bKec(?:amatan)?\.?\s+([^,.;:\n]+)/i,
    /\bKecamatan\s+([^,.;:\n]+)/i,
  ];
  for (const p of pola) {
    const m = deskripsi.match(p);
    if (m) return teks(m[1]).replace(/\s+/g, ' ');
  }
  return '';
}

function ambilKelurahan(deskripsi) {
  const m = deskripsi.match(/\bKel(?:urahan)?\.?\s+([^,.;:\n]+)/i);
  return m ? teks(m[1]).replace(/\s+/g, ' ') : '';
}

function validasiKoordinat(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

const csvArg = argValue('--csv');
if (!csvArg) {
  console.error('Argumen --csv wajib diisi. Script tidak lagi memakai path pribadi bawaan.');
  console.error('Contoh: node scripts/convert-titik-rawan.mjs --csv "backup/20261029-before-titik-rawan/source-titik_rawan.csv"');
  process.exit(1);
}

const tulis = args.includes('--write');
const mintaDryRun = args.includes('--dry-run');
if (tulis && mintaDryRun) {
  console.error('Pilih salah satu: --dry-run (pratinjau) atau --write.');
  process.exit(1);
}

const csvPath = path.resolve(csvArg);
if (!fs.existsSync(csvPath)) {
  console.error(`CSV tidak ditemukan: ${csvPath}`);
  process.exit(1);
}

const outPath = path.resolve(argValue('--out') || OUT);
const arsipArg = argValue('--arsip-out');
const arsipPath = arsipArg ? path.resolve(arsipArg) : null;
const dryRun = !tulis;

const baris = parseCsv(fs.readFileSync(csvPath, 'utf8'));
if (baris.length < 2) {
  console.error('CSV kosong atau tidak memiliki baris data.');
  process.exit(1);
}

const header = baris[0].map((h) => teks(h));
const wajib = ['nama_lokasi', 'latitude', 'longitude', 'jenis_ancaman', 'tingkat_rawan', 'deskripsi', 'sumber_data'];
const headerHilang = wajib.filter((h) => !header.includes(h));
if (headerHilang.length) {
  console.error(`Kolom wajib tidak ditemukan: ${headerHilang.join(', ')}`);
  process.exit(1);
}

const now = new Date().toISOString();
const hasil = [];
const arsip = [];
const gagal = [];
const idDipakai = new Set();
const koordinatDipakai = new Map();
const kecamatanTidakDikenal = [];
const judulDenganTanggal = [];

for (let i = 1; i < baris.length; i += 1) {
  const obj = {};
  header.forEach((h, j) => {
    obj[h] = teks(baris[i][j]);
  });

  const nomorBaris = i + 1;
  const errors = [];
  const nama = obj.nama_lokasi;
  const jenisAncaman = obj.jenis_ancaman;
  const jenis = normalisasiJenis(jenisAncaman);
  const kategori = obj.tingkat_rawan;
  const lat = angkaAtauNull(obj.latitude);
  const lng = angkaAtauNull(obj.longitude);
  const deskripsi = obj.deskripsi;
  const sumber = obj.sumber_data;

  if (!nama) errors.push('nama_lokasi kosong');
  if (!jenis) errors.push(`jenis_ancaman tidak dikenal: "${jenisAncaman}"`);
  if (!KATEGORI.includes(kategori)) errors.push(`tingkat_rawan tidak dikenal: "${kategori}"`);
  if (!validasiKoordinat(lat, lng)) errors.push(`koordinat tidak valid: ${obj.latitude}, ${obj.longitude}`);
  if (!deskripsi) errors.push('deskripsi kosong');
  if (!sumber) errors.push('sumber_data kosong');

  if (errors.length) {
    gagal.push({ baris: nomorBaris, nama, alasan: errors.join('; ') });
    continue;
  }

  const kecamatan = ambilKecamatan(deskripsi);
  if (!kecamatan) {
    errors.push('kecamatan tidak dapat dibaca dari deskripsi');
  } else if (!KECAMATAN_DIKENAL.includes(kecamatan)) {
    kecamatanTidakDikenal.push({ baris: nomorBaris, nama, kecamatan });
  }

  if (/\b(19|20)\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(nama)) {
    judulDenganTanggal.push({ baris: nomorBaris, nama });
  }

  const kunciKoordinat = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  if (koordinatDipakai.has(kunciKoordinat)) {
    // Koordinat sama bukan kegagalan: pin akan dikelompokkan/spiderfy.
    // Tetap dicatat agar laporan akhir transparan.
  }
  koordinatDipakai.set(kunciKoordinat, (koordinatDipakai.get(kunciKoordinat) || 0) + 1);

  if (errors.length) {
    gagal.push({ baris: nomorBaris, nama, alasan: errors.join('; ') });
    continue;
  }

  const lokasi = klasifikasiTitik(lat, lng);
  if (lokasi.status === 'manual') {
    gagal.push({
      baris: nomorBaris,
      nama,
      alasan: lokasi.alasan || 'koordinat tidak dapat diperiksa terhadap batas kota',
    });
    continue;
  }

  const id = `ca_rawan_${String(i).padStart(4, '0')}`;
  if (idDipakai.has(id)) {
    gagal.push({ baris: nomorBaris, nama, alasan: `ID duplikat: ${id}` });
    continue;
  }
  idDipakai.add(id);

  const data = {
    id,
    nama,
    kecamatan,
    jenis,
    jenisAncaman,
    kategori,
    statusKoordinat: 'perkiraan',
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    tinggiRob: null,
    lajuAbrasi: null,
    luasTerdampakHa: null,
    kkTerdampak: null,
    tahun: null,
    tanggal: null,
    deskripsi,
    sumber,
    terverifikasi: false,
    createdAt: now,
    updatedAt: now,
    statusVerifikasi: 'perlu_verifikasi',
  };

  if (lokasi.status === 'luar') {
    arsip.push({ ...data, alasan: 'Di luar batas administrasi Kota Bengkulu.' });
  } else {
    hasil.push(data);
  }
}

if (gagal.length) {
  console.error(`\n${gagal.length} baris gagal dikonversi:`);
  for (const g of gagal) console.error(`- baris ${g.baris} (${g.nama || 'tanpa nama'}): ${g.alasan}`);
  process.exitCode = 1;
}

if (!hasil.length) {
  console.error('Tidak ada titik aktif yang valid untuk ditulis.');
  process.exit(1);
}

if (gagal.length && tulis) {
  console.error('Penulisan dibatalkan karena masih ada baris gagal. Perbaiki CSV terlebih dahulu.');
  process.exit(1);
}

if (!dryRun) {
  fs.writeFileSync(outPath, `${JSON.stringify(hasil, null, 2)}\n`, 'utf8');
  if (arsipPath && arsip.length) {
    fs.mkdirSync(path.dirname(arsipPath), { recursive: true });
    fs.writeFileSync(arsipPath, `${JSON.stringify(arsip, null, 2)}\n`, 'utf8');
  }
}

const hitung = (key) => {
  const map = new Map();
  for (const r of hasil) map.set(r[key], (map.get(r[key]) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};
const ganda = [...koordinatDipakai.entries()].filter(([, n]) => n > 1);
const lats = hasil.map((r) => r.lat);
const lngs = hasil.map((r) => r.lng);

console.log(`CSV          : ${csvPath}`);
console.log(`Mode         : ${dryRun ? 'pratinjau (tidak menulis)' : 'tulis'}`);
console.log(`Baris data   : ${baris.length - 1}`);
console.log(`Aktif        : ${hasil.length}`);
console.log(`Di luar batas: ${arsip.length}`);
console.log(`Gagal        : ${gagal.length}`);
console.log(`Output aktif : ${outPath}`);
if (arsipPath) console.log(`Output arsip : ${arsipPath}`);
if (arsip.length && !arsipPath) {
  console.log('Peringatan   : titik di luar batas tidak ditulis; gunakan --arsip-out bila ingin menyimpannya.');
}
console.log('\nDistribusi jenis ancaman (teks CSV):');
for (const [v, n] of hitung('jenisAncaman')) console.log(`- ${v}: ${n}`);
console.log('\nDistribusi jenis internal (ikon/filter):');
for (const [v, n] of hitung('jenis')) console.log(`- ${v}: ${n}`);
console.log('\nDistribusi tingkat rawan:');
for (const [v, n] of hitung('kategori')) console.log(`- ${v}: ${n}`);
console.log('\nDistribusi kecamatan:');
for (const [v, n] of hitung('kecamatan')) console.log(`- ${v}: ${n}`);
console.log('\nDistribusi sumber:');
for (const [v, n] of hitung('sumber')) console.log(`- ${v.slice(0, 90)}${v.length > 90 ? '…' : ''}: ${n}`);
console.log(`\nBatas koordinat: lat ${Math.min(...lats)} s.d. ${Math.max(...lats)}, lng ${Math.min(...lngs)} s.d. ${Math.max(...lngs)}`);
console.log(`Koordinat ganda: ${ganda.length ? ganda.map(([k, n]) => `${k} (${n})`).join(', ') : 'tidak ada'}`);
if (kecamatanTidakDikenal.length) {
  console.log('\nPeringatan kecamatan di luar daftar umum:');
  for (const k of kecamatanTidakDikenal) console.log(`- baris ${k.baris} ${k.nama}: ${k.kecamatan}`);
}
if (judulDenganTanggal.length) {
  console.log('\nPeringatan judul mengandung tanggal:');
  for (const j of judulDenganTanggal) console.log(`- baris ${j.baris}: ${j.nama}`);
} else {
  console.log('Judul mengandung tanggal: tidak ada');
}

/**
 * routes/import.js - Import data GIS (GeoJSON / CSV) ke daftar titik rawan.
 */
import { Router } from 'express';
import multer from 'multer';
import { insert } from '../lib/db.js';
import { wajibAdmin } from '../lib/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const JENIS = ['rob', 'abrasi'];
const KATEGORI = ['Rendah', 'Sedang', 'Tinggi'];

/** Ambil nilai pertama yang ada dari beberapa kemungkinan nama kolom. */
function ambil(obj, ...kandidat) {
  for (const kunci of kandidat) {
    const nilai = obj[kunci] ?? obj[kunci.toLowerCase()] ?? obj[kunci.toUpperCase()];
    if (nilai !== undefined && nilai !== null && String(nilai).trim() !== '') return nilai;
  }
  return undefined;
}

function tebakJenis(nilai) {
  const teks = String(nilai || '').toLowerCase();
  if (teks.includes('abrasi') || teks.includes('erosi') || teks.includes('erosion')) return 'abrasi';
  if (teks.includes('rob') || teks.includes('flood') || teks.includes('banjir')) return 'rob';
  return null;
}

function normalKategori(nilai) {
  const teks = String(nilai || '').toLowerCase();
  if (teks.includes('tinggi') || teks.includes('high')) return 'Tinggi';
  if (teks.includes('sedang') || teks.includes('medium')) return 'Sedang';
  if (teks.includes('rendah') || teks.includes('low')) return 'Rendah';
  return KATEGORI.includes(nilai) ? nilai : 'Sedang';
}

const angka = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** Hitung titik tengah (centroid) sederhana dari sebuah geometry GeoJSON. */
function centroid(geometry) {
  if (!geometry || !geometry.coordinates) return null;
  const titik = [];
  const telusuri = (c) => {
    if (typeof c[0] === 'number' && typeof c[1] === 'number') titik.push(c);
    else if (Array.isArray(c)) c.forEach(telusuri);
  };
  telusuri(geometry.coordinates);
  if (!titik.length) return null;
  const lng = titik.reduce((a, t) => a + t[0], 0) / titik.length;
  const lat = titik.reduce((a, t) => a + t[1], 0) / titik.length;
  return { lat, lng };
}

/** Ubah satu Feature GeoJSON menjadi data titik. */
function dariFeature(feature) {
  const props = feature.properties || {};
  const posisi =
    (feature.geometry && feature.geometry.type === 'Point'
      ? { lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] }
      : centroid(feature.geometry)) || {};
  const lat = angka(ambil(props, 'lat', 'latitude', 'y')) ?? posisi.lat ?? null;
  const lng = angka(ambil(props, 'lng', 'lon', 'long', 'longitude', 'x')) ?? posisi.lng ?? null;

  const jenis = tebakJenis(ambil(props, 'jenis', 'type', 'kategori_jenis')) || null;
  const nama = ambil(props, 'nama', 'name', 'kelurahan', 'lokasi') || 'Tanpa nama';

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: `Titik "${nama}" tidak punya koordinat valid.` };
  if (!JENIS.includes(jenis)) return { error: `Titik "${nama}" jenisnya tidak dikenali (isi "rob" atau "abrasi").` };

  return {
    data: {
      nama: String(nama).trim(),
      kecamatan: String(ambil(props, 'kecamatan', 'kec', 'district') || '').trim(),
      jenis,
      kategori: normalKategori(ambil(props, 'kategori', 'tingkat', 'level', 'kelas')),
      lat,
      lng,
      tinggiRob: jenis === 'rob' ? angka(ambil(props, 'tinggiRob', 'tinggi_rob', 'tinggi', 'height')) : null,
      lajuAbrasi: jenis === 'abrasi' ? angka(ambil(props, 'lajuAbrasi', 'laju_abrasi', 'laju', 'rate')) : null,
      luasTerdampakHa: angka(ambil(props, 'luasTerdampakHa', 'luas', 'luas_ha', 'area_ha')),
      kkTerdampak: angka(ambil(props, 'kkTerdampak', 'kk', 'jumlah_kk', 'keluarga')),
      tahun: angka(ambil(props, 'tahun', 'year')),
      deskripsi: String(ambil(props, 'deskripsi', 'description', 'keterangan', 'ket') || '').trim(),
      sumber: String(ambil(props, 'sumber', 'source') || 'Import data GIS').trim(),
      terverifikasi: true,
    },
  };
}

/** Parser CSV sederhana (mendukung tanda kutip ganda). */
function parseCsv(teks) {
  const baris = [];
  let sel = '';
  let row = [];
  let dalamKutip = false;
  const clean = teks.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  for (let i = 0; i < clean.length; i += 1) {
    const c = clean[i];
    if (dalamKutip) {
      if (c === '"' && clean[i + 1] === '"') {
        sel += '"';
        i += 1;
      } else if (c === '"') {
        dalamKutip = false;
      } else {
        sel += c;
      }
    } else if (c === '"') {
      dalamKutip = true;
    } else if (c === ',' || c === ';') {
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

async function simpanTitik(data) {
  const now = new Date().toISOString();
  return insert('spots', { ...data, createdAt: now, updatedAt: now });
}

/** POST /api/import/geojson (admin) */
router.post('/geojson', wajibAdmin, upload.single('file'), async (req, res) => {
  let gj;
  try {
    const teks = req.file ? req.file.buffer.toString('utf8') : JSON.stringify(req.body);
    gj = JSON.parse(teks);
  } catch {
    return res.status(400).json({ error: 'Berkas bukan GeoJSON/JSON yang valid.' });
  }

  const features =
    gj.type === 'FeatureCollection' ? gj.features || [] : gj.type === 'Feature' ? [gj] : [];

  const errors = [];
  let berhasil = 0;
  for (const feature of features) {
    const hasil = dariFeature(feature);
    if (hasil.error) {
      errors.push(hasil.error);
      continue;
    }
    await simpanTitik(hasil.data);
    berhasil += 1;
  }

  res.json({
    pesan: `${berhasil} titik berhasil diimpor dari ${features.length} feature.`,
    berhasil,
    gagal: errors.length,
    errors: errors.slice(0, 10),
  });
});

/** POST /api/import/csv (admin) */
router.post('/csv', wajibAdmin, upload.single('file'), async (req, res) => {
  const teks = req.file ? req.file.buffer.toString('utf8') : String(req.body?.csv || '');
  if (!teks.trim()) return res.status(400).json({ error: 'Isi berisi CSV tidak ditemukan.' });

  const baris = parseCsv(teks);
  if (baris.length < 2) return res.status(400).json({ error: 'CSV minimal berisi baris judul dan satu data.' });

  const header = baris[0].map((h) => h.trim());
  const errors = [];
  let berhasil = 0;

  for (const barisData of baris.slice(1)) {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = barisData[i];
    });
    const hasil = dariFeature({ properties: obj, geometry: null });
    if (hasil.error) {
      errors.push(hasil.error);
      continue;
    }
    await simpanTitik(hasil.data);
    berhasil += 1;
  }

  res.json({
    pesan: `${berhasil} titik berhasil diimpor dari CSV.`,
    berhasil,
    gagal: errors.length,
    errors: errors.slice(0, 10),
  });
});

export default router;

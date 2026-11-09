/**
 * routes/import.js - Import data GIS (GeoJSON / CSV) ke daftar titik rawan.
 */
import { Router } from 'express';
import multer from 'multer';
import { insert, read, transaksi, update } from '../lib/db.js';
import { wajibAdmin } from '../lib/auth.js';
import { JENIS, KATEGORI, normalisasiAngka as angka } from '../lib/normalisasi.js';
import { klasifikasiTitik } from '../lib/wilayah.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

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
  // Jangan mengisi kategori secara diam-diam bila sumber tidak menyebutkannya.
  return KATEGORI.includes(nilai) ? nilai : null;
}

function normalStatusKoordinat(nilai) {
  const teks = String(nilai || '').toLowerCase();
  if (teks.includes('referensi')) return 'referensi_lokasi';
  if (teks.includes('terverifikasi') || teks.includes('terukur')) return 'terverifikasi';
  return 'perkiraan';
}

function normalTerverifikasi(props) {
  const nilai = ambil(props, 'terverifikasi', 'verified', 'statusVerifikasi');
  return nilai === true || nilai === 1 || nilai === '1' || nilai === 'true' || nilai === 'terverifikasi';
}

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
  const lat = angka(ambil(props, 'lat', 'latitude', 'y')) ?? angka(posisi.lat) ?? null;
  const lng = angka(ambil(props, 'lng', 'lon', 'long', 'longitude', 'x')) ?? angka(posisi.lng) ?? null;

  const jenis = tebakJenis(ambil(props, 'jenis', 'jenis_ancaman', 'jenisAncaman', 'type', 'kategori_jenis')) || null;
  const nama = ambil(props, 'nama', 'nama_lokasi', 'name', 'kelurahan', 'lokasi') || 'Tanpa nama';
  const id = String(ambil(props, 'id', 'kode', 'kode_titik') || '').trim() || undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: `Titik "${nama}" tidak punya koordinat valid.` };
  if (lat < -90 || lat > 90) {
    return { error: `Titik "${nama}" latitude di luar rentang -90 sampai 90.` };
  }
  if (lng < -180 || lng > 180) {
    return { error: `Titik "${nama}" longitude di luar rentang -180 sampai 180.` };
  }

  const lokasi = klasifikasiTitik(lat, lng);
  if (lokasi.status === 'manual') {
    return { error: `Titik "${nama}" tidak dapat diperiksa terhadap batas Kota Bengkulu: ${lokasi.alasan}` };
  }

  if (!JENIS.includes(jenis)) return { error: `Titik "${nama}" jenisnya tidak dikenali (isi "rob" atau "abrasi").` };

  const jenisAncaman =
    String(ambil(props, 'jenisAncaman', 'jenis_ancaman', 'ancaman') || '').trim() ||
    (jenis === 'abrasi' ? 'Abrasi' : 'Banjir Rob');

  return {
    statusLokasi: lokasi.status,
    data: {
      id,
      nama: String(nama).trim(),
      kecamatan: String(ambil(props, 'kecamatan', 'kec', 'district') || '').trim(),
      jenis,
      jenisAncaman,
      kategori: normalKategori(
        ambil(props, 'kategori', 'tingkat_rawan', 'tingkat', 'level', 'kelas')
      ),
      statusKoordinat: normalStatusKoordinat(
        ambil(props, 'statusKoordinat', 'status_koordinat', 'koordinat')
      ),
      lat,
      lng,
      tinggiRob: jenis === 'rob' ? angka(ambil(props, 'tinggiRob', 'tinggi_rob', 'tinggi', 'height')) : null,
      lajuAbrasi: jenis === 'abrasi' ? angka(ambil(props, 'lajuAbrasi', 'laju_abrasi', 'laju', 'rate')) : null,
      luasTerdampakHa: angka(ambil(props, 'luasTerdampakHa', 'luas', 'luas_ha', 'area_ha')),
      kkTerdampak: angka(ambil(props, 'kkTerdampak', 'kk', 'jumlah_kk', 'keluarga')),
      tahun: angka(ambil(props, 'tahun', 'year')),
      tanggal: String(ambil(props, 'tanggal', 'date', 'tanggal_kejadian') || '').trim(),
      deskripsi: String(ambil(props, 'deskripsi', 'description', 'keterangan', 'ket') || '').trim(),
      sumber: String(ambil(props, 'sumber', 'sumber_data', 'source') || 'Import data GIS').trim(),
      terverifikasi: normalTerverifikasi(props),
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

/** Kunci alami untuk mencegah duplikasi saat berkas yang sama diimpor berulang. */
function kunciTitik(data) {
  return [
    String(data.nama || '').trim().toLowerCase(),
    Number(data.lat).toFixed(6),
    Number(data.lng).toFixed(6),
    String(data.jenis || ''),
  ].join('|');
}

async function indeksTitik({ koneksi = null, forUpdate = false } = {}) {
  const opsi = { termasukArsip: true, forUpdate };
  if (koneksi) opsi.koneksi = koneksi;
  const rows = await read('spots', opsi);
  const byId = new Map();
  const byKey = new Map();
  for (const row of rows) {
    byId.set(row.id, row);
    byKey.set(kunciTitik(row), row);
  }
  return { byId, byKey };
}

function errorValidasi(pesan) {
  const err = new Error(pesan);
  err.validasi = true;
  return err;
}

async function simpanTitik(
  data,
  statusLokasi,
  indeks,
  { dryRun = false, koneksi = null } = {}
) {
  const now = new Date().toISOString();
  const kunci = kunciTitik(data);
  const existing =
    (data.id && indeks.byId.get(data.id)) ||
    indeks.byKey.get(kunci) ||
    null;

  // Impor tidak boleh menurunkan titik aktif menjadi arsip. Bila data sumber
  // berubah menjadi di luar batas, pertahankan baris aktif dan laporkan konflik.
  if (existing?.statusLokasi === 'dalam' && statusLokasi !== 'dalam') {
    throw errorValidasi(
      'Titik aktif yang sudah ada tidak boleh dipindahkan ke arsip oleh impor.'
    );
  }

  if (dryRun) {
    const id = existing?.id || data.id || `dry_${indeks.byId.size + 1}`;
    const simulasi = { ...data, id, statusLokasi: statusLokasi || existing?.statusLokasi };
    indeks.byId.set(id, simulasi);
    indeks.byKey.set(kunciTitik(simulasi), simulasi);
    return existing
      ? { aksi: 'diperbarui', statusLokasi: simulasi.statusLokasi }
      : { aksi: 'ditambah', statusLokasi: simulasi.statusLokasi };
  }

  if (existing) {
    const row = await update('spots', existing.id, { ...data, updatedAt: now }, { koneksi });
    if (!row) throw new Error(`Gagal memperbarui titik ${existing.id}.`);
    indeks.byId.set(row.id, row);
    indeks.byKey.set(kunciTitik(row), row);
    return { aksi: 'diperbarui', data: row, statusLokasi };
  }

  const row = await insert(
    'spots',
    { ...data, createdAt: now, updatedAt: now },
    { koneksi }
  );
  if (!row) throw new Error('Titik baru tidak dapat dibaca kembali setelah disimpan.');
  indeks.byId.set(row.id, row);
  indeks.byKey.set(kunciTitik(row), row);
  return { aksi: 'ditambah', data: row, statusLokasi };
}

function mintaDryRun(req) {
  const nilai = req.query.dryRun ?? req.query['dry-run'] ?? req.body?.dryRun;
  return nilai === true || nilai === 1 || nilai === '1' || nilai === 'true';
}

async function imporFeatures(features, { dryRun = false } = {}) {
  const valid = [];
  const errors = [];

  // Validasi seluruh feature lebih dulu. Feature yang tidak valid tidak
  // ditulis, sedangkan feature valid tetap dapat diproses dalam satu batch.
  for (const feature of features) {
    const hasil = dariFeature(feature);
    if (hasil.error) {
      errors.push(hasil.error);
      continue;
    }
    valid.push(hasil);
  }

  const ringkasan = { berhasil: 0, diperbarui: 0, diarsipkan: 0 };

  if (dryRun) {
    const indeks = await indeksTitik();
    for (const hasil of valid) {
      try {
        const simpan = await simpanTitik(hasil.data, hasil.statusLokasi, indeks, {
          dryRun: true,
        });
        if (simpan.aksi === 'ditambah') ringkasan.berhasil += 1;
        else ringkasan.diperbarui += 1;
        if (simpan.statusLokasi !== 'dalam') ringkasan.diarsipkan += 1;
      } catch (err) {
        if (!err.validasi) throw err;
        errors.push(`Titik "${hasil.data.nama}": ${err.message}`);
      }
    }
    return {
      ...ringkasan,
      gagal: errors.length,
      errors: errors.slice(0, 10),
      dryRun: true,
    };
  }

  if (!valid.length) {
    return {
      ...ringkasan,
      gagal: errors.length,
      errors: errors.slice(0, 10),
      dryRun: false,
    };
  }

  // Satu transaksi untuk seluruh batch. Lock semua baris spots agar impor
  // bersamaan tidak menghasilkan duplikasi. Error database apa pun akan
  // membatalkan seluruh batch, bukan menyisakan sebagian data.
  const hasil = await transaksi(async (koneksi) => {
    const indeks = await indeksTitik({ koneksi, forUpdate: true });
    for (const item of valid) {
      try {
        const simpan = await simpanTitik(item.data, item.statusLokasi, indeks, {
          koneksi,
        });
        if (simpan.aksi === 'ditambah') ringkasan.berhasil += 1;
        else ringkasan.diperbarui += 1;
        if (simpan.statusLokasi !== 'dalam') ringkasan.diarsipkan += 1;
      } catch (err) {
        if (!err.validasi) throw err;
        errors.push(`Titik "${item.data.nama}": ${err.message}`);
      }
    }
    return ringkasan;
  });

  return {
    ...hasil,
    gagal: errors.length,
    errors: errors.slice(0, 10),
    dryRun: false,
  };
}

function pesanImpor(ringkasan, sumber) {
  const mode = ringkasan.dryRun ? ' (dry-run, tidak ditulis)' : '';
  return `${ringkasan.berhasil} ditambahkan, ${ringkasan.diperbarui} diperbarui, ${ringkasan.diarsipkan} diarsipkan, ${ringkasan.gagal} gagal dari ${sumber}${mode}.`;
}

async function kirimHasilImpor(req, res, next, features, sumber) {
  try {
    const ringkasan = await imporFeatures(features, { dryRun: mintaDryRun(req) });
    res.json({
      pesan: pesanImpor(ringkasan, sumber),
      ...ringkasan,
    });
  } catch (err) {
    // Kegagalan database membatalkan seluruh transaksi batch; teruskan ke
    // penanganan error agar klien menerima respons gagal, bukan data parsial.
    next(err);
  }
}

/** POST /api/import/geojson (admin) */
router.post('/geojson', wajibAdmin, upload.single('file'), async (req, res, next) => {
  let gj;
  try {
    const teks = req.file ? req.file.buffer.toString('utf8') : JSON.stringify(req.body);
    gj = JSON.parse(teks);
  } catch {
    return res.status(400).json({ error: 'Berkas bukan GeoJSON/JSON yang valid.' });
  }

  const features =
    gj.type === 'FeatureCollection' ? gj.features || [] : gj.type === 'Feature' ? [gj] : [];

  await kirimHasilImpor(req, res, next, features, `${features.length} feature`);
});

/** POST /api/import/csv (admin) */
router.post('/csv', wajibAdmin, upload.single('file'), async (req, res, next) => {
  const teks = req.file ? req.file.buffer.toString('utf8') : String(req.body?.csv || '');
  if (!teks.trim()) return res.status(400).json({ error: 'Isi berisi CSV tidak ditemukan.' });

  const baris = parseCsv(teks);
  if (baris.length < 2) return res.status(400).json({ error: 'CSV minimal berisi baris judul dan satu data.' });

  const header = baris[0].map((h) => h.trim());
  const features = baris.slice(1).map((barisData) => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = barisData[i];
    });
    return { properties: obj, geometry: null };
  });

  await kirimHasilImpor(req, res, next, features, 'CSV');
});

export {
  angka as normalisasiAngka,
  dariFeature,
  imporFeatures,
  kunciTitik,
  parseCsv,
};
export default router;

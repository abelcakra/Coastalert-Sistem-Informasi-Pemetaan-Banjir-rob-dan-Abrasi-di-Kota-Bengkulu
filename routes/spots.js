/**
 * routes/spots.js - CRUD titik rawan rob & abrasi.
 */
import { Router } from 'express';
import { find, insert, read, remove, update } from '../lib/db.js';
import { wajibAdmin } from '../lib/auth.js';
import {
  JENIS,
  KATEGORI,
  STATUS_KOORDINAT,
  POLA_TANGGAL,
  normalisasiAngka as angka,
} from '../lib/normalisasi.js';
import { klasifikasiTitik } from '../lib/wilayah.js';

const router = Router();

const boolean = (nilai, bawaan = false) => {
  if (nilai === undefined || nilai === null || nilai === '') return bawaan;
  return nilai === true || nilai === 1 || nilai === '1' || nilai === 'true';
};

/** Ambil & validasi payload titik dari body request. */
export function normalisasi(body = {}, existing = {}) {
  const jenis = JENIS.includes(body.jenis) ? body.jenis : null;
  const jenisBerubah = Boolean(existing.jenis && jenis && existing.jenis !== jenis);
  const jenisAncaman = (
    body.jenisAncaman !== undefined
      ? String(body.jenisAncaman || '')
      : jenisBerubah
        ? ''
        : String(existing.jenisAncaman || '')
  ).trim() || (jenis === 'rob' ? 'Banjir Rob' : jenis === 'abrasi' ? 'Abrasi' : '');
  const kategori = KATEGORI.includes(body.kategori) ? body.kategori : null;
  const statusKoordinat = STATUS_KOORDINAT.includes(body.statusKoordinat)
    ? body.statusKoordinat
    : existing.statusKoordinat || 'perkiraan';
  const lat = angka(body.lat);
  const lng = angka(body.lng);
  const tanggal =
    body.tanggal !== undefined
      ? String(body.tanggal || '').trim()
      : String(existing.tanggal || '').trim();

  const errors = [];
  if (!body.nama || !String(body.nama).trim()) errors.push('Nama titik wajib diisi.');
  if (!jenis) errors.push('Jenis harus "rob" atau "abrasi".');
  if (jenisAncaman.length > 100) errors.push('Jenis ancaman maksimal 100 karakter.');
  // Kategori sengaja opsional. Catatan sumber yang belum diverifikasi tidak
  // boleh dipaksa menjadi Rendah, Sedang, atau Tinggi.
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push('Latitude tidak valid.');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push('Longitude tidak valid.');
  if (Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180) {
    const lokasi = klasifikasiTitik(lat, lng);
    if (lokasi.status === 'luar') {
      errors.push('Koordinat berada di luar batas administrasi Kota Bengkulu.');
    } else if (lokasi.status === 'manual') {
      errors.push(lokasi.alasan || 'Koordinat tidak dapat diperiksa terhadap batas Kota Bengkulu.');
    }
  }
  if (tanggal && !POLA_TANGGAL.test(tanggal)) {
    errors.push('Tanggal harus YYYY-MM-DD atau "YYYY-MM-DD s.d. YYYY-MM-DD".');
  }

  return {
    errors,
    data: {
      nama: String(body.nama || '').trim(),
      kecamatan: String(body.kecamatan || '').trim(),
      jenis,
      jenisAncaman,
      kategori,
      statusKoordinat,
      lat,
      lng,
      tinggiRob: jenis === 'rob' ? angka(body.tinggiRob) : null,
      lajuAbrasi: jenis === 'abrasi' ? angka(body.lajuAbrasi) : null,
      luasTerdampakHa: angka(body.luasTerdampakHa),
      kkTerdampak: angka(body.kkTerdampak),
      tahun: angka(body.tahun),
      tanggal: tanggal || null,
      deskripsi: String(body.deskripsi || '').trim(),
      sumber:
        String(body.sumber || '').trim() ||
        existing.sumber ||
        'Input manual',
      terverifikasi:
        body.terverifikasi === undefined
          ? Boolean(existing.terverifikasi)
          : boolean(body.terverifikasi),
    },
  };
}

/** GET /api/spots - daftar titik dengan filter & pencarian. */
router.get('/', async (req, res) => {
  const { jenis, kategori, kecamatan, q } = req.query;
  let rows = await read('spots');

  if (jenis && JENIS.includes(jenis)) rows = rows.filter((r) => r.jenis === jenis);
  if (kategori) {
    const daftar = String(kategori).split(',').map((s) => s.trim());
    const mintaBelum = daftar.includes('Belum diverifikasi');
    rows = rows.filter((r) =>
      r.kategori ? daftar.includes(r.kategori) : mintaBelum
    );
  }
  if (kecamatan) rows = rows.filter((r) => r.kecamatan === kecamatan);
  if (q) {
    const kata = String(q).toLowerCase();
    rows = rows.filter((r) =>
      [r.nama, r.kecamatan, r.jenisAncaman, r.deskripsi, r.tanggal]
        .join(' ')
        .toLowerCase()
        .includes(kata)
    );
  }

  res.json({ jumlah: rows.length, data: rows });
});

/** GET /api/spots/:id */
router.get('/:id', async (req, res) => {
  const spot = await find('spots', req.params.id);
  if (!spot) return res.status(404).json({ error: 'Titik tidak ditemukan.' });
  res.json({ data: spot });
});

/** POST /api/spots - tambah titik (admin). */
router.post('/', wajibAdmin, async (req, res) => {
  const { errors, data } = normalisasi(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const now = new Date().toISOString();
  const spot = await insert('spots', { ...data, createdAt: now, updatedAt: now });
  res.status(201).json({ data: spot });
});

/** PUT /api/spots/:id - ubah titik (admin). */
router.put('/:id', wajibAdmin, async (req, res) => {
  const existing = await find('spots', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Titik tidak ditemukan.' });
  }
  const { errors, data } = normalisasi(req.body, existing);
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });
  const spot = await update('spots', req.params.id, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
  res.json({ data: spot });
});

/** DELETE /api/spots/:id (admin). */
router.delete('/:id', wajibAdmin, async (req, res) => {
  const ok = await remove('spots', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Titik tidak ditemukan.' });
  res.json({ ok: true });
});

export default router;

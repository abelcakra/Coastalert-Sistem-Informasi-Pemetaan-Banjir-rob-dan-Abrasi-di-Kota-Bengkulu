/**
 * routes/spots.js - CRUD titik rawan rob & abrasi.
 */
import { Router } from 'express';
import { find, insert, read, remove, update } from '../lib/db.js';
import { wajibAdmin } from '../lib/auth.js';

const router = Router();

const JENIS = ['rob', 'abrasi'];
const KATEGORI = ['Rendah', 'Sedang', 'Tinggi'];

/** Ambil & validasi payload titik dari body request. */
function normalisasi(body = {}) {
  const jenis = JENIS.includes(body.jenis) ? body.jenis : null;
  const kategori = KATEGORI.includes(body.kategori) ? body.kategori : null;
  const lat = Number(body.lat);
  const lng = Number(body.lng);

  const errors = [];
  if (!body.nama || !String(body.nama).trim()) errors.push('Nama titik wajib diisi.');
  if (!jenis) errors.push('Jenis harus "rob" atau "abrasi".');
  if (!kategori) errors.push('Kategori harus Rendah, Sedang, atau Tinggi.');
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push('Latitude tidak valid.');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push('Longitude tidak valid.');

  const angka = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    errors,
    data: {
      nama: String(body.nama || '').trim(),
      kecamatan: String(body.kecamatan || '').trim(),
      jenis,
      kategori,
      lat,
      lng,
      tinggiRob: jenis === 'rob' ? angka(body.tinggiRob) : null,
      lajuAbrasi: jenis === 'abrasi' ? angka(body.lajuAbrasi) : null,
      luasTerdampakHa: angka(body.luasTerdampakHa),
      kkTerdampak: angka(body.kkTerdampak),
      tahun: angka(body.tahun),
      deskripsi: String(body.deskripsi || '').trim(),
      sumber: String(body.sumber || '').trim() || 'Input manual',
      terverifikasi: body.terverifikasi !== false,
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
    rows = rows.filter((r) => daftar.includes(r.kategori));
  }
  if (kecamatan) rows = rows.filter((r) => r.kecamatan === kecamatan);
  if (q) {
    const kata = String(q).toLowerCase();
    rows = rows.filter((r) =>
      [r.nama, r.kecamatan, r.deskripsi].join(' ').toLowerCase().includes(kata)
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
  if (!(await find('spots', req.params.id))) {
    return res.status(404).json({ error: 'Titik tidak ditemukan.' });
  }
  const { errors, data } = normalisasi(req.body);
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

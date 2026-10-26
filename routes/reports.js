/**
 * routes/reports.js - Laporan kejadian dari warga + verifikasi admin.
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { UPLOAD_DIR, cariBerdasarkan, find, insert, read, remove, update } from '../lib/db.js';
import { wajibAdmin } from '../lib/auth.js';
import { buatKodeLaporan } from '../lib/kode.js';

const router = Router();

const JENIS = ['rob', 'abrasi'];
const STATUS = ['pending', 'diverifikasi', 'ditolak'];

/** Penyimpanan foto laporan. */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    cb(null, `laporan_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // maks 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Hanya berkas gambar yang diizinkan.'));
  },
});

/** POST /api/reports - kirim laporan (publik, boleh tanpa foto). */
router.post('/', upload.single('foto'), async (req, res) => {
  const b = req.body || {};
  const jenis = JENIS.includes(b.jenis) ? b.jenis : 'rob';
  const lat = Number(b.lat);
  const lng = Number(b.lng);

  const errors = [];
  if (!b.namaPelapor || !String(b.namaPelapor).trim()) errors.push('Nama pelapor wajib diisi.');
  if (!b.deskripsi || !String(b.deskripsi).trim()) errors.push('Deskripsi kejadian wajib diisi.');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errors.push('Titik lokasi wajib dipilih di peta.');
  }
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const laporan = await insert('reports', {
    kode: await buatKodeLaporan(),
    jenis,
    namaPelapor: String(b.namaPelapor).trim(),
    kontak: String(b.kontak || '').trim(),
    alamat: String(b.alamat || '').trim(),
    kecamatan: String(b.kecamatan || '').trim(),
    lat,
    lng,
    deskripsi: String(b.deskripsi).trim(),
    tanggal: b.tanggal || new Date().toISOString().slice(0, 10),
    foto: req.file ? `/uploads/${req.file.filename}` : null,
    status: 'pending',
    catatanAdmin: '',
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({
    data: laporan,
    pesan: 'Terima kasih! Laporan Anda menunggu verifikasi admin.',
  });
});

/** GET /api/reports/publik - laporan yang sudah diverifikasi (untuk layer peta). */
router.get('/publik', async (_req, res) => {
  const data = (await read('reports'))
    .filter((r) => r.status === 'diverifikasi')
    .map((r) => ({
      id: r.id,
      jenis: r.jenis,
      lat: r.lat,
      lng: r.lng,
      alamat: r.alamat,
      kecamatan: r.kecamatan,
      deskripsi: r.deskripsi,
      tanggal: r.tanggal,
      foto: r.foto,
    }));
  res.json({ jumlah: data.length, data });
});

/** GET /api/reports/lacak/:kode - cek status laporan dengan kode (publik). */
router.get('/lacak/:kode', async (req, res) => {
  let kode = String(req.params.kode || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d{6}$/.test(kode)) kode = `CL-${kode}`;
  if (!/^CL-\d{6}$/.test(kode)) {
    return res.status(400).json({ error: 'Format kode laporan tidak valid. Contoh: CL-123456.' });
  }

  const laporan = await cariBerdasarkan('reports', 'kode', kode);
  if (!laporan) return res.status(404).json({ error: 'Kode laporan tidak ditemukan.' });

  res.json({
    data: {
      kode: laporan.kode,
      tanggal: laporan.tanggal,
      jenis: laporan.jenis,
      lokasi: laporan.alamat || laporan.kecamatan || '',
      kecamatan: laporan.kecamatan || '',
      status: laporan.status,
      createdAt: laporan.createdAt,
    },
  });
});

/** GET /api/reports - daftar laporan (admin), bisa difilter status. */
router.get('/', wajibAdmin, async (req, res) => {
  const { status } = req.query;
  let rows = await read('reports');
  if (status && STATUS.includes(status)) rows = rows.filter((r) => r.status === status);
  rows = rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ jumlah: rows.length, data: rows });
});

/** PATCH /api/reports/:id - ubah status/verifikasi (admin). */
router.patch('/:id', wajibAdmin, async (req, res) => {
  const { status, catatanAdmin, jadikanTitik } = req.body || {};
  if (status && !STATUS.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }
  if (!(await find('reports', req.params.id))) {
    return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
  }

  const patch = { updatedAt: new Date().toISOString() };
  if (status) patch.status = status;
  if (typeof catatanAdmin === 'string') patch.catatanAdmin = catatanAdmin;

  const laporan = await update('reports', req.params.id, patch);

  // Opsi: ubah laporan terverifikasi menjadi titik rawan baru di peta.
  let spotBaru = null;
  if (jadikanTitik && status === 'diverifikasi') {
    const now = new Date().toISOString();
    spotBaru = await insert('spots', {
      nama: laporan.alamat || `Laporan ${laporan.namaPelapor}`,
      kecamatan: laporan.kecamatan || 'Belum diketahui',
      jenis: laporan.jenis,
      kategori: 'Sedang',
      lat: laporan.lat,
      lng: laporan.lng,
      tinggiRob: null,
      lajuAbrasi: null,
      luasTerdampakHa: null,
      kkTerdampak: null,
      tahun: Number((laporan.tanggal || '').slice(0, 4)) || new Date().getFullYear(),
      deskripsi: laporan.deskripsi,
      sumber: `Laporan warga: ${laporan.namaPelapor}`,
      terverifikasi: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  res.json({ data: laporan, spot: spotBaru });
});

/** DELETE /api/reports/:id (admin). */
router.delete('/:id', wajibAdmin, async (req, res) => {
  const ok = await remove('reports', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
  res.json({ ok: true });
});

export default router;

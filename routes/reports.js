/**
 * routes/reports.js - Laporan kejadian dari warga + verifikasi admin.
 */
import { Router } from 'express';
import { createHash } from 'node:crypto';
import multer from 'multer';
import { cariBerdasarkan, find, insert, read, remove, transaksi, update } from '../lib/db.js';
import { wajibAdmin } from '../lib/auth.js';
import { buatKodeLaporan } from '../lib/kode.js';
import { buatRateLimiter } from '../lib/rate-limit.js';
import {
  MAKS_UKURAN_BERKAS,
  hapusBerkasLaporan,
  simpanBerkasLaporan,
  validasiBerkasLaporan,
} from '../lib/upload-laporan.js';
import {
  JENIS,
  STATUS_LAPORAN as STATUS,
  normalisasiAngka as angka,
} from '../lib/normalisasi.js';
import { klasifikasiTitik } from '../lib/wilayah.js';

const router = Router();

/** Error HTTP yang dapat dilempar dari dalam transaksi. */
const galat = (status, pesan) => {
  const err = new Error(pesan);
  err.status = status;
  return err;
};

/**
 * ID titik yang diturunkan dari ID laporan. Konvensi ini membuat verifikasi
 * berulang selalu menunjuk baris yang sama tanpa perlu kolom relasi baru.
 * Bila ID laporan terlalu panjang, gunakan hash agar tetap muat di VARCHAR(40).
 */
export function idTitikLaporan(idLaporan) {
  const idAman = String(idLaporan).replace(/[^a-zA-Z0-9._-]/g, '_');
  const dasar = `lpr_${idAman}`;
  if (dasar.length <= 40) return dasar;
  return `lpr_${createHash('sha256').update(String(idLaporan)).digest('hex').slice(0, 36)}`;
}

/**
 * Foto ditahan di memori sampai validasi form, MIME, ekstensi, ukuran, dan
 * magic bytes selesai. Berkas baru ditulis ke disk setelah lolos validasi.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAKS_UKURAN_BERKAS, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/i.test(String(file.mimetype || ''))) {
      return cb(null, true);
    }
    const err = new Error('Hanya foto JPG, PNG, atau WebP yang diizinkan.');
    err.status = 400;
    cb(err);
  },
});

const limiterKirimLaporan = buatRateLimiter({
  nama: 'kirim-laporan',
  windowMs: 15 * 60 * 1000,
  max: 10,
  pesan: 'Terlalu banyak pengiriman laporan. Silakan coba lagi beberapa saat lagi.',
});

const limiterLacakLaporan = buatRateLimiter({
  nama: 'lacak-laporan',
  windowMs: 10 * 60 * 1000,
  max: 30,
  pesan: 'Terlalu banyak permintaan pelacakan laporan. Silakan coba lagi nanti.',
});

/** POST /api/reports - kirim laporan (publik, boleh tanpa foto). */
router.post('/', limiterKirimLaporan, upload.single('foto'), async (req, res, next) => {
  const b = req.body || {};
  const jenis = JENIS.includes(b.jenis) ? b.jenis : null;
  const lat = angka(b.lat);
  const lng = angka(b.lng);

  const errors = [];
  if (!b.namaPelapor || !String(b.namaPelapor).trim()) errors.push('Nama pelapor wajib diisi.');
  if (!jenis) errors.push('Jenis laporan harus "rob" atau "abrasi".');
  if (!b.deskripsi || !String(b.deskripsi).trim()) errors.push('Deskripsi kejadian wajib diisi.');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    errors.push('Titik lokasi wajib dipilih di peta; latitude dan longitude tidak boleh kosong.');
  } else if (lat < -90 || lat > 90) {
    errors.push('Latitude harus berada pada rentang -90 sampai 90.');
  } else if (lng < -180 || lng > 180) {
    errors.push('Longitude harus berada pada rentang -180 sampai 180.');
  } else {
    const lokasi = klasifikasiTitik(lat, lng);
    if (lokasi.status === 'manual') {
      errors.push(lokasi.alasan || 'Titik lokasi tidak dapat diperiksa terhadap batas Kota Bengkulu.');
    }
  }
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const validasiFoto = validasiBerkasLaporan(req.file);
  if (!validasiFoto.ok) return res.status(400).json({ error: validasiFoto.error });

  // Validasi selesai; baru sekarang foto boleh ditulis ke disk.
  let foto = null;
  let laporan;
  try {
    if (req.file) foto = await simpanBerkasLaporan(req.file, validasiFoto.ekstensi);

    laporan = await insert('reports', {
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
      foto,
      status: 'pending',
      catatanAdmin: '',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Jangan tinggalkan foto yatim bila penyimpanan laporan gagal.
    if (foto) await hapusBerkasLaporan(foto).catch(() => {});
    return next(err);
  }

  const diarsipkan = laporan?.statusLokasi && laporan.statusLokasi !== 'dalam';
  res.status(201).json({
    data: laporan,
    diarsipkan,
    pesan: diarsipkan
      ? 'Terima kasih. Lokasi laporan berada di luar cakupan Kota Bengkulu, sehingga laporan disimpan sebagai arsip dan tidak ditampilkan di peta/statistik aktif.'
      : 'Terima kasih! Laporan Anda menunggu verifikasi admin.',
  });
});

/**
 * GET /api/reports/publik - laporan terverifikasi untuk layer peta.
 * Alamat lengkap tidak dikirim ke publik; gunakan kecamatan + koordinat yang
 * memang diperlukan untuk menampilkan lokasi kejadian di peta.
 */
router.get('/publik', async (_req, res) => {
  const data = (await read('reports'))
    .filter((r) => r.status === 'diverifikasi')
    .map((r) => ({
      id: r.id,
      jenis: r.jenis,
      lat: r.lat,
      lng: r.lng,
      kecamatan: r.kecamatan,
      deskripsi: r.deskripsi,
      tanggal: r.tanggal,
      foto: r.foto,
    }));
  res.json({ jumlah: data.length, data });
});

/** GET /api/reports/lacak/:kode - cek status laporan dengan kode (publik). */
router.get('/lacak/:kode', limiterLacakLaporan, async (req, res) => {
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
      // Jangan kirim alamat lengkap melalui endpoint publik. Kecamatan sudah
      // cukup untuk konteks status laporan.
      lokasi: laporan.kecamatan || '',
      kecamatan: laporan.kecamatan || '',
      status: laporan.status,
      createdAt: laporan.createdAt,
    },
  });
});

/**
 * GET /api/reports - daftar laporan (admin), bisa difilter status.
 * Tambahkan ?arsip=1 untuk melihat laporan yang berada di luar batas kota.
 */
router.get('/', wajibAdmin, async (req, res) => {
  const { status, arsip } = req.query;
  const lihatArsip = arsip === '1';
  let rows = await read('reports', { termasukArsip: lihatArsip });
  if (lihatArsip) rows = rows.filter((r) => r.statusLokasi !== 'dalam');
  if (status && STATUS.includes(status)) rows = rows.filter((r) => r.status === status);
  rows = rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ jumlah: rows.length, arsip: lihatArsip, data: rows });
});

/** PATCH /api/reports/:id - ubah status/verifikasi (admin). */
router.patch('/:id', wajibAdmin, async (req, res, next) => {
  const { status, catatanAdmin, jadikanTitik } = req.body || {};
  if (status && !STATUS.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid.' });
  }

  try {
    const hasil = await transaksi(async (koneksi) => {
      // Kunci baris laporan selama transaksi. Permintaan verifikasi ganda akan
      // menunggu di sini, sehingga keduanya tidak dapat membuat titik bersamaan.
      const laporanLama = await find('reports', req.params.id, {
        termasukArsip: true,
        koneksi,
        forUpdate: true,
      });
      if (!laporanLama || laporanLama.statusLokasi !== 'dalam') {
        throw galat(404, 'Laporan tidak ditemukan.');
      }

      const patch = { updatedAt: new Date().toISOString() };
      if (status) patch.status = status;
      if (typeof catatanAdmin === 'string') patch.catatanAdmin = catatanAdmin;

      const laporan = await update('reports', req.params.id, patch, { koneksi });
      if (!laporan) throw galat(404, 'Laporan tidak ditemukan.');

      // `jadikanTitik` juga berlaku bila laporan sudah diverifikasi sebelumnya.
      // Dengan begitu permintaan ulang tidak membuat titik kedua, tetapi admin
      // masih dapat membuat titik untuk laporan terverifikasi yang belum punya titik.
      const statusEfektif = status || laporanLama.status;
      let spot = null;
      let spotDibuat = false;

      if (jadikanTitik && statusEfektif === 'diverifikasi') {
        const idTitik = idTitikLaporan(laporanLama.id);
        spot = await find('spots', idTitik, {
          termasukArsip: true,
          koneksi,
          forUpdate: true,
        });

        if (!spot) {
          if (
            laporan.lat === null ||
            laporan.lat === undefined ||
            laporan.lat === '' ||
            laporan.lng === null ||
            laporan.lng === undefined ||
            laporan.lng === ''
          ) {
            throw galat(400, 'Koordinat laporan kosong sehingga tidak dapat dijadikan titik.');
          }
          const lat = Number(laporan.lat);
          const lng = Number(laporan.lng);
          if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            lat < -90 ||
            lat > 90 ||
            lng < -180 ||
            lng > 180
          ) {
            throw galat(400, 'Koordinat laporan tidak valid sehingga tidak dapat dijadikan titik.');
          }
          const lokasi = klasifikasiTitik(lat, lng);
          if (lokasi.status !== 'dalam') {
            throw galat(
              400,
              'Laporan tidak dapat dijadikan titik karena lokasinya di luar batas Kota Bengkulu.'
            );
          }

          const now = new Date().toISOString();
          const nama = String(
            laporan.alamat || `Laporan ${laporan.namaPelapor || 'warga'}`
          )
            .trim()
            .slice(0, 150) || `Laporan ${laporan.id}`;
          const kecamatan = String(laporan.kecamatan || 'Belum diketahui')
            .trim()
            .slice(0, 100);
          const sumber = `Laporan warga terverifikasi [${laporan.id}]: ${
            laporan.namaPelapor || 'tanpa nama'
          }`.slice(0, 200);

          spot = await insert(
            'spots',
            {
              id: idTitik,
              nama,
              kecamatan,
              jenis: laporan.jenis,
              // Kategori tidak ditetapkan hanya karena laporan sudah diverifikasi.
              kategori: null,
              statusKoordinat: 'perkiraan',
              lat,
              lng,
              tinggiRob: null,
              lajuAbrasi: null,
              luasTerdampakHa: null,
              kkTerdampak: null,
              tahun: Number((laporan.tanggal || '').slice(0, 4)) || new Date().getFullYear(),
              tanggal: laporan.tanggal || null,
              deskripsi: laporan.deskripsi,
              sumber,
              terverifikasi: true,
              createdAt: now,
              updatedAt: now,
            },
            { koneksi }
          );
          if (!spot) throw new Error('Titik laporan tidak dapat dibaca kembali setelah disimpan.');
          spotDibuat = true;
        }
      }

      return { laporan, spot, spotDibuat };
    });

    const body = {
      data: hasil.laporan,
      spot: hasil.spot,
      spotDibuat: hasil.spotDibuat,
    };
    if (hasil.spot && !hasil.spotDibuat) {
      body.pesan = 'Laporan sudah memiliki titik; tidak ada titik baru yang dibuat.';
    }
    res.json(body);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

/** DELETE /api/reports/:id (admin). */
router.delete('/:id', wajibAdmin, async (req, res) => {
  const ok = await remove('reports', req.params.id);
  if (!ok) return res.status(404).json({ error: 'Laporan tidak ditemukan.' });
  res.json({ ok: true });
});

export { angka as normalisasiAngka };
export default router;

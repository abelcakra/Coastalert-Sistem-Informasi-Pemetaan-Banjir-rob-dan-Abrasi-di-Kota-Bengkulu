/**
 * upload-laporan.js - Validasi dan penyimpanan foto laporan warga.
 *
 * Berkas ditahan di memori (multer.memoryStorage) sampai seluruh validasi
 * selesai. Nama berkas asli tidak pernah dipakai langsung; nama akhir dibuat
 * dari waktu + nilai acak dan ekstensi yang sudah dicocokkan dengan isi file.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOAD_DIR } from './db.js';

export const MAKS_UKURAN_BERKAS = 5 * 1024 * 1024; // 5 MB

const MIME_DIIZINKAN = new Map([
  ['image/jpeg', 'jpeg'],
  ['image/jpg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const EKSTENSI_DIIZINKAN = {
  jpeg: new Set(['.jpg', '.jpeg']),
  png: new Set(['.png']),
  webp: new Set(['.webp']),
};

const EKSTENSI_SIMPAN = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
};

/** Deteksi format gambar dari magic bytes, bukan dari nama atau MIME klien. */
export function deteksiFormatGambar(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Validasi ukuran, MIME, ekstensi, dan magic bytes.
 * Tidak menulis apa pun ke disk.
 */
export function validasiBerkasLaporan(file) {
  if (!file) return { ok: true, ekstensi: null };

  if (!file.buffer || !file.size) {
    return { ok: false, error: 'Berkas foto kosong atau tidak dapat dibaca.' };
  }
  if (file.size > MAKS_UKURAN_BERKAS) {
    return { ok: false, error: 'Ukuran foto maksimal 5 MB.' };
  }

  const formatDariMime = MIME_DIIZINKAN.get(String(file.mimetype || '').toLowerCase());
  if (!formatDariMime) {
    return { ok: false, error: 'Hanya foto JPG, PNG, atau WebP yang diizinkan.' };
  }

  const ekstensi = path.extname(String(file.originalname || '')).toLowerCase();
  if (!EKSTENSI_DIIZINKAN[formatDariMime]?.has(ekstensi)) {
    return { ok: false, error: 'Ekstensi berkas tidak sesuai dengan jenis gambarnya.' };
  }

  const formatDariIsi = deteksiFormatGambar(file.buffer);
  if (formatDariIsi !== formatDariMime) {
    return { ok: false, error: 'Isi berkas tidak sesuai dengan tipe gambar yang diunggah.' };
  }

  return { ok: true, ekstensi: EKSTENSI_SIMPAN[formatDariMime] };
}

/** Simpan berkas yang sudah tervalidasi; mengembalikan path publik /uploads/... */
export async function simpanBerkasLaporan(file, ekstensi) {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const nama = `laporan_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ekstensi}`;
  const tujuan = path.join(UPLOAD_DIR, nama);

  try {
    await fs.writeFile(tujuan, file.buffer, { flag: 'wx' });
  } catch (err) {
    await fs.unlink(tujuan).catch(() => {});
    throw err;
  }

  return `/uploads/${nama}`;
}

/** Hapus berkas yang baru dibuat bila penyimpanan laporan gagal. */
export async function hapusBerkasLaporan(foto) {
  if (typeof foto !== 'string' || !foto.startsWith('/uploads/')) return false;

  const nama = path.basename(foto);
  if (!nama || nama !== foto.slice('/uploads/'.length)) return false;

  const tujuan = path.join(UPLOAD_DIR, nama);
  if (path.dirname(tujuan) !== UPLOAD_DIR) return false;

  try {
    await fs.unlink(tujuan);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

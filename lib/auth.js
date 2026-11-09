/**
 * auth.js - Autentikasi admin sederhana berbasis token (in-memory).
 *
 * Password wajib berasal dari variabel lingkungan ADMIN_PASSWORD.
 * Tidak ada password bawaan. Nilai demo hanya diizinkan pada mode development
 * lokal; di luar development nilai demo ditolak, dan production mewajibkan
 * password yang lebih kuat.
 *
 * Catatan: token disimpan di memori proses. Restart server akan membatalkan
 * semua sesi, dan deployment multi-instance memerlukan penyimpanan sesi
 * bersama bila sesi harus berlaku lintas instance.
 */
import crypto from 'node:crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || '';
const LINGKUNGAN = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
const PANJANG_MINIMAL = 8;
const PANJANG_MINIMAL_KUAT = 12;
const POLA_KUAT = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
const MASA_BERLAKU = 1000 * 60 * 60 * 8; // 8 jam

/** token -> waktu kedaluwarsa */
const sesi = new Map();

/** Apakah login admin siap dipakai dengan konfigurasi saat ini? */
export function adminSiap() {
  if (PASSWORD.length < PANJANG_MINIMAL) return false;

  // Di luar development, password wajib lebih kuat. Dengan demikian nilai demo
  // yang pendek tetap boleh untuk lokal, tetapi ditolak di test/production.
  if (LINGKUNGAN === 'development') return true;

  return (
    PASSWORD.length >= PANJANG_MINIMAL_KUAT &&
    POLA_KUAT.every((pola) => pola.test(PASSWORD))
  );
}

function passwordCocok(input) {
  if (typeof input !== 'string') return false;

  // Panjang berbeda tetap dibandingkan dengan nilai dummy agar tidak langsung
  // memberi sinyal panjang password melalui waktu respons.
  const kiri = Buffer.from(input);
  const kanan = Buffer.from(PASSWORD);
  if (kiri.length !== kanan.length) {
    crypto.timingSafeEqual(kanan, kanan);
    return false;
  }
  return crypto.timingSafeEqual(kiri, kanan);
}

export function login(password) {
  if (!adminSiap() || !passwordCocok(password)) return null;

  const token = crypto.randomBytes(24).toString('hex');
  sesi.set(token, Date.now() + MASA_BERLAKU);
  return token;
}

export function logout(token) {
  return sesi.delete(token);
}

export function tokenValid(token) {
  if (!token) return false;
  const kedaluwarsa = sesi.get(token);
  if (!kedaluwarsa) return false;
  if (kedaluwarsa < Date.now()) {
    sesi.delete(token);
    return false;
  }
  return true;
}

function tokenDariHeader(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/** Middleware Express: wajib login admin. */
export function wajibAdmin(req, res, next) {
  const token = tokenDariHeader(req);
  if (!tokenValid(token)) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login sebagai admin.' });
  }
  req.adminToken = token;
  next();
}

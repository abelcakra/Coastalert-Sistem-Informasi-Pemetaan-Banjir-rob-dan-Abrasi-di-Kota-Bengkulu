/**
 * auth.js - Autentikasi admin sederhana berbasis token (in-memory).
 *
 * Password diambil dari variabel lingkungan ADMIN_PASSWORD.
 * Nilai bawaan "admin123" hanya untuk keperluan praktikum/demo.
 */
import crypto from 'node:crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const MASA_BERLAKU = 1000 * 60 * 60 * 8; // 8 jam

/** token -> waktu kedaluwarsa */
const sesi = new Map();

export function login(password) {
  if (typeof password !== 'string' || password !== PASSWORD) return null;
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

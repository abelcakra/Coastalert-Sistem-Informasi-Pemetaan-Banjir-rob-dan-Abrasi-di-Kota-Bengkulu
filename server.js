/**
 * server.js - CoastAlert
 * Web GIS pemetaan banjir rob & abrasi pesisir Kota Bengkulu.
 *
 * Menjalankan: npm start  (http://localhost:3000)
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

import { ROOT, UPLOAD_DIR, ensureDirs, cekKoneksi } from './lib/db.js';
import { adminSiap, login, logout, wajibAdmin } from './lib/auth.js';
import { buatRateLimiter } from './lib/rate-limit.js';

import spotsRouter from './routes/spots.js';
import reportsRouter from './routes/reports.js';
import statsRouter from './routes/stats.js';
import importRouter from './routes/import.js';
import chatRouter from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

ensureDirs();

// Sambungkan ke MySQL (Laragon). Data contoh tidak dimasukkan otomatis saat
// server start agar data dummy tidak ikut masuk ke database.
try {
  await cekKoneksi();
  console.log(`  Database MySQL tersambung: ${process.env.DB_NAME || 'coastalert'}`);
} catch (err) {
  console.error('  [PERINGATAN] Tidak dapat terhubung ke database MySQL:', err.message);
  console.error('  Jalankan MySQL lewat Laragon (tombol "Start All"), lalu `npm run db:setup` bila database belum dibuat.');
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Data titik dapat berubah setelah pembersihan; jangan biarkan peramban
// menampilkan marker lama dari cache.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Berkas statis frontend & foto unggahan
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------------------- API ----------------------
// Batasi percobaan login dari satu alamat IP untuk mengurangi brute-force.
const limiterLogin = buatRateLimiter({
  nama: 'login-admin',
  windowMs: 15 * 60 * 1000,
  max: 10,
  pesan: 'Terlalu banyak percobaan login. Silakan coba lagi beberapa saat lagi.',
});

app.post('/api/admin/login', limiterLogin, (req, res) => {
  if (!adminSiap()) {
    return res.status(503).json({
      error: 'Login admin belum dikonfigurasi. Atur ADMIN_PASSWORD pada .env/environment server sesuai kebijakan.',
    });
  }

  const token = login(String(req.body?.password || ''));
  if (!token) return res.status(401).json({ error: 'Password salah.' });
  res.json({ token });
});

app.post('/api/admin/logout', wajibAdmin, (req, res) => {
  logout(req.adminToken);
  res.json({ ok: true });
});

app.get('/api/admin/cek', wajibAdmin, (_req, res) => res.json({ ok: true }));

app.use('/api/spots', spotsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/import', importRouter);
app.use('/api/chat', chatRouter);

app.get('/api', (_req, res) => {
  res.json({
    nama: 'CoastAlert API',
    endpoints: [
      'GET  /api/spots',
      'GET  /api/spots/:id',
      'POST /api/spots (admin)',
      'PUT  /api/spots/:id (admin)',
      'DELETE /api/spots/:id (admin)',
      'POST /api/reports (publik)',
      'GET  /api/reports/lacak/:kode (publik)',
      'GET  /api/reports (admin)',
      'PATCH /api/reports/:id (admin)',
      'GET  /api/stats (publik)',
      'GET  /api/stats/admin (admin)',
      'GET  /api/stats/meta',
      'POST /api/import/geojson (admin)',
      'POST /api/import/csv (admin)',
      'POST /api/chat (HARA via Ollama)',
    ],
  });
});

// 404 untuk API yang tidak dikenal
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

// Penanganan error umum (termasuk error multer)
app.use((err, _req, res, _next) => {
  console.error(err.message);
  const status = err.status || (err instanceof multer.MulterError ? 400 : 500);
  const pesan =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? 'Terjadi kesalahan pada server.'
      : err.message || 'Terjadi kesalahan pada server.';
  res.status(status).json({ error: pesan });
});

// Jangan pernah menampilkan nilai ADMIN_PASSWORD di log.
if (adminSiap()) {
  console.log('  Admin: login aktif (ADMIN_PASSWORD tersedia).');
} else {
  console.warn(
    '  [PERINGATAN] Admin login nonaktif. Atur ADMIN_PASSWORD di .env: development minimal 8 karakter; production minimal 12 karakter dengan huruf besar, huruf kecil, angka, dan simbol.'
  );
}

// Saat NODE_ENV=test, app diimpor oleh pengujian tanpa membuka port 3000.
const server =
  process.env.NODE_ENV === 'test'
    ? null
    : app.listen(PORT, () => {
        console.log('====================================================');
        console.log('  CoastAlert - Web GIS Rob & Abrasi Kota Bengkulu');
        console.log(`  Buka: http://localhost:${PORT}`);
        console.log('====================================================');
      });

export { app, server };
export default app;

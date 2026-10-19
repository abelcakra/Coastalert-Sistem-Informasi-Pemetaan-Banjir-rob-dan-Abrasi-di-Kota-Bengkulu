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

import { ROOT, UPLOAD_DIR, ensureDirs } from './lib/db.js';
import { login, logout, wajibAdmin } from './lib/auth.js';
import { seed } from './lib/seed.js';

import spotsRouter from './routes/spots.js';
import reportsRouter from './routes/reports.js';
import statsRouter from './routes/stats.js';
import importRouter from './routes/import.js';
import chatRouter from './routes/chat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

ensureDirs();

// Sambungkan ke MySQL (Laragon) & isi data contoh bila tabel masih kosong.
try {
  const hasilSeed = await seed();
  console.log(`  Database MySQL tersambung: ${process.env.DB_NAME || 'coastalert'}`);
  if (hasilSeed.spots || hasilSeed.reports) {
    console.log(`  Data contoh dimasukkan: ${hasilSeed.spots || 0} titik, ${hasilSeed.reports || 0} laporan.`);
  }
} catch (err) {
  console.error('  [PERINGATAN] Tidak dapat terhubung ke database MySQL:', err.message);
  console.error('  Jalankan MySQL lewat Laragon (tombol "Start All"), lalu `npm run db:setup` bila database belum dibuat.');
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Berkas statis frontend & foto unggahan
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

// ---------------------- API ----------------------
app.post('/api/admin/login', (req, res) => {
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
      'GET  /api/reports (admin)',
      'PATCH /api/reports/:id (admin)',
      'GET  /api/stats',
      'GET  /api/stats/meta',
      'POST /api/import/geojson (admin)',
      'POST /api/import/csv (admin)',
      'POST /api/chat (chatbot CS via Ollama)',
    ],
  });
});

// 404 untuk API yang tidak dikenal
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

// Penanganan error umum (termasuk error multer)
app.use((err, _req, res, _next) => {
  console.error(err.message);
  const status = err instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ error: err.message || 'Terjadi kesalahan pada server.' });
});

app.listen(PORT, () => {
  console.log('====================================================');
  console.log('  CoastAlert - Web GIS Rob & Abrasi Kota Bengkulu');
  console.log(`  Buka: http://localhost:${PORT}`);
  console.log(`  Admin: password default "${process.env.ADMIN_PASSWORD || 'admin123'}"`);
  console.log('====================================================');
});

export default app;

/**
 * Phase 2 regression tests.
 *
 * Semua tes memakai database terpisah `coastalert_phase2_test` dan tidak
 * menyentuh database produksi `coastalert`.
 */
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { DDL_SPOTS, DDL_REPORTS } from './helpers/schema.mjs';

const TEST_DB = process.env.COASTALERT_TEST_DB || 'coastalert_phase2_test';
if (!/^coastalert.*_test$/.test(TEST_DB)) {
  throw new Error(`Nama database tes tidak aman: ${TEST_DB}`);
}

if (!process.env.COASTALERT_TEST_PASSWORD) {
  process.env.COASTALERT_TEST_PASSWORD = 'Phase2-Test-Password-2026';
}
process.env.ADMIN_PASSWORD = process.env.COASTALERT_TEST_PASSWORD;
process.env.NODE_ENV = 'test';
process.env.OLLAMA_URL = 'http://127.0.0.1:1';

const KONEKSI = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const DALAM = { lat: -3.772786, lng: 102.262581 };
const WAKTU = '2026-11-02T00:00:00.000Z';
const PNG_MINIMAL = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

let admin;
let setup;
let db;
let upload;
let auth;
let rateLimit;
let app;
let server;
let baseUrl;

function laporan(id, kode, status = 'pending', tambahan = {}) {
  return {
    id,
    kode,
    jenis: 'rob',
    namaPelapor: `Nama Rahasia ${kode}`,
    kontak: `08129999${kode.slice(-4)}`,
    alamat: `Alamat rahasia ${kode}`,
    kecamatan: 'Ratu Samban',
    lat: DALAM.lat,
    lng: DALAM.lng,
    deskripsi: `Deskripsi rahasia ${kode}`,
    tanggal: '2026-11-02',
    foto: null,
    status,
    catatanAdmin: status === 'ditolak' ? 'Ditolak untuk pengujian.' : '',
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...tambahan,
  };
}

async function daftarBerkas() {
  return fs.readdir(db.UPLOAD_DIR);
}

before(async () => {
  admin = await mysql.createConnection(KONEKSI);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.query(`USE \`${TEST_DB}\``);
  await admin.query('DROP TABLE IF EXISTS reports');
  await admin.query('DROP TABLE IF EXISTS spots');
  await admin.query('DROP TRIGGER IF EXISTS phase2_force_failure');
  await admin.query(DDL_SPOTS);
  await admin.query(DDL_REPORTS);

  setup = await mysql.createConnection({ ...KONEKSI, database: TEST_DB });
  process.env.DB_NAME = TEST_DB;

  db = await import('../lib/db.js');
  upload = await import('../lib/upload-laporan.js');
  auth = await import('../lib/auth.js');
  rateLimit = await import('../lib/rate-limit.js');
  ({ app } = await import('../server.js'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await setup.query('DELETE FROM reports');
  await setup.query('DELETE FROM spots');
  rateLimit.resetRateLimitUntukTes();
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db?.pool) await db.pool.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await admin.end();
  }
  if (setup) await setup.end();
});

async function loginTest() {
  const res = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  });
  const json = await res.json();
  assert.equal(res.status, 200, JSON.stringify(json));
  assert.ok(json.token);
  return json.token;
}

test('stats publik tidak membocorkan PII dan mengecualikan laporan ditolak', async () => {
  await db.insert('reports', laporan('rp_pending', 'CL-900001', 'pending'));
  await db.insert('reports', laporan('rp_verified', 'CL-900002', 'diverifikasi'));
  await db.insert('reports', laporan('rp_rejected', 'CL-900003', 'ditolak'));

  const res = await fetch(`${baseUrl}/api/stats`);
  assert.equal(res.status, 200);
  const teks = await res.text();
  const json = JSON.parse(teks);

  assert.equal(json.laporan.total, 2);
  assert.equal(json.laporan.perStatus.pending, 1);
  assert.equal(json.laporan.perStatus.diverifikasi, 1);
  assert.equal(json.laporan.perStatus.ditolak, undefined);
  assert.equal(json.laporan.terbaru, undefined);
  assert.equal(json.laporan.terverifikasi, undefined);
  assert.equal(json.ringkasan.laporanDitolak, undefined);
  assert.equal(json.ringkasan.totalLaporan, 2);

  for (const rahasia of ['Nama Rahasia', '08129999', 'Alamat rahasia', 'Deskripsi rahasia']) {
    assert.equal(teks.includes(rahasia), false, `PII "${rahasia}" bocor di /api/stats`);
  }
});

test('endpoint admin terlindungi dan tetap menerima detail lengkap', async () => {
  const tanpaToken = await fetch(`${baseUrl}/api/stats/admin`);
  assert.equal(tanpaToken.status, 401);

  await db.insert('reports', laporan('rp_pending', 'CL-900001', 'pending'));
  await db.insert('reports', laporan('rp_verified', 'CL-900002', 'diverifikasi'));
  await db.insert('reports', laporan('rp_rejected', 'CL-900003', 'ditolak'));

  const token = await loginTest();
  const res = await fetch(`${baseUrl}/api/stats/admin`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.laporan.total, 3);
  assert.equal(json.laporan.perStatus.ditolak, 1);
  assert.equal(json.ringkasan.laporanDitolak, 1);
  assert.equal(json.laporan.terbaru.length, 3);
  assert.ok(json.laporan.terbaru.some((r) => r.namaPelapor === 'Nama Rahasia CL-900003'));

  const adminReports = await fetch(`${baseUrl}/api/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(adminReports.status, 200);
  const adminJson = await adminReports.json();
  assert.equal(adminJson.jumlah, 3);
  assert.ok(adminJson.data.some((r) => r.namaPelapor === 'Nama Rahasia CL-900003'));
});

test('laporan publik hanya berisi laporan terverifikasi tanpa alamat/kontak', async () => {
  await db.insert('reports', laporan('rp_pending', 'CL-900001', 'pending'));
  await db.insert('reports', laporan('rp_verified', 'CL-900002', 'diverifikasi'));
  await db.insert('reports', laporan('rp_rejected', 'CL-900003', 'ditolak'));

  const res = await fetch(`${baseUrl}/api/reports/publik`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.jumlah, 1);
  assert.equal(json.data[0].id, 'rp_verified');
  assert.equal(json.data[0].alamat, undefined);
  assert.equal(json.data[0].namaPelapor, undefined);
  assert.equal(json.data[0].kontak, undefined);
  assert.equal(json.data[0].kecamatan, 'Ratu Samban');
});

test('pelacakan status tidak mengirim alamat, nama, atau kontak', async () => {
  await db.insert('reports', laporan('rp_rejected', 'CL-900003', 'ditolak'));

  const res = await fetch(`${baseUrl}/api/reports/lacak/CL-900003`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.status, 'ditolak');
  assert.equal(json.data.lokasi, 'Ratu Samban');
  assert.equal(json.data.alamat, undefined);
  assert.equal(json.data.namaPelapor, undefined);
  assert.equal(json.data.kontak, undefined);
});

test('password demo lama dan endpoint admin tanpa token ditolak', async () => {
  assert.equal(auth.adminSiap(), true);
  assert.equal(auth.login('admin123'), null);
  assert.equal(auth.login('salah'), null);

  const res = await fetch(`${baseUrl}/api/admin/cek`);
  assert.equal(res.status, 401);
});

test('logout membatalkan token', async () => {
  const token = await loginTest();
  const keluar = await fetch(`${baseUrl}/api/admin/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(keluar.status, 200);

  const cek = await fetch(`${baseUrl}/api/admin/cek`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(cek.status, 401);
});

test('rate limiter unit mengembalikan 429 dan Retry-After', () => {
  const limiter = rateLimit.buatRateLimiter({
    nama: 'unit-test',
    windowMs: 60_000,
    max: 2,
    pesan: 'Batas uji.',
  });
  const req = { ip: '10.0.0.1', socket: {} };
  let status = 0;
  let headers = {};
  let body = null;
  const res = {
    setHeader(k, v) {
      headers[k] = v;
    },
    status(n) {
      status = n;
      return this;
    },
    json(v) {
      body = v;
      return this;
    },
  };

  limiter(req, res, () => {});
  limiter(req, res, () => {});
  limiter(req, res, () => {});
  assert.equal(status, 429);
  assert.equal(headers['Retry-After'] > 0, true);
  assert.equal(body.error, 'Batas uji.');
});

test('upload valid diterima dan file tersimpan', async () => {
  const sebelum = new Set(await daftarBerkas());
  const form = new FormData();
  form.set('namaPelapor', 'Pelapor Upload');
  form.set('kontak', '081200000000');
  form.set('alamat', 'Alamat Upload');
  form.set('kecamatan', 'Ratu Samban');
  form.set('jenis', 'rob');
  form.set('lat', String(DALAM.lat));
  form.set('lng', String(DALAM.lng));
  form.set('deskripsi', 'Laporan dengan foto valid.');
  form.set('foto', new Blob([PNG_MINIMAL], { type: 'image/png' }), 'foto.png');

  const res = await fetch(`${baseUrl}/api/reports`, { method: 'POST', body: form });
  const json = await res.json();
  assert.equal(res.status, 201, JSON.stringify(json));
  assert.ok(json.data.foto?.startsWith('/uploads/'));
  const nama = path.basename(json.data.foto);
  assert.equal(sebelum.has(nama), false);
  await fs.access(path.join(db.UPLOAD_DIR, nama));

  await upload.hapusBerkasLaporan(json.data.foto);
});

test('upload tidak valid ditolak tanpa menyimpan file', async () => {
  const sebelum = await daftarBerkas();
  const form = new FormData();
  form.set('namaPelapor', 'Pelapor Upload');
  form.set('jenis', 'rob');
  form.set('lat', String(DALAM.lat));
  form.set('lng', String(DALAM.lng));
  form.set('deskripsi', 'Laporan dengan foto palsu.');
  form.set('foto', new Blob([Buffer.from('bukan gambar')], { type: 'image/png' }), 'foto.png');

  const res = await fetch(`${baseUrl}/api/reports`, { method: 'POST', body: form });
  assert.equal(res.status, 400);
  assert.deepEqual(await daftarBerkas(), sebelum);
});

test('kegagalan simpan laporan setelah upload membersihkan file yatim', async () => {
  const sebelum = new Set(await daftarBerkas());
  await setup.query('DROP TRIGGER IF EXISTS phase2_force_failure');
  await setup.query(`
    CREATE TRIGGER phase2_force_failure
    BEFORE INSERT ON reports
    FOR EACH ROW
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced failure'
  `);

  try {
    const form = new FormData();
    form.set('namaPelapor', 'Pelapor Gagal');
    form.set('jenis', 'rob');
    form.set('lat', String(DALAM.lat));
    form.set('lng', String(DALAM.lng));
    form.set('deskripsi', 'Simulasi kegagalan database.');
    form.set('foto', new Blob([PNG_MINIMAL], { type: 'image/png' }), 'foto.png');

    const res = await fetch(`${baseUrl}/api/reports`, { method: 'POST', body: form });
    assert.equal(res.status, 500);
    const sesudah = await daftarBerkas();
    assert.equal(sesudah.length, sebelum.size);
    assert.deepEqual(new Set(sesudah), sebelum);
  } finally {
    await setup.query('DROP TRIGGER IF EXISTS phase2_force_failure');
  }
});

test('rate limit login admin menghasilkan 429', async () => {
  await loginTest(); // satu permintaan sukses tetap dihitung
  let terakhir;
  for (let i = 0; i < 12; i += 1) {
    terakhir = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'password-salah' }),
    });
    if (terakhir.status === 429) break;
  }
  assert.equal(terakhir.status, 429);
  assert.ok(Number(terakhir.headers.get('retry-after')) > 0);
});

test('rate limit pelacakan laporan menghasilkan 429', async () => {
  let terakhir;
  for (let i = 0; i < 35; i += 1) {
    terakhir = await fetch(`${baseUrl}/api/reports/lacak/CL-000000`);
    if (terakhir.status === 429) break;
  }
  assert.equal(terakhir.status, 429);
  assert.ok(Number(terakhir.headers.get('retry-after')) > 0);
});

test('rate limit pengiriman laporan menghasilkan 429', async () => {
  let terakhir;
  for (let i = 0; i < 12; i += 1) {
    terakhir = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (terakhir.status === 429) break;
  }
  assert.equal(terakhir.status, 429);
  assert.ok(Number(terakhir.headers.get('retry-after')) > 0);
});

test('rate limit chat menghasilkan 429', async () => {
  let terakhir;
  for (let i = 0; i < 22; i += 1) {
    terakhir = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pesan: 'halo' }),
    });
    if (terakhir.status === 429) break;
  }
  assert.equal(terakhir.status, 429);
  assert.ok(Number(terakhir.headers.get('retry-after')) > 0);
});

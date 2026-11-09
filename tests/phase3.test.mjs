/**
 * Phase 3 regression tests - data integrity & reliability.
 *
 * Semua tes memakai database terpisah `coastalert_phase3_test`.
 * Database produksi `coastalert` tidak pernah dibuka oleh file ini.
 */
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { DDL_SPOTS, DDL_REPORTS } from './helpers/schema.mjs';

const jalankan = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DB = process.env.COASTALERT_TEST_DB || 'coastalert_phase3_test';
if (!/^coastalert.*_test$/.test(TEST_DB)) {
  throw new Error(`Nama database tes tidak aman: ${TEST_DB}`);
}

if (!process.env.COASTALERT_TEST_PASSWORD) {
  process.env.COASTALERT_TEST_PASSWORD = 'Phase3-Test-Password-2026';
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
const LUAR = { lat: -6.2, lng: 106.8 };
const WAKTU = '2026-11-02T00:00:00.000Z';

let admin;
let setup;
let db;
let rateLimit;
let app;
let server;
let baseUrl;
let idTitikLaporan;

function titik(id, nama, posisi = DALAM, tambahan = {}) {
  return {
    id,
    nama,
    kecamatan: 'Ratu Samban',
    jenis: 'rob',
    jenisAncaman: 'Banjir Rob',
    kategori: 'Tinggi',
    statusKoordinat: 'perkiraan',
    lat: posisi.lat,
    lng: posisi.lng,
    tinggiRob: null,
    lajuAbrasi: null,
    luasTerdampakHa: null,
    kkTerdampak: null,
    tahun: null,
    tanggal: null,
    deskripsi: 'Data uji Phase 3.',
    sumber: 'Tes',
    terverifikasi: false,
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...tambahan,
  };
}

function laporan(id, kode, status = 'pending', tambahan = {}) {
  return {
    id,
    kode,
    jenis: 'rob',
    namaPelapor: `Pelapor ${kode}`,
    kontak: '081200000000',
    alamat: `Alamat ${kode}`,
    kecamatan: 'Ratu Samban',
    lat: DALAM.lat,
    lng: DALAM.lng,
    deskripsi: `Laporan uji ${kode}.`,
    tanggal: '2026-11-02',
    foto: null,
    status,
    catatanAdmin: '',
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...tambahan,
  };
}

function feature(nama, posisi = DALAM, props = {}) {
  return {
    type: 'Feature',
    properties: {
      nama,
      jenis: 'rob',
      lat: posisi.lat,
      lng: posisi.lng,
      ...props,
    },
    geometry: {
      type: 'Point',
      coordinates: [posisi.lng, posisi.lat],
    },
  };
}

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

async function patchLaporan(id, token, body) {
  return fetch(`${baseUrl}/api/reports/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function buatTriggerTitikGagal() {
  await setup.query('DROP TRIGGER IF EXISTS phase3_gagal_titik');
  await setup.query(`
    CREATE TRIGGER phase3_gagal_titik
    BEFORE INSERT ON spots
    FOR EACH ROW
    BEGIN
      IF SUBSTRING(NEW.id, 1, 4) = 'lpr_' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced spot failure';
      END IF;
    END
  `);
}

async function buatTriggerImporGagal() {
  await setup.query('DROP TRIGGER IF EXISTS phase3_gagal_impor');
  await setup.query(`
    CREATE TRIGGER phase3_gagal_impor
    BEFORE INSERT ON spots
    FOR EACH ROW
    BEGIN
      IF NEW.id = 'forced_import_failure' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced import failure';
      END IF;
    END
  `);
}

before(async () => {
  admin = await mysql.createConnection(KONEKSI);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.query(`USE \`${TEST_DB}\``);
  await admin.query('DROP TRIGGER IF EXISTS phase3_gagal_titik');
  await admin.query('DROP TRIGGER IF EXISTS phase3_gagal_impor');
  await admin.query('DROP TABLE IF EXISTS reports');
  await admin.query('DROP TABLE IF EXISTS spots');
  await admin.query(DDL_SPOTS);
  await admin.query(DDL_REPORTS);

  setup = await mysql.createConnection({ ...KONEKSI, database: TEST_DB });
  process.env.DB_NAME = TEST_DB;

  db = await import('../lib/db.js');
  rateLimit = await import('../lib/rate-limit.js');
  ({ idTitikLaporan } = await import('../routes/reports.js'));
  ({ app } = await import('../server.js'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await setup.query('DROP TRIGGER IF EXISTS phase3_gagal_titik');
  await setup.query('DROP TRIGGER IF EXISTS phase3_gagal_impor');
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

test('verifikasi sekali membuat satu titik; verifikasi berulang tidak menduplikasi', async () => {
  const token = await loginTest();
  await db.insert('spots', titik('ca_tetap', 'Titik Tetap'));
  const sebelum = await db.find('spots', 'ca_tetap');
  await db.insert('reports', laporan('rp_verif', 'CL-930001'));

  const pertama = await patchLaporan('rp_verif', token, {
    status: 'diverifikasi',
    jadikanTitik: true,
  });
  const jsonPertama = await pertama.json();
  assert.equal(pertama.status, 200, JSON.stringify(jsonPertama));
  assert.equal(jsonPertama.data.status, 'diverifikasi');
  assert.equal(jsonPertama.spotDibuat, true);
  assert.equal(jsonPertama.spot.id, idTitikLaporan('rp_verif'));
  assert.match(jsonPertama.spot.sumber, /rp_verif/);
  assert.equal((await db.read('spots')).length, 2);

  const kedua = await patchLaporan('rp_verif', token, {
    status: 'diverifikasi',
    jadikanTitik: true,
  });
  const jsonKedua = await kedua.json();
  assert.equal(kedua.status, 200, JSON.stringify(jsonKedua));
  assert.equal(jsonKedua.spotDibuat, false);
  assert.equal(jsonKedua.spot.id, jsonPertama.spot.id);
  assert.equal((await db.read('spots')).length, 2);
  assert.deepEqual(await db.find('spots', 'ca_tetap'), sebelum);
});

test('jadikanTitik pada laporan yang sudah terverifikasi tetap idempoten', async () => {
  const token = await loginTest();
  await db.insert('reports', laporan('rp_sudah', 'CL-930002', 'diverifikasi'));

  const pertama = await patchLaporan('rp_sudah', token, { jadikanTitik: true });
  const jsonPertama = await pertama.json();
  assert.equal(pertama.status, 200, JSON.stringify(jsonPertama));
  assert.equal(jsonPertama.spotDibuat, true);
  assert.equal((await db.read('spots')).length, 1);

  const kedua = await patchLaporan('rp_sudah', token, { jadikanTitik: true });
  const jsonKedua = await kedua.json();
  assert.equal(kedua.status, 200, JSON.stringify(jsonKedua));
  assert.equal(jsonKedua.spotDibuat, false);
  assert.equal((await db.read('spots')).length, 1);
});

test('dua permintaan verifikasi bersamaan tetap menghasilkan satu titik', async () => {
  const token = await loginTest();
  await db.insert('reports', laporan('rp_balapan', 'CL-930006'));

  const [pertama, kedua] = await Promise.all([
    patchLaporan('rp_balapan', token, { status: 'diverifikasi', jadikanTitik: true }),
    patchLaporan('rp_balapan', token, { status: 'diverifikasi', jadikanTitik: true }),
  ]);
  const jsonPertama = await pertama.json();
  const jsonKedua = await kedua.json();
  assert.equal(pertama.status, 200, JSON.stringify(jsonPertama));
  assert.equal(kedua.status, 200, JSON.stringify(jsonKedua));
  assert.equal(jsonPertama.spot.id, jsonKedua.spot.id);
  assert.equal([jsonPertama.spotDibuat, jsonKedua.spotDibuat].filter(Boolean).length, 1);
  assert.equal((await db.read('spots')).length, 1);
});

test('kegagalan membuat titik membatalkan perubahan status laporan', async () => {
  const token = await loginTest();
  await db.insert('spots', titik('ca_tetap', 'Titik Tetap'));
  await db.insert('reports', laporan('rp_atomik', 'CL-930003'));
  await buatTriggerTitikGagal();

  const gagal = await patchLaporan('rp_atomik', token, {
    status: 'diverifikasi',
    jadikanTitik: true,
  });
  const jsonGagal = await gagal.json();
  assert.equal(gagal.status, 500);
  assert.match(jsonGagal.error, /forced spot failure/);

  const laporanSetelahGagal = await db.find('reports', 'rp_atomik');
  assert.equal(laporanSetelahGagal.status, 'pending');
  assert.equal((await db.read('spots')).length, 1);
  assert.equal(await db.find('spots', idTitikLaporan('rp_atomik'), { termasukArsip: true }), null);

  await setup.query('DROP TRIGGER IF EXISTS phase3_gagal_titik');
  const berhasil = await patchLaporan('rp_atomik', token, {
    status: 'diverifikasi',
    jadikanTitik: true,
  });
  const jsonBerhasil = await berhasil.json();
  assert.equal(berhasil.status, 200, JSON.stringify(jsonBerhasil));
  assert.equal(jsonBerhasil.data.status, 'diverifikasi');
  assert.equal((await db.read('spots')).length, 2);
});

test('koordinat laporan tidak valid atau kosong ditolak tanpa menyimpan laporan', async () => {
  const kirim = (lat, lng) =>
    fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        namaPelapor: 'Pelapor Koordinat',
        jenis: 'rob',
        lat,
        lng,
        deskripsi: 'Uji validasi koordinat.',
      }),
    });

  const latitude = await kirim(91, DALAM.lng);
  assert.equal(latitude.status, 400);
  assert.match((await latitude.json()).error, /Latitude/i);

  const longitude = await kirim(DALAM.lat, 181);
  assert.equal(longitude.status, 400);
  assert.match((await longitude.json()).error, /Longitude/i);

  const kosong = await kirim('', '');
  assert.equal(kosong.status, 400);
  assert.match((await kosong.json()).error, /tidak boleh kosong/i);
  assert.equal(await db.hitung('reports', { termasukArsip: true }), 0);
});

test('koordinat titik tidak valid ditolak oleh API admin', async () => {
  const token = await loginTest();
  const kirim = (lat, lng) =>
    fetch(`${baseUrl}/api/spots`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nama: 'Titik Invalid',
        jenis: 'rob',
        lat,
        lng,
      }),
    });

  const latitude = await kirim(91, DALAM.lng);
  assert.equal(latitude.status, 400);
  assert.match((await latitude.json()).error, /Latitude/i);

  const kosong = await kirim('', '');
  assert.equal(kosong.status, 400);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 0);
});

test('koordinat kosong pada import tetap null dan tidak menjadi nol', async () => {
  const { dariFeature, imporFeatures } = await import('../routes/import.js');
  const fitur = {
    type: 'Feature',
    properties: { nama: 'Import Tanpa Koordinat', jenis: 'rob', lat: '', lng: '' },
    geometry: null,
  };
  const hasil = dariFeature(fitur);
  assert.match(hasil.error, /koordinat valid/i);
  assert.equal(hasil.data, undefined);

  const ringkasan = await imporFeatures([fitur]);
  assert.equal(ringkasan.gagal, 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 0);
});

test('import berulang idempoten dan dry-run tidak menulis database', async () => {
  const contoh = feature('Titik Import Phase 3');

  const pratinjau = await import('../routes/import.js').then((m) =>
    m.imporFeatures([contoh], { dryRun: true })
  );
  assert.equal(pratinjau.berhasil, 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 0);

  const { imporFeatures } = await import('../routes/import.js');
  const pertama = await imporFeatures([contoh], { dryRun: false });
  assert.equal(pertama.berhasil, 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 1);

  const kedua = await imporFeatures([contoh], { dryRun: false });
  assert.equal(kedua.diperbarui, 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 1);
});

test('kegagalan import membatalkan seluruh batch dan menjaga data aktif/laporan', async () => {
  const { imporFeatures } = await import('../routes/import.js');
  const aktif = await db.insert('spots', titik('ca_aktif', 'Titik Aktif'));
  const laporanTetap = await db.insert('reports', laporan('rp_tetap', 'CL-930004'));
  const sebelumAktif = await db.find('spots', 'ca_aktif');
  const sebelumLaporan = await db.find('reports', 'rp_tetap');
  await buatTriggerImporGagal();

  await assert.rejects(
    () =>
      imporFeatures([
        feature('Import Baik', DALAM, { id: 'import_baik' }),
        feature('Import Gagal', DALAM, { id: 'forced_import_failure' }),
      ]),
    /forced import failure/
  );

  assert.ok(aktif);
  assert.ok(laporanTetap);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 1);
  assert.equal(await db.find('spots', 'import_baik', { termasukArsip: true }), null);
  assert.deepEqual(await db.find('spots', 'ca_aktif'), sebelumAktif);
  assert.deepEqual(await db.find('reports', 'rp_tetap'), sebelumLaporan);
});

test('API import gagal mengembalikan error dan tidak menyisakan data parsial', async () => {
  const token = await loginTest();
  await buatTriggerImporGagal();

  const res = await fetch(`${baseUrl}/api/import/geojson`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'FeatureCollection',
      features: [
        feature('Import API Baik', DALAM, { id: 'import_api_baik' }),
        feature('Import API Gagal', DALAM, { id: 'forced_import_failure' }),
      ],
    }),
  });
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /forced import failure/);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 0);
});

test('titik di luar batas tidak masuk data aktif dan data aktif lain tetap ada', async () => {
  const { imporFeatures } = await import('../routes/import.js');
  await db.insert('spots', titik('ca_aktif', 'Titik Aktif'));

  const hasil = await imporFeatures(
    [feature('Titik Luar Phase 3', LUAR, { id: 'import_luar' })],
    { dryRun: false }
  );
  assert.equal(hasil.berhasil, 1);
  assert.equal(hasil.diarsipkan, 1);
  assert.equal(await db.hitung('spots'), 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 2);
  const luar = await db.find('spots', 'import_luar', { termasukArsip: true });
  assert.equal(luar.statusLokasi, 'luar');
});

test('write() dapat memakai transaksi luar untuk spots dan reports sekaligus', async () => {
  await assert.rejects(
    () =>
      db.transaksi(async (koneksi) => {
        await db.write('spots', [titik('ca_tx', 'Titik Transaksi')], { koneksi });
        await db.write('reports', [laporan('rp_tx', 'CL-930005')], { koneksi });
        throw new Error('rollback transaksi gabungan');
      }),
    /rollback transaksi gabungan/
  );

  assert.equal(await db.hitung('spots', { termasukArsip: true }), 0);
  assert.equal(await db.hitung('reports', { termasukArsip: true }), 0);
});

test('dry-run import-dataset membaca data tanpa menulis database uji', async () => {
  const { stdout } = await jalankan(
    process.execPath,
    [path.join(ROOT, 'scripts', 'import-dataset.mjs'), '--dry-run'],
    {
      cwd: ROOT,
      env: { ...process.env, DB_NAME: TEST_DB },
    }
  );
  assert.match(stdout, /Mode --dry-run: tidak ada data yang ditulis ke database/);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 0);
  assert.equal(await db.hitung('reports', { termasukArsip: true }), 0);
});

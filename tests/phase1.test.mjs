/**
 * Phase 1 regression tests.
 *
 * Semua tes memakai database terpisah `coastalert_phase1_test`.
 * Database produksi `coastalert` tidak pernah dibuka oleh file ini.
 */
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { DDL_SPOTS, DDL_REPORTS } from './helpers/schema.mjs';

const TEST_DB = process.env.COASTALERT_TEST_DB || 'coastalert_phase1_test';
if (!/^coastalert.*_test$/.test(TEST_DB)) {
  throw new Error(`Nama database tes tidak aman: ${TEST_DB}`);
}

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
let normalisasi;
let dariFeature;
let imporFeatures;
let normalisasiAngkaLaporan;
let normalisasiTeks;

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
    deskripsi: 'Data uji Phase 1.',
    sumber: 'Tes',
    terverifikasi: false,
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...tambahan,
  };
}

function laporan(id, kode) {
  return {
    id,
    kode,
    jenis: 'rob',
    namaPelapor: 'Pelapor Uji',
    kontak: '',
    alamat: '',
    kecamatan: 'Ratu Samban',
    lat: DALAM.lat,
    lng: DALAM.lng,
    deskripsi: 'Laporan uji Phase 1.',
    tanggal: null,
    foto: null,
    status: 'pending',
    catatanAdmin: null,
    createdAt: WAKTU,
    updatedAt: WAKTU,
  };
}

before(async () => {
  admin = await mysql.createConnection(KONEKSI);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.query(`USE \`${TEST_DB}\``);
  await admin.query('DROP TABLE IF EXISTS reports');
  await admin.query('DROP TABLE IF EXISTS spots');
  await admin.query(DDL_SPOTS);
  await admin.query(DDL_REPORTS);
  await admin.query('DROP TRIGGER IF EXISTS phase1_force_failure');
  await admin.query(`
    CREATE TRIGGER phase1_force_failure
    BEFORE INSERT ON spots
    FOR EACH ROW
    BEGIN
      IF NEW.id = 'forced_failure' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced failure';
      END IF;
    END
  `);

  setup = await mysql.createConnection({ ...KONEKSI, database: TEST_DB });
  process.env.DB_NAME = TEST_DB;

  db = await import('../lib/db.js');
  ({ normalisasi } = await import('../routes/spots.js'));
  ({ dariFeature, imporFeatures } = await import('../routes/import.js'));
  ({ normalisasiAngka: normalisasiAngkaLaporan } = await import('../routes/reports.js'));
  ({ normalisasiTeks } = await import('../lib/normalisasi.js'));
});

beforeEach(async () => {
  await setup.query('DELETE FROM spots');
  await setup.query('DELETE FROM reports');
});

after(async () => {
  if (db?.pool) await db.pool.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await admin.end();
  }
  if (setup) await setup.end();
});

test('hitung() menghitung titik aktif dan menyediakan opsi arsip', async () => {
  await db.insert('spots', titik('ca_test_aktif', 'Aktif'));
  await db.insert('spots', titik('ca_test_arsip', 'Arsip', LUAR));

  assert.equal(await db.hitung('spots'), 1);
  assert.equal(await db.hitung('spots', { hanyaArsip: true }), 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 2);
});

test('write() upsert memperbarui baris tanpa menghapus arsip', async () => {
  await db.insert('spots', titik('ca_test_aktif', 'Aktif'));
  await db.insert('spots', titik('ca_test_arsip', 'Arsip', LUAR));

  await db.write('spots', [{ id: 'ca_test_aktif', nama: 'Aktif Diperbarui' }], {
    mode: 'upsert',
  });

  const aktif = await db.find('spots', 'ca_test_aktif');
  const arsip = await db.find('spots', 'ca_test_arsip', { termasukArsip: true });
  assert.equal(aktif.nama, 'Aktif Diperbarui');
  assert.equal(arsip.nama, 'Arsip');
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 2);
});

test('write() rollback seluruh transaksi bila satu baris gagal', async () => {
  await db.insert('spots', titik('ca_test_aktif', 'Nama Asli'));

  await assert.rejects(
    () =>
      db.write('spots', [
        { id: 'ca_test_aktif', nama: 'Nama Berubah' },
        titik('forced_failure', 'Gagal'),
      ]),
    /forced failure/
  );

  const aktif = await db.find('spots', 'ca_test_aktif');
  assert.equal(aktif.nama, 'Nama Asli');
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 1);
});

test('write() replace menghapus titik aktif yang hilang tetapi mempertahankan arsip', async () => {
  await db.insert('spots', titik('ca_test_satu', 'Satu'));
  await db.insert('spots', titik('ca_test_dua', 'Dua'));
  await db.insert('spots', titik('ca_test_arsip', 'Arsip', LUAR));

  await db.write('spots', [{ id: 'ca_test_satu', nama: 'Satu Baru' }], {
    mode: 'replace',
    preserveArchives: true,
  });

  const aktif = await db.read('spots');
  assert.equal(aktif.length, 1);
  assert.equal(aktif[0].id, 'ca_test_satu');
  assert.equal(aktif[0].nama, 'Satu Baru');
  assert.ok(await db.find('spots', 'ca_test_arsip', { termasukArsip: true }));
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 2);
});

test('seed --force memerlukan konfirmasi eksplisit', async () => {
  const { seed } = await import('../lib/seed.js');
  await assert.rejects(() => seed({ force: true }), /--yes/);
});

test('write() upsert laporan kosong tidak menghapus laporan lama', async () => {
  await db.insert('reports', laporan('rp_test_satu', 'CL-111111'));

  await db.write('reports', [], { mode: 'upsert' });

  const rows = await db.read('reports', { termasukArsip: true });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'rp_test_satu');
});

test('nilai kosong menjadi null dan nol eksplisit tetap 0 pada routes/spots', () => {
  const kosong = normalisasi({
    nama: 'Titik Kosong',
    jenis: 'rob',
    lat: DALAM.lat,
    lng: DALAM.lng,
    tinggiRob: '',
    lajuAbrasi: '',
    luasTerdampakHa: '',
    kkTerdampak: '',
    tahun: '',
  });

  assert.deepEqual(kosong.errors, []);
  assert.equal(kosong.data.tinggiRob, null);
  assert.equal(kosong.data.lajuAbrasi, null);
  assert.equal(kosong.data.luasTerdampakHa, null);
  assert.equal(kosong.data.kkTerdampak, null);
  assert.equal(kosong.data.tahun, null);

  const nol = normalisasi({
    nama: 'Titik Nol',
    jenis: 'rob',
    lat: DALAM.lat,
    lng: DALAM.lng,
    tinggiRob: '0',
    kkTerdampak: '0',
    tahun: '0',
  });

  assert.deepEqual(nol.errors, []);
  assert.equal(nol.data.tinggiRob, 0);
  assert.equal(nol.data.kkTerdampak, 0);
  assert.equal(nol.data.tahun, 0);
});

test('normalisasi angka dan teks mempertahankan nilai kosong serta nol eksplisit', () => {
  assert.equal(normalisasiAngkaLaporan(''), null);
  assert.equal(normalisasiAngkaLaporan('   '), null);
  assert.equal(normalisasiAngkaLaporan(undefined), null);
  assert.equal(normalisasiAngkaLaporan(null), null);
  assert.equal(normalisasiAngkaLaporan('0'), 0);
  assert.equal(normalisasiAngkaLaporan(0), 0);
  assert.equal(normalisasiAngkaLaporan('12,5'), 12.5);
  assert.equal(normalisasiAngkaLaporan('bukan angka'), null);
  assert.equal(normalisasiAngkaLaporan(Infinity), null);

  assert.equal(normalisasiTeks(undefined), '');
  assert.equal(normalisasiTeks(null), '');
  assert.equal(normalisasiTeks('  teks  '), 'teks');
  assert.equal(normalisasiTeks(0), '0');
});

test('nilai kosong menjadi null dan nol eksplisit tetap 0 pada import GeoJSON', () => {
  const feature = {
    type: 'Feature',
    properties: {
      nama: 'Titik Impor',
      jenis: 'rob',
      lat: DALAM.lat,
      lng: DALAM.lng,
      tahun: '',
      kkTerdampak: '',
    },
    geometry: { type: 'Point', coordinates: [DALAM.lng, DALAM.lat] },
  };

  const kosong = dariFeature(feature);
  assert.equal(kosong.data.tahun, null);
  assert.equal(kosong.data.kkTerdampak, null);
  assert.equal(kosong.data.tinggiRob, null);

  const nol = dariFeature({
    ...feature,
    properties: { ...feature.properties, tahun: '0', kkTerdampak: '0', tinggiRob: '0' },
  });
  assert.equal(nol.data.tahun, 0);
  assert.equal(nol.data.kkTerdampak, 0);
  assert.equal(nol.data.tinggiRob, 0);
});

test('import API idempoten dan dry-run tidak menulis database', async () => {
  const feature = {
    type: 'Feature',
    properties: {
      nama: 'Titik Import Berulang',
      jenis: 'rob',
      lat: DALAM.lat,
      lng: DALAM.lng,
    },
    geometry: { type: 'Point', coordinates: [DALAM.lng, DALAM.lat] },
  };

  const pratinjau = await imporFeatures([feature], { dryRun: true });
  assert.equal(pratinjau.berhasil, 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 0);

  const pertama = await imporFeatures([feature], { dryRun: false });
  assert.equal(pertama.berhasil, 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 1);

  const kedua = await imporFeatures([feature], { dryRun: false });
  assert.equal(kedua.diperbarui, 1);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 1);
});

test('titik di luar batas disimpan sebagai arsip, bukan ditolak', async () => {
  const feature = {
    type: 'Feature',
    properties: {
      nama: 'Titik Luar',
      jenis: 'rob',
      lat: LUAR.lat,
      lng: LUAR.lng,
    },
    geometry: { type: 'Point', coordinates: [LUAR.lng, LUAR.lat] },
  };

  const hasil = await imporFeatures([feature], { dryRun: false });
  assert.equal(hasil.berhasil, 1);
  assert.equal(hasil.diarsipkan, 1);
  assert.equal(await db.hitung('spots'), 0);
  assert.equal(await db.hitung('spots', { termasukArsip: true }), 1);
});

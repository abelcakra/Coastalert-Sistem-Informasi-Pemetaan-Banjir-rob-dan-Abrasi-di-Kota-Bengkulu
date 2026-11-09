/**
 * Uji mekanisme penghapusan arsip pada database uji terpisah.
 *
 * Tes ini TIDAK menyentuh database produksi dan TIDAK mengubah
 * data/arsip/spots-di-luar-batas.json asli. File JSON arsip diarahkan ke
 * direktori sementara melalui ARSIP_JSON_PATH.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { klasifikasiTitik } from '../lib/wilayah.js';
import { ddlSpots, ddlReports } from './helpers/schema.mjs';

const jalankan = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DB = process.env.COASTALERT_ARSIP_TEST_DB || 'coastalert_phase2_arsip_test';
if (!/^coastalert.*_test$/.test(TEST_DB)) {
  throw new Error(`Nama database tes tidak aman: ${TEST_DB}`);
}

const KONEKSI = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

const DDL_SPOTS = ddlSpots({ indexes: false });
const DDL_REPORTS = ddlReports({ indexes: false });

const DALAM = { lat: -3.772786, lng: 102.262581 };
const LUAR = { lat: -6.2, lng: 106.8 };
const ASLI_ARSIP = path.join(ROOT, 'data', 'arsip', 'spots-di-luar-batas.json');

let admin;
let setup;
let temp;
let archivePath;
let backupPath;
let idsAktif;
let isiAsli;

before(async () => {
  admin = await mysql.createConnection(KONEKSI);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${TEST_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.query(`USE \`${TEST_DB}\``);
  await admin.query('DROP TABLE IF EXISTS reports');
  await admin.query('DROP TABLE IF EXISTS spots');
  await admin.query(DDL_SPOTS);
  await admin.query(DDL_REPORTS);

  setup = await mysql.createConnection({ ...KONEKSI, database: TEST_DB });

  // 57 titik aktif + 16 titik di luar batas + 1 laporan.
  const nilaiAktif = [];
  idsAktif = [];
  for (let i = 1; i <= 57; i += 1) {
    const id = `ca_test_aktif_${String(i).padStart(2, '0')}`;
    idsAktif.push(id);
    nilaiAktif.push([id, `Aktif ${i}`, 'rob', DALAM.lat, DALAM.lng]);
  }
  const nilaiArsip = [];
  const daftarArsip = [];
  for (let i = 1; i <= 16; i += 1) {
    const id = `ca_test_arsip_${String(i).padStart(2, '0')}`;
    nilaiArsip.push([id, `Arsip ${i}`, 'abrasi', LUAR.lat, LUAR.lng]);
    daftarArsip.push({ id, nama: `Arsip ${i}`, alasan: 'Di luar batas administrasi Kota Bengkulu.' });
  }
  await setup.query(
    'INSERT INTO spots (id, nama, jenis, lat, lng) VALUES ?',
    [[...nilaiAktif, ...nilaiArsip]]
  );
  await setup.query(
    `INSERT INTO reports (id, kode, jenis, namaPelapor, lat, lng, status)
     VALUES ('rp_test_arsip', 'CL-999999', 'rob', 'Pelapor Uji', ?, ?, 'ditolak')`,
    [DALAM.lat, DALAM.lng]
  );

  isiAsli = await fs.readFile(ASLI_ARSIP, 'utf8');
  temp = await fs.mkdtemp(path.join(os.tmpdir(), 'coastalert-arsip-'));
  archivePath = path.join(temp, 'spots-di-luar-batas.json');
  backupPath = path.join(temp, 'backup');
  await fs.writeFile(archivePath, JSON.stringify(daftarArsip, null, 2), 'utf8');
  await fs.mkdir(backupPath, { recursive: true });
  await fs.writeFile(
    path.join(backupPath, 'metadata.json'),
    JSON.stringify({
      arsipIds: daftarArsip.map((s) => s.id),
      checksumsSha256: {},
    }),
    'utf8'
  );
  await fs.writeFile(
    path.join(backupPath, 'verification.json'),
    JSON.stringify({ idsCocok: true, spotsDb: 73, reportsDb: 1, arsipJson: 16 }),
    'utf8'
  );
});

after(async () => {
  if (setup) await setup.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
    await admin.end();
  }
  if (temp) await fs.rm(temp, { recursive: true, force: true });
  // Pastikan file arsip asli tidak pernah berubah.
  assert.equal(await fs.readFile(ASLI_ARSIP, 'utf8'), isiAsli);
});

test('penghapusan arsip hanya menghapus 16 target dan menjaga 57 titik aktif + 1 laporan', async () => {
  const { stdout } = await jalankan(
    process.execPath,
    [
      path.join(ROOT, 'scripts', 'hapus-arsip-luar-batas.mjs'),
      '--execute',
      '--yes',
      '--backup',
      backupPath,
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DB_NAME: TEST_DB,
        ARSIP_JSON_PATH: archivePath,
      },
    }
  );
  assert.match(stdout, /Penghapusan selesai/);

  const [rows] = await setup.query('SELECT * FROM spots ORDER BY id');
  assert.equal(rows.length, 57);
  assert.ok(rows.every((r) => klasifikasiTitik(r.lat, r.lng).status === 'dalam'));
  assert.deepEqual(
    rows.map((r) => r.id).sort(),
    [...idsAktif].sort()
  );

  const [[laporan]] = await setup.query('SELECT COUNT(*) AS n FROM reports');
  assert.equal(Number(laporan.n), 1);
  assert.deepEqual(JSON.parse(await fs.readFile(archivePath, 'utf8')), []);
});

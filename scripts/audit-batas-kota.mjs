/**
 * audit-batas-kota.mjs - Audit semua sumber titik terhadap batas Kota Bengkulu.
 *
 * Jalankan: node scripts/audit-batas-kota.mjs
 * Hasil rinci ditulis ke backup/<tanggal>-before-batas-kota/audit-sebelum.json
 * (folder backup tidak dianggap data aktif aplikasi).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { klasifikasiTitik } from '../lib/wilayah.js';
import { read, pool } from '../lib/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FOLDER_BACKUP = path.join(ROOT, 'backup', '20261101-before-batas-kota');

function bacaJson(relatif) {
  const berkas = path.join(ROOT, relatif);
  return fs.existsSync(berkas) ? JSON.parse(fs.readFileSync(berkas, 'utf8')) : [];
}

function bacaCsv(relatif) {
  const berkas = path.join(ROOT, relatif);
  if (!fs.existsSync(berkas)) return [];
  const baris = fs
    .readFileSync(berkas, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((b) => b.trim())
    .map((b) => b.split(','));
  if (baris.length < 2) return [];
  const header = baris[0].map((h) => h.trim());
  return baris.slice(1).map((nilai) => Object.fromEntries(header.map((h, i) => [h, nilai[i]])));
}

function audit(rows, sumber) {
  const hasil = { sumber, total: rows.length, dalam: [], luar: [], manual: [] };

  for (const row of rows) {
    const posisi = klasifikasiTitik(row.lat, row.lng);
    hasil[posisi.status].push({
      ...row,
      alasan:
        posisi.alasan ||
        (posisi.status === 'luar' ? 'Di luar polygon batas Kota Bengkulu.' : undefined),
    });
  }

  const perJenis = { rob: 0, abrasi: 0 };
  const perJenisLuar = { rob: 0, abrasi: 0 };
  for (const row of [...hasil.dalam, ...hasil.luar, ...hasil.manual]) {
    perJenis[row.jenis] = (perJenis[row.jenis] || 0) + 1;
  }
  for (const row of hasil.luar) {
    perJenisLuar[row.jenis] = (perJenisLuar[row.jenis] || 0) + 1;
  }

  return {
    ...hasil,
    ringkas: {
      total: hasil.total,
      dalam: hasil.dalam.length,
      luar: hasil.luar.length,
      manual: hasil.manual.length,
      perJenis,
      perJenisLuar,
    },
  };
}

const dbSpots = await read('spots', { termasukArsip: true });
const dbReports = await read('reports', { termasukArsip: true });

const contohGeoJson = bacaJson('contoh-data/contoh-titik.geojson');
const fiturContoh = (contohGeoJson.type === 'FeatureCollection'
  ? contohGeoJson.features
  : contohGeoJson.type === 'Feature'
    ? [contohGeoJson]
    : []
).map((f) => ({
  id: f.properties?.id,
  nama: f.properties?.nama,
  jenis: f.properties?.jenis,
  lat: f.geometry?.coordinates?.[1],
  lng: f.geometry?.coordinates?.[0],
}));

const auditData = {
  dibuat: new Date().toISOString(),
  batas: 'data/gea/sumber/batas_kota_bengkulu.geojson',
  metode: 'point-in-polygon ray casting; MultiPolygon dan lubang; titik di garis batas = dalam',
  sumber: [
    audit(bacaJson('data/spots.json'), 'data/spots.json'),
    audit(bacaJson('data/reports.json'), 'data/reports.json'),
    audit(dbSpots, 'database.spots'),
    audit(dbReports, 'database.reports'),
    audit(bacaJson('dataset/coastalalert-2021-2025/spots.json'), 'dataset/coastalalert-2021-2025/spots.json'),
    audit(bacaJson('dataset/coastalalert-2021-2025/reports.json'), 'dataset/coastalalert-2021-2025/reports.json'),
    audit(fiturContoh, 'contoh-data/contoh-titik.geojson'),
    audit(bacaCsv('contoh-data/contoh-titik.csv'), 'contoh-data/contoh-titik.csv'),
  ],
};

fs.mkdirSync(FOLDER_BACKUP, { recursive: true });
const berkasAudit = path.join(FOLDER_BACKUP, 'audit-terbaru.json');
fs.writeFileSync(berkasAudit, JSON.stringify(auditData, null, 2));

for (const item of auditData.sumber) {
  console.log(
    `${item.sumber.padEnd(55)} total=${String(item.ringkas.total).padEnd(3)} ` +
      `dalam=${String(item.ringkas.dalam).padEnd(3)} luar=${String(item.ringkas.luar).padEnd(3)} ` +
      `manual=${item.ringkas.manual}`
  );
}

const aktif = auditData.sumber.find((x) => x.sumber === 'data/spots.json');
if (aktif?.luar.length) {
  console.log('\nTitik di luar batas pada data/spots.json:');
  for (const row of aktif.luar) {
    console.log(`- ${row.id} | ${row.jenis} | ${row.lat},${row.lng} | ${row.nama}`);
  }
}

console.log(`\nRincian audit: ${path.relative(ROOT, berkasAudit)}`);
await pool.end();

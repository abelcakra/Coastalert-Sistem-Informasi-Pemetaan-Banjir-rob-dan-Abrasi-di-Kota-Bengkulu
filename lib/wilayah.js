/**
 * wilayah.js - Uji lokasi titik terhadap batas administrasi Kota Bengkulu.
 *
 * Batas resmi dibaca dari data/gea/sumber/batas_kota_bengkulu.geojson.
 * Uji memakai point-in-polygon (ray casting) pada seluruh cincin polygon,
 * termasuk lubang dan MultiPolygon. Titik yang tepat berada di garis batas
 * tetap dianggap berada di dalam Kota Bengkulu.
 *
 * Modul ini sengaja tidak memakai perbandingan bounding box saja.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const BATAS_KOTA_PATH =
  process.env.BATAS_KOTA_PATH ||
  path.join(ROOT, 'data', 'gea', 'sumber', 'batas_kota_bengkulu.geojson');

/** Toleransi kecil untuk menentukan titik yang tepat di segmen garis batas. */
const EPS = 1e-12;

function bacaGeometry() {
  const isi = JSON.parse(fs.readFileSync(BATAS_KOTA_PATH, 'utf8'));

  if (isi.type === 'FeatureCollection') {
    return (isi.features || []).flatMap((f) => daftarPoligon(f.geometry));
  }
  if (isi.type === 'Feature') return daftarPoligon(isi.geometry);
  return daftarPoligon(isi);
}

/** Kembalikan daftar polygon; setiap polygon adalah array cincin [outer, ...holes]. */
function daftarPoligon(geometry) {
  if (!geometry || !geometry.type || !geometry.coordinates) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  if (geometry.type === 'GeometryCollection') {
    return (geometry.geometries || []).flatMap((g) => daftarPoligon(g));
  }
  return [];
}

const POLIGON = bacaGeometry();

if (!POLIGON.length) {
  throw new Error(`Tidak ada polygon pada berkas batas: ${BATAS_KOTA_PATH}`);
}

/** Apakah titik (x, y) berada pada segmen garis a-b. */
function diSegmen(x, y, ax, ay, bx, by) {
  const minX = Math.min(ax, bx) - EPS;
  const maxX = Math.max(ax, bx) + EPS;
  const minY = Math.min(ay, by) - EPS;
  const maxY = Math.max(ay, by) + EPS;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;

  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  if (Math.abs(cross) > EPS) return false;

  const dot = (x - ax) * (x - bx) + (y - ay) * (y - by);
  return dot <= EPS;
}

/**
 * Posisi titik terhadap satu cincin.
 * Hasil: 'tepi' | 'dalam' | 'luar'.
 */
function posisiDiCincin(lng, lat, ring) {
  let dalam = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (diSegmen(lng, lat, xi, yi, xj, yj)) return 'tepi';

    const memotong =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (memotong) dalam = !dalam;
  }

  return dalam ? 'dalam' : 'luar';
}

/**
 * Klasifikasi lokasi terhadap seluruh batas Kota Bengkulu.
 *
 * @param {unknown} lat
 * @param {unknown} lng
 * @returns {{status: 'dalam'|'luar'|'manual', alasan?: string}}
 */
export function klasifikasiTitik(lat, lng) {
  if (lat === null || lat === undefined || lat === '' || lng === null || lng === undefined || lng === '') {
    return { status: 'manual', alasan: 'Koordinat kosong.' };
  }

  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    return { status: 'manual', alasan: 'Koordinat bukan angka yang valid.' };
  }
  if (la < -90 || la > 90) return { status: 'manual', alasan: 'Latitude di luar rentang -90..90.' };
  if (ln < -180 || ln > 180) return { status: 'manual', alasan: 'Longitude di luar rentang -180..180.' };

  for (const poly of POLIGON) {
    const outer = posisiDiCincin(ln, la, poly[0]);
    if (outer === 'tepi') return { status: 'dalam' };
    if (outer !== 'dalam') continue;

    let diLubang = false;
    for (const hole of poly.slice(1)) {
      const posisi = posisiDiCincin(ln, la, hole);
      if (posisi === 'tepi') return { status: 'dalam' };
      if (posisi === 'dalam') {
        diLubang = true;
        break;
      }
    }

    if (!diLubang) return { status: 'dalam' };
  }

  return { status: 'luar' };
}

/** True hanya bila koordinat valid dan berada di dalam/tepi Kota Bengkulu. */
export function titikDiDalamKota(lat, lng) {
  return klasifikasiTitik(lat, lng).status === 'dalam';
}

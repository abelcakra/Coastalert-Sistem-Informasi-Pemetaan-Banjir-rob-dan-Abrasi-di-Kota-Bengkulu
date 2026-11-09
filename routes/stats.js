/**
 * routes/stats.js - Agregasi statistik untuk dashboard & metadata filter.
 *
 * Prinsip data:
 * - `spots` adalah catatan sumber, belum tentu kejadian unik terverifikasi.
 * - Kategori risiko mengikuti klasifikasi sumber (Rendah/Sedang/Tinggi),
 *   walaupun catatan belum diverifikasi oleh admin.
 * - Catatan tanpa kategori tidak dimasukkan ke Rendah/Sedang/Tinggi.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { read, ROOT } from '../lib/db.js';
import { wajibAdmin } from '../lib/auth.js';
import { KATEGORI } from '../lib/normalisasi.js';

const router = Router();

const STATS_GEA = path.join(ROOT, 'data', 'gea', 'gea-stats.json');

/** Statistik raster GEA hasil olahan offline; tidak dicampur dengan data titik. */
async function bacaStatsGea() {
  try {
    return JSON.parse(await readFile(STATS_GEA, 'utf8'));
  } catch {
    return null;
  }
}

const rata = (angka) => {
  const valid = angka.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
};

const totalAtauNull = (angka) => {
  const valid = angka.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return Number(valid.reduce((a, b) => a + b, 0).toFixed(1));
};

const sebaranKosong = () => ({
  rob: { Rendah: 0, Sedang: 0, Tinggi: 0 },
  abrasi: { Rendah: 0, Sedang: 0, Tinggi: 0 },
});

/**
 * Statistik laporan warga.
 *
 * Mode publik hanya mengembalikan agregat dan tidak pernah mengirim nama,
 * kontak, alamat, koordinat, deskripsi, atau daftar laporan. Laporan berstatus
 * `ditolak` juga tidak dihitung/disertakan pada statistik publik.
 * Mode admin (dipakai endpoint terproteksi) tetap menyertakan daftar lengkap.
 */
function statistikLaporan(reports, { publik = false } = {}) {
  const sumber = publik ? reports.filter((r) => r.status !== 'ditolak') : reports;
  const perStatus = publik
    ? { pending: 0, diverifikasi: 0 }
    : { pending: 0, diverifikasi: 0, ditolak: 0 };
  const perJenis = { rob: 0, abrasi: 0 };
  const perBulan = {};

  for (const r of sumber) {
    perStatus[r.status] = (perStatus[r.status] || 0) + 1;
    perJenis[r.jenis] = (perJenis[r.jenis] || 0) + 1;

    const bulan = String(r.createdAt || r.tanggal || '').slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(bulan)) continue;
    perBulan[bulan] ||= { bulan, rob: 0, abrasi: 0, total: 0 };
    perBulan[bulan][r.jenis] += 1;
    perBulan[bulan].total += 1;
  }

  const urutTerbaru = [...sumber].sort((a, b) =>
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );

  const ringkas = (r) => ({
    id: r.id,
    jenis: r.jenis,
    namaPelapor: r.namaPelapor,
    kontak: r.kontak,
    alamat: r.alamat,
    kecamatan: r.kecamatan,
    lat: r.lat,
    lng: r.lng,
    deskripsi: r.deskripsi,
    tanggal: r.tanggal,
    foto: r.foto,
    status: r.status,
    createdAt: r.createdAt,
  });

  const hasil = {
    total: sumber.length,
    perStatus,
    perJenis,
    trenPerBulan: Object.values(perBulan).sort((a, b) => a.bulan.localeCompare(b.bulan)),
  };

  if (!publik) {
    hasil.terverifikasi = urutTerbaru.filter((r) => r.status === 'diverifikasi').map(ringkas);
    hasil.menunggu = urutTerbaru.filter((r) => r.status === 'pending').map(ringkas);
    hasil.terbaru = urutTerbaru.slice(0, 5).map(ringkas);
  }

  return hasil;
}

/** Bangun statistik yang sama untuk dashboard publik dan admin. */
async function bangunStatistik({ publik = true } = {}) {
  const [spots, reports, gea] = await Promise.all([
    read('spots'),
    read('reports'),
    bacaStatsGea(),
  ]);

  const rob = spots.filter((s) => s.jenis === 'rob');
  const abrasi = spots.filter((s) => s.jenis === 'abrasi');
  const terverifikasi = spots.filter((s) => s.terverifikasi);
  const belumVerifikasi = spots.filter((s) => !s.terverifikasi);

  // Distribusi teks jenis ancaman persis dari CSV/sumber, tanpa menyamakan
  // "Abrasi dan Gelombang Ekstrim" dengan kategori lain.
  const perJenisAncaman = {};
  for (const s of spots) {
    const nama = s.jenisAncaman || (s.jenis === 'abrasi' ? 'Abrasi' : 'Banjir Rob');
    perJenisAncaman[nama] = (perJenisAncaman[nama] || 0) + 1;
  }

  // Rekap per kecamatan (jumlah catatan sumber rob & abrasi).
  const kecamatan = {};
  for (const s of spots) {
    const nama = s.kecamatan || 'Tidak diketahui';
    kecamatan[nama] ||= {
      kecamatan: nama,
      rob: 0,
      abrasi: 0,
      total: 0,
      terverifikasi: 0,
      belumVerifikasi: 0,
    };
    kecamatan[nama][s.jenis] += 1;
    kecamatan[nama].total += 1;
    if (s.terverifikasi) kecamatan[nama].terverifikasi += 1;
    else kecamatan[nama].belumVerifikasi += 1;
  }

  // Kategori risiko berasal dari klasifikasi sumber, bukan hanya catatan yang
  // sudah diverifikasi admin. Status verifikasi tetap dihitung terpisah.
  const perKategori = Object.fromEntries(KATEGORI.map((k) => [k, 0]));
  const sebaranKategori = sebaranKosong();
  for (const s of spots) {
    if (!KATEGORI.includes(s.kategori)) continue;
    perKategori[s.kategori] += 1;
    if (sebaranKategori[s.jenis]) sebaranKategori[s.jenis][s.kategori] += 1;
  }

  const perStatusKoordinat = {
    perkiraan: 0,
    referensi_lokasi: 0,
    terverifikasi: 0,
    tidak_diketahui: 0,
  };
  for (const s of spots) {
    if (s.statusKoordinat in perStatusKoordinat) perStatusKoordinat[s.statusKoordinat] += 1;
    else perStatusKoordinat.tidak_diketahui += 1;
  }

  // Tren per tahun: jumlah catatan + rata-rata hanya bila nilai ukur tersedia.
  const tahun = {};
  for (const s of spots) {
    const t = s.tahun || 'Tidak diketahui';
    tahun[t] ||= { tahun: t, rob: 0, abrasi: 0, tinggiRob: [], lajuAbrasi: [] };
    tahun[t][s.jenis] += 1;
    tahun[t].tinggiRob.push(s.tinggiRob);
    tahun[t].lajuAbrasi.push(s.lajuAbrasi);
  }

  const tren = Object.values(tahun)
    .sort((a, b) => String(a.tahun).localeCompare(String(b.tahun)))
    .map((t) => ({
      tahun: t.tahun,
      rob: t.rob,
      abrasi: t.abrasi,
      rataTinggiRob: rata(t.tinggiRob),
      rataLajuAbrasi: rata(t.lajuAbrasi),
    }));

  const laporan = statistikLaporan(reports, { publik });

  const ringkasan = {
    totalTitik: spots.length,
    totalCatatan: spots.length,
    totalRob: rob.length,
    totalAbrasi: abrasi.length,
    totalKejadianTerverifikasi: terverifikasi.length,
    totalBelumVerifikasi: belumVerifikasi.length,
    totalKoordinatPerkiraan: perStatusKoordinat.perkiraan,
    totalKoordinatReferensi: perStatusKoordinat.referensi_lokasi,
    totalKoordinatTerverifikasi: perStatusKoordinat.terverifikasi,
    totalLaporan: laporan.total,
    laporanPending: laporan.perStatus.pending,
    laporanTerverifikasi: laporan.perStatus.diverifikasi,
    totalKK: totalAtauNull(spots.map((s) => s.kkTerdampak)),
    totalLuasHa: totalAtauNull(spots.map((s) => s.luasTerdampakHa)),
    rataTinggiRob: rata(rob.map((s) => s.tinggiRob)),
    rataLajuAbrasi: rata(abrasi.map((s) => s.lajuAbrasi)),
  };

  // Statistik publik tidak menampilkan jumlah laporan ditolak. Admin tetap
  // menerima angka tersebut melalui endpoint terproteksi.
  if (!publik) ringkasan.laporanDitolak = laporan.perStatus.ditolak;

  return {
    ringkasan,
    perKategori,
    perJenis: { rob: rob.length, abrasi: abrasi.length },
    perJenisAncaman,
    perStatusVerifikasi: {
      terverifikasi: terverifikasi.length,
      belum_verifikasi: belumVerifikasi.length,
    },
    perStatusKoordinat,
    perKecamatan: Object.values(kecamatan).sort((a, b) => b.total - a.total),
    sebaranKategori,
    trenPerTahun: tren,
    laporan,
    gea,
  };
}

/** GET /api/stats - ringkasan angka publik tanpa data pribadi pelapor. */
router.get('/', async (_req, res) => {
  res.json(await bangunStatistik({ publik: true }));
});

/** GET /api/stats/admin - statistik lengkap termasuk detail laporan (admin). */
router.get('/admin', wajibAdmin, async (_req, res) => {
  res.json(await bangunStatistik({ publik: false }));
});

/** GET /api/stats/meta - daftar kecamatan & tahun untuk mengisi filter di UI. */
router.get('/meta', async (_req, res) => {
  const spots = await read('spots');
  const unik = (key) =>
    [...new Set(spots.map((s) => s[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

  res.json({
    kecamatan: unik('kecamatan'),
    tahun: unik('tahun'),
    jenis: ['rob', 'abrasi'],
    jenisAncaman: unik('jenisAncaman'),
    kategori: KATEGORI,
    statusKoordinat: ['perkiraan', 'referensi_lokasi', 'terverifikasi'],
    statusVerifikasi: ['terverifikasi', 'perlu_verifikasi'],
  });
});

export default router;

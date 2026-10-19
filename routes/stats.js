/**
 * routes/stats.js - Agregasi statistik untuk dashboard & metadata filter.
 */
import { Router } from 'express';
import { read } from '../lib/db.js';

const router = Router();

const hitung = (rows, key) =>
  rows.reduce((acc, row) => {
    const nilai = row[key] || 'Tidak diketahui';
    acc[nilai] = (acc[nilai] || 0) + 1;
    return acc;
  }, {});

const rata = (angka) => {
  const valid = angka.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
};

const total = (angka) =>
  Number(angka.filter((n) => Number.isFinite(n)).reduce((a, b) => a + b, 0).toFixed(1));

/** Statistik laporan warga: status, jenis, tren bulanan, dan daftar terverifikasi. */
function statistikLaporan(reports) {
  const perStatus = { pending: 0, diverifikasi: 0, ditolak: 0 };
  const perJenis = { rob: 0, abrasi: 0 };
  const perBulan = {};

  for (const r of reports) {
    perStatus[r.status] = (perStatus[r.status] || 0) + 1;
    perJenis[r.jenis] = (perJenis[r.jenis] || 0) + 1;

    const bulan = String(r.createdAt || r.tanggal || '').slice(0, 7); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(bulan)) continue;
    perBulan[bulan] ||= { bulan, rob: 0, abrasi: 0, total: 0 };
    perBulan[bulan][r.jenis] += 1;
    perBulan[bulan].total += 1;
  }

  const urutTerbaru = [...reports].sort((a, b) =>
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

  return {
    total: reports.length,
    perStatus,
    perJenis,
    trenPerBulan: Object.values(perBulan).sort((a, b) => a.bulan.localeCompare(b.bulan)),
    terverifikasi: urutTerbaru.filter((r) => r.status === 'diverifikasi').map(ringkas),
    menunggu: urutTerbaru.filter((r) => r.status === 'pending').map(ringkas),
    terbaru: urutTerbaru.slice(0, 5).map(ringkas),
  };
}

/** GET /api/stats - ringkasan angka untuk dashboard admin & publik. */
router.get('/', async (_req, res) => {
  const spots = await read('spots');
  const reports = await read('reports');

  const rob = spots.filter((s) => s.jenis === 'rob');
  const abrasi = spots.filter((s) => s.jenis === 'abrasi');

  // Rekap per kecamatan (jumlah titik rob & abrasi)
  const kecamatan = {};
  for (const s of spots) {
    const nama = s.kecamatan || 'Tidak diketahui';
    kecamatan[nama] ||= { kecamatan: nama, rob: 0, abrasi: 0, total: 0 };
    kecamatan[nama][s.jenis] += 1;
    kecamatan[nama].total += 1;
  }

  // Sebaran kategori bencana: rob/abrasi x Rendah/Sedang/Tinggi
  const sebaranKategori = {
    rob: { Rendah: 0, Sedang: 0, Tinggi: 0 },
    abrasi: { Rendah: 0, Sedang: 0, Tinggi: 0 },
  };
  for (const s of spots) {
    if (sebaranKategori[s.jenis] && s.kategori in sebaranKategori[s.jenis]) {
      sebaranKategori[s.jenis][s.kategori] += 1;
    }
  }

  // Tren per tahun: rata-rata tinggi rob & laju abrasi
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

  const laporan = statistikLaporan(reports);

  res.json({
    ringkasan: {
      totalTitik: spots.length,
      totalRob: rob.length,
      totalAbrasi: abrasi.length,
      totalLaporan: laporan.total,
      laporanPending: laporan.perStatus.pending,
      laporanTerverifikasi: laporan.perStatus.diverifikasi,
      laporanDitolak: laporan.perStatus.ditolak,
      totalKK: total(spots.map((s) => s.kkTerdampak)),
      totalLuasHa: total(spots.map((s) => s.luasTerdampakHa)),
      rataTinggiRob: rata(rob.map((s) => s.tinggiRob)),
      rataLajuAbrasi: rata(abrasi.map((s) => s.lajuAbrasi)),
    },
    perKategori: hitung(spots, 'kategori'),
    perKecamatan: Object.values(kecamatan).sort((a, b) => b.total - a.total),
    sebaranKategori,
    trenPerTahun: tren,
    laporan,
  });
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
    kategori: ['Rendah', 'Sedang', 'Tinggi'],
  });
});

export default router;

/**
 * routes/stats.js - Agregasi statistik untuk dashboard & metadata filter.
 *
 * Prinsip data:
 * - `spots` adalah catatan sumber, belum tentu kejadian unik terverifikasi.
 * - Kategori risiko hanya dihitung dari catatan yang `terverifikasi`.
 * - Catatan tanpa kategori tidak dimasukkan ke Rendah/Sedang/Tinggi.
 */
import { Router } from 'express';
import { read } from '../lib/db.js';

const router = Router();

const KATEGORI = ['Rendah', 'Sedang', 'Tinggi'];

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
  const terverifikasi = spots.filter((s) => s.terverifikasi);
  const belumVerifikasi = spots.filter((s) => !s.terverifikasi);

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

  // Hanya catatan terverifikasi yang boleh masuk hitungan kategori risiko.
  const perKategori = Object.fromEntries(KATEGORI.map((k) => [k, 0]));
  const sebaranKategori = sebaranKosong();
  for (const s of terverifikasi) {
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

  const laporan = statistikLaporan(reports);

  res.json({
    ringkasan: {
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
      laporanDitolak: laporan.perStatus.ditolak,
      totalKK: totalAtauNull(spots.map((s) => s.kkTerdampak)),
      totalLuasHa: totalAtauNull(spots.map((s) => s.luasTerdampakHa)),
      rataTinggiRob: rata(rob.map((s) => s.tinggiRob)),
      rataLajuAbrasi: rata(abrasi.map((s) => s.lajuAbrasi)),
    },
    perKategori,
    perJenis: { rob: rob.length, abrasi: abrasi.length },
    perStatusVerifikasi: {
      terverifikasi: terverifikasi.length,
      belum_verifikasi: belumVerifikasi.length,
    },
    perStatusKoordinat,
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
    kategori: KATEGORI,
    statusKoordinat: ['perkiraan', 'referensi_lokasi', 'terverifikasi'],
    statusVerifikasi: ['terverifikasi', 'perlu_verifikasi'],
  });
});

export default router;

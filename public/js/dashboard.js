/**
 * dashboard.js - Halaman statistik dengan grafik Chart.js.
 *
 * Statistik mengikuti data titik rawan yang tersedia: jumlah per jenis,
 * sebaran per kecamatan, dan distribusi tingkat kerawanan. Nilai ukur
 * (tinggi rob, laju abrasi, luas, KK) ditampilkan sebagai "—" bila tidak
 * ada di sumber, bukan diisi angka perkiraan.
 */
import { api, esc, format, toast } from './common.js';
import { htmlStatistikGea } from './gea-stats.js?v=4';

const WARNA = {
  rob: '#1685C5',
  abrasi: '#D8C08A',
  rendah: '#12821B',
  sedang: '#F5F728',
  tinggi: '#C83E4D',
};

let grafik = [];

function hancurkanGrafik() {
  grafik.forEach((g) => g.destroy());
  grafik = [];
}

function kartu(nilai, label, kelas = '') {
  return `
    <div class="stat ${kelas}">
      <div class="nilai">${nilai}</div>
      <div class="label">${esc(label)}</div>
    </div>`;
}

function nilaiAngka(n, desimal = 0) {
  return n === null || n === undefined || n === '' || !Number.isFinite(Number(n))
    ? '—'
    : format.angka(n, desimal);
}

function nilaiSatuan(n, desimal, satuan) {
  const angka = nilaiAngka(n, desimal);
  return angka === '—' ? angka : `${angka} ${satuan}`;
}

function gambarRingkasan(r) {
  const wadah = document.getElementById('kartuRingkasan');
  wadah.innerHTML = [
    kartu(format.angka(r.totalTitik ?? r.totalCatatan), 'Total titik rawan'),
    kartu(format.angka(r.totalRob), 'Titik banjir rob', 'rob'),
    kartu(format.angka(r.totalAbrasi), 'Titik abrasi', 'abrasi'),
    kartu(nilaiAngka(r.totalKK), 'KK terdampak'),
    kartu(nilaiSatuan(r.totalLuasHa, 1, 'Ha'), 'Total luas terdampak', 'oranye'),
    kartu(nilaiSatuan(r.rataTinggiRob, 0, 'cm'), 'Rata-rata tinggi rob', 'merah'),
    kartu(nilaiSatuan(r.rataLajuAbrasi, 1, 'm/th'), 'Rata-rata laju abrasi', 'oranye'),
    kartu(format.angka(r.laporanPending), 'Laporan menunggu verifikasi', 'hijau'),
  ].join('');
}

function gambarGea(gea) {
  const wadah = document.getElementById('kartuGea');
  if (!wadah) return;
  wadah.innerHTML = htmlStatistikGea(gea);
}

function gambarTabelKecamatan(rows) {
  const tbody = document.getElementById('tabelKecamatan');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="kosong">Belum ada data.</td></tr>';
    return;
  }
  tbody.innerHTML = rows
    .map(
      (k) => `
      <tr>
        <td>${esc(k.kecamatan)}</td>
        <td>${format.angka(k.rob)}</td>
        <td>${format.angka(k.abrasi)}</td>
        <td><strong>${format.angka(k.total)}</strong></td>
      </tr>`
    )
    .join('');
}

function gambarGrafikKecamatan(rows) {
  const ctx = document.getElementById('grafikKecamatan');
  grafik.push(
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: rows.map((k) => k.kecamatan),
        datasets: [
          { label: 'Rob', data: rows.map((k) => k.rob), backgroundColor: WARNA.rob, borderRadius: 4 },
          { label: 'Abrasi', data: rows.map((k) => k.abrasi), backgroundColor: WARNA.abrasi, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true, ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    })
  );
}

function gambarGrafikKategori(perKategori) {
  const label = ['Rendah', 'Sedang', 'Tinggi'];
  const nilai = label.map((k) => Number(perKategori?.[k]) || 0);
  const ctx = document.getElementById('grafikKategori');
  grafik.push(
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: label,
        datasets: [
          {
            data: nilai,
            backgroundColor: [WARNA.rendah, WARNA.sedang, WARNA.tinggi],
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} titik` } },
        },
      },
    })
  );
}

async function muat() {
  try {
    const { ringkasan, perKategori, perKecamatan, gea } = await api('/api/stats');

    gambarRingkasan(ringkasan);
    gambarGea(gea);
    gambarTabelKecamatan(perKecamatan);
    hancurkanGrafik();
    gambarGrafikKecamatan(perKecamatan);
    gambarGrafikKategori(perKategori);
  } catch (err) {
    toast(`Gagal memuat statistik: ${err.message}`, 'gagal');
  }
}

/** Tunggu Chart.js selesai dimuat (defer), lalu gambar. */
function mulai() {
  if (window.Chart) {
    Chart.defaults.font.family = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';
    Chart.defaults.color = '#627983';
    Chart.defaults.borderColor = 'rgba(98, 121, 131, 0.18)';
    return muat();
  }
  setTimeout(mulai, 120);
}

mulai();

/**
 * dashboard.js - Halaman statistik dengan grafik Chart.js.
 *
 * Statistik mengikuti data yang benar-benar tersedia: jumlah catatan sumber,
 * status verifikasi, dan jumlah catatan per tahun. Nilai ukur (tinggi rob,
 * laju abrasi, luas, KK) tidak ditampilkan bila tidak ada di sumber.
 */
import { api, esc, format, toast } from './common.js';

const WARNA = {
  rob: '#1685C5',
  abrasi: '#D8C08A',
  abrasiGaris: '#A88D4A',
  terverifikasi: '#12821B',
  belumVerifikasi: '#D8C08A',
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

function gambarRingkasan(r) {
  const wadah = document.getElementById('kartuRingkasan');
  wadah.innerHTML = [
    kartu(format.angka(r.totalCatatan), 'Catatan sumber'),
    kartu(format.angka(r.totalRob), 'Catatan banjir rob', 'rob'),
    kartu(format.angka(r.totalAbrasi), 'Catatan abrasi', 'abrasi'),
    kartu(format.angka(r.totalKejadianTerverifikasi), 'Kejadian terverifikasi', 'netral'),
    kartu(format.angka(r.totalBelumVerifikasi), 'Belum diverifikasi', 'pending'),
    kartu(format.angka(r.totalKoordinatPerkiraan), 'Pin perkiraan', 'netral'),
    kartu(format.angka(r.totalKoordinatReferensi), 'Referensi lokasi', 'netral'),
    kartu(format.angka(r.laporanPending), 'Laporan menunggu verifikasi', 'pending'),
  ].join('');
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

function gambarGrafikStatus(status) {
  const label = ['Terverifikasi', 'Belum diverifikasi'];
  const nilai = [status.terverifikasi || 0, status.belum_verifikasi || 0];
  const ctx = document.getElementById('grafikKategori');
  grafik.push(
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: label,
        datasets: [
          {
            data: nilai,
            backgroundColor: [WARNA.terverifikasi, WARNA.belumVerifikasi],
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
          tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} catatan` } },
        },
      },
    })
  );
}

function gambarGrafikJumlah(canvasId, tren, field, warna, label) {
  const ctx = document.getElementById(canvasId);
  grafik.push(
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: tren.map((t) => t.tahun),
        datasets: [
          {
            label,
            data: tren.map((t) => t[field]),
            borderColor: warna,
            backgroundColor: `${warna}33`,
            fill: true,
            tension: 0.35,
            pointRadius: 5,
            spanGaps: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    })
  );
}

async function muat() {
  try {
    const { ringkasan, perStatusVerifikasi, perKecamatan, trenPerTahun } = await api('/api/stats');

    gambarRingkasan(ringkasan);
    gambarTabelKecamatan(perKecamatan);
    hancurkanGrafik();
    gambarGrafikKecamatan(perKecamatan);
    gambarGrafikStatus(perStatusVerifikasi);
    gambarGrafikJumlah('grafikTinggiRob', trenPerTahun, 'rob', WARNA.rob, 'Jumlah catatan rob');
    gambarGrafikJumlah('grafikAbrasi', trenPerTahun, 'abrasi', WARNA.abrasiGaris, 'Jumlah catatan abrasi');
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

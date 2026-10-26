/**
 * dashboard.js - Halaman statistik dengan grafik Chart.js.
 */
import { api, esc, format, toast } from './common.js';

const WARNA = {
  rob: '#1685C5',
  abrasi: '#D8C08A',
  // Versi lebih gelap khusus garis tren agar tetap terbaca di atas kartu putih.
  abrasiGaris: '#A88D4A',
  // Rendah & Sedang mengikuti ramp BNPB; Tinggi memakai merah legenda
  // tingkat kerawanan agar tidak terbaca oranye.
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

function gambarRingkasan(r) {
  const wadah = document.getElementById('kartuRingkasan');
  wadah.innerHTML = [
    kartu(format.angka(r.totalTitik), 'Total titik terdata'),
    kartu(format.angka(r.totalRob), 'Titik banjir rob', 'rob'),
    kartu(format.angka(r.totalAbrasi), 'Titik abrasi', 'abrasi'),
    kartu(format.angka(r.totalKK), 'KK terdampak', 'netral'),
    kartu(`${format.angka(r.totalLuasHa, 1)} Ha`, 'Total luas terdampak', 'netral'),
    kartu(`${format.angka(r.rataTinggiRob)} cm`, 'Rata-rata tinggi rob', 'rob'),
    kartu(`${format.angka(r.rataLajuAbrasi, 1)} m/th`, 'Rata-rata laju abrasi', 'abrasi'),
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

function gambarGrafikKategori(perKategori) {
  const label = ['Rendah', 'Sedang', 'Tinggi'];
  const nilai = label.map((k) => perKategori[k] || 0);
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
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} titik` } } },
      },
    })
  );
}

function gambarGrafikGaris(canvasId, tren, field, warna, satuan) {
  const ctx = document.getElementById(canvasId);
  grafik.push(
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: tren.map((t) => t.tahun),
        datasets: [
          {
            label: `Rata-rata (${satuan})`,
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
        scales: { y: { beginAtZero: true } },
      },
    })
  );
}

async function muat() {
  try {
    const { ringkasan, perKategori, perKecamatan, trenPerTahun } = await api('/api/stats');

    gambarRingkasan(ringkasan);
    gambarTabelKecamatan(perKecamatan);
    hancurkanGrafik();
    gambarGrafikKecamatan(perKecamatan);
    gambarGrafikKategori(perKategori);
    gambarGrafikGaris('grafikTinggiRob', trenPerTahun, 'rataTinggiRob', WARNA.rob, 'cm');
    gambarGrafikGaris('grafikAbrasi', trenPerTahun, 'rataLajuAbrasi', WARNA.abrasiGaris, 'm/tahun');
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

/**
 * admin-dashboard.js - Dashboard utama admin.
 * Menampilkan ringkasan, donut sebaran kategori, progress bar kerawanan,
 * grafik kecamatan & tren laporan, serta tabel laporan.
 */
import {
  api,
  badgeJenis,
  badgeStatus,
  esc,
  format,
  labelTanggal,
  pasangLayout,
  perbaruiBadgePending,
  toast,
  wajibLogin,
} from './admin-common.js';

const WARNA = {
  rob: '#3b82f6',
  abrasi: '#f97316',
  robAbrasi: '#7c3aed',
  rendah: '#4ade80',
  sedang: '#facc15',
  tinggi: '#ef4444',
  pending: '#f59e0b',
  diverifikasi: '#16a34a',
  ditolak: '#dc2626',
};

let grafik = [];
const hancurkanGrafik = () => {
  grafik.forEach((g) => g.destroy());
  grafik = [];
};

/* ───────────────── Kartu Stat ───────────────── */
function ikonSvg(path, warna) {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${warna}"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const IKON_STAT = {
  laporan: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>',
  tunggu:  '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="10"/>',
  cek:     '<path d="M20 6 9 17l-5-5"/>',
  pin:     '<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
};

function buatKartuStat({ label, nilai, desc, ikonKey, ikonKelas }) {
  return `
    <div class="db-stat-card">
      <div class="db-stat-icon ${ikonKelas}">
        ${ikonSvg(IKON_STAT[ikonKey], 'currentColor')}
      </div>
      <div class="db-stat-body">
        <p class="db-stat-label">${esc(label)}</p>
        <p class="db-stat-value">${nilai}</p>
        <p class="db-stat-desc">${esc(desc)}</p>
      </div>
    </div>`;
}

function gambarRingkasan(r) {
  document.getElementById('kartuRingkasan').innerHTML = [
    buatKartuStat({ label: 'Total Laporan',          nilai: format.angka(r.totalLaporan),         desc: 'Semua laporan',       ikonKey: 'laporan', ikonKelas: 'hijau'  }),
    buatKartuStat({ label: 'Menunggu Verifikasi',    nilai: format.angka(r.laporanPending),        desc: 'Perlu ditinjau',      ikonKey: 'tunggu',  ikonKelas: 'oranye' }),
    buatKartuStat({ label: 'Terverifikasi',          nilai: format.angka(r.laporanTerverifikasi),  desc: 'Laporan disetujui',   ikonKey: 'cek',     ikonKelas: 'hijau'  }),
    buatKartuStat({ label: 'Titik Lokasi',           nilai: format.angka(r.totalTitik),            desc: 'Titik pada peta',     ikonKey: 'pin',     ikonKelas: 'biru'   }),
  ].join('');
}

/* ───────────────── Donut Sebaran ───────────────── */
function gambarDonut(sebaran) {
  const robTotal    = (sebaran.rob.Rendah    || 0) + (sebaran.rob.Sedang    || 0) + (sebaran.rob.Tinggi    || 0);
  const abrasiTotal = (sebaran.abrasi.Rendah || 0) + (sebaran.abrasi.Sedang || 0) + (sebaran.abrasi.Tinggi || 0);
  const kombinasi   = 0; // titik campuran (tidak ada di data saat ini, bisa dikembangkan)

  const total = robTotal + abrasiTotal + kombinasi || 1;

  const dataSets = [
    { nama: 'Banjir Rob',          nilai: robTotal,    warna: WARNA.rob      },
    { nama: 'Abrasi',              nilai: abrasiTotal, warna: WARNA.abrasi   },
    { nama: 'Banjir Rob & Abrasi', nilai: kombinasi,   warna: WARNA.robAbrasi },
  ].filter((d) => d.nilai > 0 || total === 1);

  // Donut utama (jenis rob vs abrasi)
  const robPct = Math.round((robTotal / total) * 100);

  // Center label = jenis terbesar
  const terbesar = dataSets.reduce((a, b) => (a.nilai >= b.nilai ? a : b), dataSets[0] || { nama: '—', nilai: 0 });

  const pctEl   = document.getElementById('donutPct');
  const labelEl = document.getElementById('donutLabel');
  if (pctEl)   pctEl.textContent   = `${Math.round((terbesar.nilai / total) * 100)}%`;
  if (labelEl) labelEl.textContent = terbesar.nama;

  // Legend
  const legend = document.getElementById('donutLegend');
  if (legend) {
    legend.innerHTML = dataSets.map((d) => `
      <div class="db-legend-item">
        <span class="db-legend-dot" style="background:${d.warna}"></span>
        <span class="db-legend-nama">${esc(d.nama)}</span>
        <span class="db-legend-count">${d.nilai}</span>
        <span class="db-legend-pct">${Math.round((d.nilai / total) * 100)}%</span>
      </div>`).join('');
  }

  // Chart.js donut
  grafik.push(
    new Chart(document.getElementById('grafikKategori'), {
      type: 'doughnut',
      data: {
        labels: dataSets.map((d) => d.nama),
        datasets: [{
          data: dataSets.map((d) => d.nilai),
          backgroundColor: dataSets.map((d) => d.warna),
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${Math.round((c.parsed / total) * 100)}%)` } },
        },
        animation: { animateRotate: true, duration: 900 },
      },
    })
  );
}

/* ───────────────── Progress Bar Risiko ───────────────── */
function gambarRisiko(sebaran) {
  const tinggi  = (sebaran.rob.Tinggi  || 0) + (sebaran.abrasi.Tinggi  || 0);
  const sedang  = (sebaran.rob.Sedang  || 0) + (sebaran.abrasi.Sedang  || 0);
  const rendah  = (sebaran.rob.Rendah  || 0) + (sebaran.abrasi.Rendah  || 0);
  const maks    = Math.max(tinggi, sedang, rendah, 1);

  const items = [
    { nama: 'Risiko Tinggi', nilai: tinggi, kelas: 'tinggi' },
    { nama: 'Risiko Sedang', nilai: sedang, kelas: 'sedang' },
    { nama: 'Risiko Rendah', nilai: rendah, kelas: 'rendah' },
  ];

  const el = document.getElementById('risikoList');
  if (!el) return;
  el.innerHTML = items.map((item) => `
    <div class="db-risiko-item">
      <div class="db-risiko-header">
        <span class="db-risiko-nama">${esc(item.nama)}</span>
        <span class="db-risiko-count">${item.nilai}</span>
      </div>
      <div class="db-risiko-bar-wrap">
        <div class="db-risiko-bar ${item.kelas}" style="width:${Math.round((item.nilai / maks) * 100)}%"></div>
      </div>
    </div>`).join('');
}

/* ───────────────── Grafik Kecamatan ───────────────── */
function grafikKecamatan(rows) {
  const ctx = document.getElementById('grafikKecamatan');
  grafik.push(new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rows.map((k) => k.kecamatan),
      datasets: [
        { label: 'Rob',    data: rows.map((k) => k.rob),    backgroundColor: WARNA.rob,    borderRadius: 4 },
        { label: 'Abrasi', data: rows.map((k) => k.abrasi), backgroundColor: WARNA.abrasi, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { stacked: true, ticks: { autoSkip: false, maxRotation: 45 } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  }));
}

/* ───────────────── Grafik Tren Laporan ───────────────── */
function grafikTrenLaporan(rows) {
  const labelBulan = (teks) => {
    const [t, b] = String(teks).split('-');
    const nama = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    return `${nama[Number(b) - 1] || b} ${t}`;
  };
  grafik.push(new Chart(document.getElementById('grafikTrenLaporan'), {
    type: 'line',
    data: {
      labels: rows.map((t) => labelBulan(t.bulan)),
      datasets: [
        { label: 'Rob',    data: rows.map((t) => t.rob),    borderColor: WARNA.rob,    backgroundColor: `${WARNA.rob}33`,    fill: true, tension: 0.35, pointRadius: 4 },
        { label: 'Abrasi', data: rows.map((t) => t.abrasi), borderColor: WARNA.abrasi, backgroundColor: `${WARNA.abrasi}33`, fill: true, tension: 0.35, pointRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  }));
}

/* ───────────────── Tabel ───────────────── */
function gambarTabelTerverifikasi(rows) {
  const tbody = document.getElementById('tabelTerverifikasi');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="kosong">Belum ada laporan terverifikasi.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.slice(0, 6).map((r) => `
    <tr>
      <td>${labelTanggal(r.tanggal)}</td>
      <td>${esc(r.namaPelapor)}</td>
      <td>${badgeJenis(r.jenis)}</td>
      <td>${esc(r.alamat || '—')}<br><span class="tag-kecil">${esc(r.kecamatan || '—')}</span></td>
      <td style="max-width:340px">${esc((r.deskripsi || '').slice(0, 110))}${(r.deskripsi || '').length > 110 ? '…' : ''}</td>
    </tr>`).join('');
}

function gambarTabelTerbaru(rows) {
  const tbody = document.getElementById('tabelTerbaru');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="kosong">Belum ada laporan masuk.</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td>${labelTanggal(r.tanggal)}</td>
      <td>${esc(r.namaPelapor)}</td>
      <td>${badgeJenis(r.jenis)}</td>
      <td>${esc(r.alamat || '—')}<br><span class="tag-kecil">${esc(r.kecamatan || '—')}</span></td>
      <td>${badgeStatus(r.status)}</td>
    </tr>`).join('');
}

/* ───────────────── Muat Data ───────────────── */
async function muat() {
  try {
    const { ringkasan, perKecamatan, sebaranKategori, laporan } = await api('/api/stats');

    gambarRingkasan(ringkasan);
    gambarRisiko(sebaranKategori);
    gambarTabelTerverifikasi(laporan.terverifikasi);
    gambarTabelTerbaru(laporan.terbaru);
    perbaruiBadgePending();

    const tungguChart = () => {
      if (!window.Chart) return setTimeout(tungguChart, 120);
      Chart.defaults.font.family = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Arial, sans-serif';
      hancurkanGrafik();
      gambarDonut(sebaranKategori);
      grafikKecamatan(perKecamatan);
      grafikTrenLaporan(laporan.trenPerBulan);
    };
    tungguChart();
  } catch (err) {
    toast(`Gagal memuat dashboard: ${err.message}`, 'gagal');
  }
}

(async () => {
  if (!(await wajibLogin())) return;
  pasangLayout({ aktif: 'index.html' });
  muat();
})();

/**
 * map.js - Halaman peta interaktif publik.
 */
import { api, esc, format, radiusTitik, toast, warnaTitik } from './common.js';

const PUSAT_BENGKULU = [-3.785, 102.26];
const URL_OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/* ---------------- Inisialisasi peta ---------------- */
const peta = L.map('peta', { zoomControl: true }).setView(PUSAT_BENGKULU, 12);

L.tileLayer(URL_OSM, { maxZoom: 19, attribution: ATRIBUSI })
  .on('tileerror', () => toast('Peta dasar gagal dimuat. Periksa koneksi internet.', 'gagal'))
  .addTo(peta);

const cluster = {
  rob:     L.layerGroup(),
  abrasi:  L.layerGroup(),
  laporan: L.layerGroup(),
};
cluster.rob.addTo(peta);
cluster.abrasi.addTo(peta);
cluster.laporan.addTo(peta);

let semuaTitik   = [];
let semuaLaporan = [];

/* ---------------- Popup ---------------- */
function barisPopup(label, nilai) {
  return `<tr><td>${esc(label)}</td><td><strong>${esc(nilai)}</strong></td></tr>`;
}

function popupTitik(s) {
  const detail =
    s.jenis === 'rob'
      ? barisPopup('Tinggi rob', s.tinggiRob ? `${format.angka(s.tinggiRob)} cm` : '—')
      : barisPopup('Laju abrasi', s.lajuAbrasi ? `${format.angka(s.lajuAbrasi, 1)} m/tahun` : '—');

  return `
    <div class="popup-judul">${esc(s.nama)}</div>
    <span class="badge ${esc(s.jenis)}">${s.jenis === 'rob' ? 'Banjir Rob' : 'Abrasi'}</span>
    <span class="badge ${esc(String(s.kategori).toLowerCase())}">${esc(s.kategori)}</span>
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Kecamatan', s.kecamatan || '—')}
      ${detail}
      ${barisPopup('Luas terdampak', s.luasTerdampakHa ? `${format.angka(s.luasTerdampakHa, 1)} Ha` : '—')}
      ${barisPopup('KK terdampak', s.kkTerdampak ? `${format.angka(s.kkTerdampak)} KK` : '—')}
      ${barisPopup('Tahun data', s.tahun || '—')}
      ${barisPopup('Sumber', s.sumber || '—')}
      ${barisPopup('Koordinat', `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`)}
    </table>
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#4b5563">${esc(s.deskripsi || '')}</p>
  `;
}

function popupLaporan(r) {
  const foto = r.foto
    ? `<img src="${esc(r.foto)}" alt="Foto laporan" style="width:100%;border-radius:8px;margin-top:.5rem" />`
    : '';
  return `
    <div class="popup-judul">Laporan: ${esc(r.alamat || 'Tanpa alamat')}</div>
    <span class="badge ${esc(r.jenis)}">${r.jenis === 'rob' ? 'Banjir Rob' : 'Abrasi'}</span>
    <span class="badge diverifikasi">Terverifikasi</span>
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Kecamatan', r.kecamatan || '—')}
      ${barisPopup('Tanggal', format.tanggal(r.tanggal))}
    </table>
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#4b5563">${esc(r.deskripsi || '')}</p>
    ${foto}
  `;
}

/* ---------------- Gambar penanda ---------------- */
function gambarTitik(rows) {
  cluster.rob.clearLayers();
  cluster.abrasi.clearLayers();

  for (const s of rows) {
    const penanda = L.circleMarker([s.lat, s.lng], {
      radius: radiusTitik(s.luasTerdampakHa),
      color: '#ffffff',
      weight: 2,
      fillColor: warnaTitik(s.jenis, s.kategori),
      fillOpacity: 0.9,
    });

    penanda.bindPopup(popupTitik(s), { maxWidth: 320 });
    penanda.bindTooltip(`${s.nama} — ${s.kategori}`, { direction: 'top', offset: [0, -6] });
    (s.jenis === 'rob' ? cluster.rob : cluster.abrasi).addLayer(penanda);
  }
}

function gambarLaporan(rows) {
  cluster.laporan.clearLayers();
  for (const r of rows) {
    L.circleMarker([r.lat, r.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      dashArray: '2 3',
      fillColor: '#7c3aed',
      fillOpacity: 0.95,
    })
      .bindPopup(popupLaporan(r), { maxWidth: 320 })
      .bindTooltip('Laporan warga', { direction: 'top', offset: [0, -6] })
      .addTo(cluster.laporan);
  }
}

/* ---------------- Daftar titik di sidebar ---------------- */
function gambarDaftar(rows) {
  const wadah  = document.getElementById('daftarTitik');
  const jumlah = document.getElementById('jumlahTitik');
  jumlah.textContent = `(${rows.length})`;

  if (!rows.length) {
    wadah.innerHTML = '<p style="font-size:.82rem;color:#9ca3af;padding:.3rem 0">Tidak ada titik sesuai filter.</p>';
    return;
  }

  wadah.innerHTML = '';
  for (const s of rows) {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'sidebar-item';
    btn.title     = `Tampilkan ${s.nama} di peta`;
    btn.innerHTML = `
      <span class="dot" style="background:${warnaTitik(s.jenis, s.kategori)};flex-shrink:0"></span>
      <span class="item-nama">${esc(s.nama)}</span>
      <span class="item-kec">${esc(s.kecamatan || '')}</span>
    `;
    btn.addEventListener('click', () => {
      peta.setView([s.lat, s.lng], 15, { animate: true });
      const layerGrup = s.jenis === 'rob' ? cluster.rob : cluster.abrasi;
      const target    = layerGrup.getLayers().find(
        (l) => Math.abs(l.getLatLng().lat - s.lat) < 1e-9 && Math.abs(l.getLatLng().lng - s.lng) < 1e-9
      );
      target?.openPopup();
      // Tutup sidebar di layar kecil setelah klik
      if (window.innerWidth < 768) tutupSidebar();
    });
    wadah.appendChild(btn);
  }
}

/* ---------------- Filter ---------------- */
function bacaFilter() {
  return {
    jenis:     document.getElementById('filterJenis').value,
    kecamatan: document.getElementById('filterKecamatan').value,
    kategori:  [...document.querySelectorAll('.filter-kategori:checked')].map((c) => c.value),
    cari:      document.getElementById('cariTitik').value.trim().toLowerCase(),
  };
}

function terapkanFilter() {
  const f = bacaFilter();
  const hasil = semuaTitik.filter((s) => {
    if (f.jenis && s.jenis !== f.jenis) return false;
    if (f.kecamatan && s.kecamatan !== f.kecamatan) return false;
    if (!f.kategori.includes(s.kategori)) return false;
    if (f.cari) {
      const teks = [s.nama, s.kecamatan, s.deskripsi].join(' ').toLowerCase();
      if (!teks.includes(f.cari)) return false;
    }
    return true;
  });

  gambarTitik(hasil);
  gambarDaftar(hasil);
}

function perbaruiVisibilitasLayer() {
  const aktif = {
    rob:     document.getElementById('layerRob').checked,
    abrasi:  document.getElementById('layerAbrasi').checked,
    laporan: document.getElementById('layerLaporan').checked,
  };
  const pasang = (grup, nyala) => {
    const ada = peta.hasLayer(grup);
    if (nyala && !ada) grup.addTo(peta);
    if (!nyala && ada) peta.removeLayer(grup);
  };
  pasang(cluster.rob,     aktif.rob);
  pasang(cluster.abrasi,  aktif.abrasi);
  pasang(cluster.laporan, aktif.laporan);
}

/* ---------------- Sidebar buka / tutup ---------------- */
const sidebar  = document.getElementById('petaSidebar');
const overlay  = document.getElementById('sidebarOverlay');
const btnBuka  = document.getElementById('btnBukaSidebar');

function bukaSidebar() {
  sidebar.classList.add('terbuka');
  overlay.classList.add('aktif');
  btnBuka.classList.add('tersembunyi');
  // Paksa peta recalculate ukuran setelah sidebar muncul
  setTimeout(() => peta.invalidateSize(), 300);
}

function tutupSidebar() {
  sidebar.classList.remove('terbuka');
  overlay.classList.remove('aktif');
  btnBuka.classList.remove('tersembunyi');
  setTimeout(() => peta.invalidateSize(), 300);
}

btnBuka.addEventListener('click', bukaSidebar);
document.getElementById('btnTutupSidebar').addEventListener('click', tutupSidebar);
overlay.addEventListener('click', tutupSidebar);

/* ---------------- Legenda toggle ---------------- */
const legendaIsi    = document.getElementById('legendaIsi');
const btnLegenda    = document.getElementById('btnLegenda');
let legendaVisible  = true;

btnLegenda.addEventListener('click', () => {
  legendaVisible = !legendaVisible;
  legendaIsi.classList.toggle('tersembunyi', !legendaVisible);
  btnLegenda.title = legendaVisible ? 'Sembunyikan legenda' : 'Tampilkan legenda';
});

/* ---------------- Muat data ---------------- */
async function muat() {
  try {
    const [spots, laporan] = await Promise.all([
      api('/api/spots'),
      api('/api/reports/publik').catch(() => ({ data: [] })),
    ]);

    semuaTitik   = spots.data   || [];
    semuaLaporan = laporan.data || [];

    // Isi opsi kecamatan
    const kecamatan = [...new Set(semuaTitik.map((s) => s.kecamatan).filter(Boolean))].sort();
    const select    = document.getElementById('filterKecamatan');
    for (const k of kecamatan) {
      const opt      = document.createElement('option');
      opt.value      = k;
      opt.textContent = k;
      select.appendChild(opt);
    }

    terapkanFilter();
    gambarLaporan(semuaLaporan);

    if (semuaTitik.length) {
      const batas = L.latLngBounds(semuaTitik.map((s) => [s.lat, s.lng]));
      peta.fitBounds(batas.pad(0.25), { maxZoom: 14 });
    }
  } catch (err) {
    toast(`Gagal memuat data: ${err.message}`, 'gagal');
  }
}

/* ---------------- Event listener filter ---------------- */
document.getElementById('filterJenis').addEventListener('change', terapkanFilter);
document.getElementById('filterKecamatan').addEventListener('change', terapkanFilter);
document.querySelectorAll('.filter-kategori').forEach((c) => c.addEventListener('change', terapkanFilter));

let timerCari = null;
document.getElementById('cariTitik').addEventListener('input', () => {
  clearTimeout(timerCari);
  timerCari = setTimeout(terapkanFilter, 220);
});

document.getElementById('resetFilter').addEventListener('click', () => {
  document.getElementById('filterJenis').value = '';
  document.getElementById('filterKecamatan').value = '';
  document.querySelectorAll('.filter-kategori').forEach((c) => (c.checked = true));
  document.getElementById('cariTitik').value = '';
  terapkanFilter();
});

for (const id of ['layerRob', 'layerAbrasi', 'layerLaporan']) {
  document.getElementById(id).addEventListener('change', perbaruiVisibilitasLayer);
}

muat();

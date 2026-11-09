/**
 * map.js - Halaman peta interaktif publik.
 */
import { api, esc, format, toast } from './common.js';
import { buatLayerGea } from './layer-gea.js';
import {
  ATRIBUSI,
  BATAS_PESISIR,
  PUSAT_PESISIR,
  URL_OSM,
  bacaFilter,
  barisPopup,
  buatBantuanPeta,
  deskripsiTanpaCatatanPin,
  filterTitik,
  ikonJenis,
  kategoriValid,
  normalJenis,
  perbaruiVisibilitasLayer,
} from './peta-common.js?v=1';

const LABEL_JENIS = { rob: 'Banjir Rob', abrasi: 'Abrasi & Gelombang Ekstrim' };
const LABEL_JENIS_NORMAL = {
  'banjir rob': 'Banjir Rob',
  'abrasi dan gelombang ekstrim': 'Abrasi & Gelombang Ekstrim',
  'abrasi & gelombang ekstrim': 'Abrasi & Gelombang Ekstrim',
  abrasi: 'Abrasi',
};

/* ---------------- Inisialisasi peta ---------------- */
const peta = L.map('peta', {
  zoomControl: false,
  maxBounds: BATAS_PESISIR.pad(1.5),
  maxBoundsViscosity: 0.65,
}).setView(PUSAT_PESISIR, 12);
// Kontrol zoom ditaruh di kanan atas agar tidak menumpuk dengan tombol Filter (kiri atas)
L.control.zoom({ position: 'topright' }).addTo(peta);

L.tileLayer(URL_OSM, { maxZoom: 19, attribution: ATRIBUSI })
  .on('tileerror', () => toast('Peta dasar gagal dimuat. Periksa koneksi internet.', 'gagal'))
  .addTo(peta);

const { ukuranPenanda, buatIkon, jagaPopupDalamPeta, pastikanZoomPopup } = buatBantuanPeta(peta);

/*
 * Semua pin langsung ditampilkan sebagai penanda individual, tanpa klaster
 * bernomor. Jadi sebaran data sudah terlihat sejak tampilan awal dan tidak
 * perlu zoom in dulu untuk memecah kelompok titik.
 */
const lapisan = {
  rob: L.layerGroup(),
  abrasi: L.layerGroup(),
  laporan: L.layerGroup(),
};
lapisan.rob.addTo(peta);
lapisan.abrasi.addTo(peta);
lapisan.laporan.addTo(peta);

let semuaTitik   = [];
let semuaLaporan = [];
let indeksPenanda = new Map(); // id titik -> marker asli, untuk fokus dari sidebar
let indeksLaporan = new Map(); // id laporan -> marker laporan warga

/* ---------------- Helper tampilan ---------------- */
function labelJenis(jenis, jenisAncaman = '') {
  const teks = String(jenisAncaman || '').trim();
  if (!teks) return LABEL_JENIS[normalJenis(jenis)];
  return LABEL_JENIS_NORMAL[teks.toLowerCase()] || teks;
}

function badgeJenis(jenis, jenisAncaman = '') {
  const j = normalJenis(jenis);
  return `<span class="badge badge-jenis badge-jenis-${j}">${ikonJenis(j)} ${esc(
    labelJenis(j, jenisAncaman)
  )}</span>`;
}

function badgeSumber(laporan = false) {
  return `<span class="badge badge-sumber${laporan ? ' badge-sumber-laporan' : ''}">${
    laporan ? 'Laporan warga' : 'Data kejadian'
  }</span>`;
}

function badgeRisiko(kategori) {
  if (!kategoriValid(kategori)) return '';
  const k = String(kategori).toLowerCase();
  return `<span class="badge badge-risiko badge-risiko-${k}">${esc(kategori)}</span>`;
}

function badgeVerifikasi(terverifikasi) {
  return `<span class="badge badge-verifikasi badge-verifikasi-${
    terverifikasi ? 'ya' : 'belum'
  }">${terverifikasi ? 'Terverifikasi' : 'Belum diverifikasi'}</span>`;
}

function catatanRisiko(kategori) {
  if (kategoriValid(kategori)) return '';
  return 'Kategori risiko belum ditetapkan. Zona Bahaya hanya acuan wilayah, bukan status verifikasi kejadian.';
}

function statusLaporan(r) {
  // Endpoint publik hanya mengirim laporan terverifikasi; fallback ini menjaga
  // status tetap tampil terpisah jika kelak endpoint menyertakan status lain.
  const status = r.status || 'diverifikasi';
  if (status === 'pending') return { label: 'Menunggu verifikasi', kelas: 'pending' };
  if (status === 'ditolak') return { label: 'Ditolak', kelas: 'ditolak' };
  return { label: 'Terverifikasi', kelas: 'diverifikasi' };
}

/* ---------------- Popup ---------------- */
function popupTitik(s) {
  const detail =
    s.jenis === 'rob'
      ? s.tinggiRob != null
        ? barisPopup('Tinggi rob', `${format.angka(s.tinggiRob)} cm`)
        : ''
      : s.lajuAbrasi != null
        ? barisPopup('Laju abrasi', `${format.angka(s.lajuAbrasi, 1)} m/tahun`)
        : '';
  const luas =
    s.luasTerdampakHa != null
      ? barisPopup('Luas terdampak', `${format.angka(s.luasTerdampakHa, 1)} Ha`)
      : '';
  const kk =
    s.kkTerdampak != null
      ? barisPopup('KK terdampak', `${format.angka(s.kkTerdampak)} KK`)
      : '';
  const catatanZona = catatanRisiko(s.kategori);
  const deskripsi = deskripsiTanpaCatatanPin(s.deskripsi);

  return `
    <div class="popup-judul">${esc(s.nama)} | ${esc(labelJenis(s.jenis, s.jenisAncaman))}</div>
    <div class="popup-badge-baris">
      ${badgeJenis(s.jenis, s.jenisAncaman)}
      ${badgeSumber(false)}
      ${badgeVerifikasi(s.terverifikasi)}
      ${badgeRisiko(s.kategori)}
    </div>
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Tanggal kejadian', s.tanggal || '—')}
      ${barisPopup('Kecamatan', s.kecamatan || '—')}
      ${detail}
      ${luas}
      ${kk}
      ${barisPopup('Tahun data', s.tahun || '—')}
      ${barisPopup('Sumber', s.sumber || '—')}
      ${barisPopup('Koordinat', `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`)}
    </table>
    ${catatanZona ? `<p class="popup-catatan">${esc(catatanZona)}</p>` : ''}
    ${deskripsi ? `<p style="margin:.5rem 0 0;font-size:.82rem;color:#627983">${esc(deskripsi)}</p>` : ''}
  `;
}

function popupLaporan(r) {
  const foto = r.foto
    ? `<img src="${esc(r.foto)}" alt="Foto laporan" style="width:100%;border-radius:8px;margin-top:.5rem" />`
    : '';
  const status = statusLaporan(r);
  return `
    <div class="popup-judul">Laporan warga: ${esc(r.kecamatan || 'Kota Bengkulu')}</div>
    <div class="popup-badge-baris">
      ${badgeJenis(r.jenis)}
      ${badgeSumber(true)}
      <span class="badge ${status.kelas}">${status.label}</span>
    </div>
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Kecamatan', r.kecamatan || '—')}
      ${barisPopup('Tanggal', format.tanggal(r.tanggal))}
    </table>
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#627983">${esc(r.deskripsi || '')}</p>
    ${foto}
  `;
}

/* ---------------- Gambar penanda ---------------- */
function gambarTitik(rows) {
  lapisan.rob.clearLayers();
  lapisan.abrasi.clearLayers();
  indeksPenanda = new Map();

  for (const s of rows) {
    const jenis = normalJenis(s.jenis);
    const ukuran = ukuranPenanda(s);
    const judul = `${s.nama} | ${labelJenis(jenis, s.jenisAncaman)}`;
    const penanda = L.marker([s.lat, s.lng], {
      icon: buatIkon(s),
      riseOnHover: true,
      keyboard: true,
      title: judul,
    });

    penanda.on('click', pastikanZoomPopup);
    penanda.bindPopup(popupTitik(s), {
      maxWidth: 340,
      maxHeight: 420,
      autoPan: false,
    });
    penanda.bindTooltip(judul, { direction: 'top', offset: [0, -ukuran / 2 - 2] });
    (jenis === 'rob' ? lapisan.rob : lapisan.abrasi).addLayer(penanda);
    indeksPenanda.set(s.id, penanda);
  }
}

/* Saat zoom berubah, ikon menyesuaikan: titik mini di zoom jauh, pin penuh
 * saat diperbesar. Posisi/koordinat data tidak ikut diubah. */
function perbaruiUkuranPenanda() {
  for (const s of semuaTitik) {
    const penanda = indeksPenanda.get(s.id);
    if (!penanda) continue;
    penanda.setIcon(buatIkon(s));
    const tip = penanda.getTooltip();
    if (tip) tip.options.offset = [0, -ukuranPenanda(s) / 2 - 2];
  }
  for (const r of semuaLaporan) {
    const penanda = indeksLaporan.get(r.id);
    if (!penanda) continue;
    penanda.setIcon(buatIkon(r, true));
    const tip = penanda.getTooltip();
    if (tip) tip.options.offset = [0, -ukuranPenanda(r, true) / 2 - 2];
  }
}
peta.on('zoomend', perbaruiUkuranPenanda);

peta.on('popupopen', (e) => {
  document.body.classList.add('popup-terbuka');
  // Ukur segera, lalu sekali lagi setelah layout selesai. Pemanggilan kedua
  // penting untuk popup dengan judul/URL yang baru saja membungkus baris.
  jagaPopupDalamPeta(e);
  requestAnimationFrame(() => jagaPopupDalamPeta(e));
});
peta.on('popupclose', () => {
  document.body.classList.remove('popup-terbuka');
});

function bukaTitik(s) {
  const jenis = normalJenis(s.jenis);
  const cekLayer = document.getElementById(jenis === 'rob' ? 'layerRob' : 'layerAbrasi');
  if (cekLayer && !cekLayer.checked) {
    cekLayer.checked = true;
    perbaruiVisibilitasLayer(peta, lapisan);
  }

  const target = indeksPenanda.get(s.id);
  if (!target) return;

  pastikanZoomPopup();
  peta.panInside(target.getLatLng(), { padding: [48, 48], animate: false });
  const elemen = target.getElement();
  if (elemen) elemen.click();
  else target.openPopup();

  if (window.innerWidth < 768) tutupSidebar();
}

function gambarLaporan(rows) {
  lapisan.laporan.clearLayers();
  indeksLaporan = new Map();
  for (const r of rows) {
    const jenis = normalJenis(r.jenis);
    const status = statusLaporan(r);
    const judul = `Laporan warga — ${labelJenis(jenis)} • ${status.label}`;
    const penanda = L.marker([r.lat, r.lng], {
      icon: buatIkon(r, true),
      riseOnHover: true,
      keyboard: true,
      title: judul,
    })
      .bindPopup(popupLaporan(r), { maxWidth: 320 })
      .bindTooltip(judul, { direction: 'top', offset: [0, -16] })
      .addTo(lapisan.laporan);
    if (r.id != null) indeksLaporan.set(r.id, penanda);
  }
}

/* ---------------- Daftar titik di sidebar ---------------- */
function gambarDaftar(rows) {
  const wadah  = document.getElementById('daftarTitik');
  const jumlah = document.getElementById('jumlahTitik');
  jumlah.textContent = `(${rows.length})`;

  if (!rows.length) {
    wadah.innerHTML = '<p class="sidebar-kosong">Tidak ada titik sesuai filter.</p>';
    return;
  }

  wadah.innerHTML = '';
  for (const s of rows) {
    const jenis = normalJenis(s.jenis);
    const punyaRisiko = kategoriValid(s.kategori);
    const risiko = punyaRisiko
      ? `<span class="item-risiko item-risiko-${String(s.kategori).toLowerCase()}">${esc(s.kategori)}</span>`
      : '';
    const judul = `${s.nama} | ${labelJenis(jenis, s.jenisAncaman)}`;

    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'sidebar-item';
    btn.title     = judul;
    btn.setAttribute('aria-label', `Tampilkan ${judul} di peta`);
    btn.innerHTML = `
      <span class="daftar-ikon daftar-ikon-${jenis}" aria-hidden="true">${ikonJenis(jenis)}</span>
      <span class="item-teks">
        <span class="item-nama">${esc(s.nama)}</span>
        <span class="item-meta">
          <span class="item-jenis item-jenis-${jenis}">${esc(
            labelJenis(jenis, s.jenisAncaman)
          )}</span>
          ${risiko}
        </span>
      </span>
      <span class="item-kec">${esc(s.kecamatan || '')}</span>
    `;
    btn.addEventListener('click', () => bukaTitik(s));
    wadah.appendChild(btn);
  }
}

/* ---------------- Filter ---------------- */
function terapkanFilter() {
  const hasil = filterTitik(semuaTitik, bacaFilter());

  gambarTitik(hasil);
  gambarDaftar(hasil);
}

/* ---------------- Sidebar buka / tutup ---------------- */
const sidebar  = document.getElementById('petaSidebar');
const overlay  = document.getElementById('sidebarOverlay');
const btnBuka  = document.getElementById('btnBukaSidebar');

function bukaSidebar() {
  sidebar.classList.add('terbuka');
  overlay.classList.add('aktif');
  btnBuka.classList.add('tersembunyi');
  document.body.classList.add('sidebar-terbuka');
  // Paksa peta recalculate ukuran setelah sidebar muncul
  setTimeout(() => peta.invalidateSize(), 300);
}

function tutupSidebar() {
  sidebar.classList.remove('terbuka');
  overlay.classList.remove('aktif');
  btnBuka.classList.remove('tersembunyi');
  document.body.classList.remove('sidebar-terbuka');
  setTimeout(() => peta.invalidateSize(), 300);
}

btnBuka.addEventListener('click', bukaSidebar);
document.getElementById('btnTutupSidebar').addEventListener('click', tutupSidebar);
overlay.addEventListener('click', tutupSidebar);

/* ---------------- Legenda toggle ---------------- */
const legendaIsi    = document.getElementById('legendaIsi');
const btnLegenda    = document.getElementById('btnLegenda');
// Di layar kecil legenda dimulai tertutup agar peta tidak tertutup;
// tombol Legenda tetap tersedia untuk membukanya.
let legendaVisible  = !window.matchMedia('(max-width: 600px)').matches;

function perbaruiLegenda() {
  legendaIsi.classList.toggle('tersembunyi', !legendaVisible);
  btnLegenda.title = legendaVisible ? 'Sembunyikan legenda' : 'Tampilkan legenda';
}

btnLegenda.addEventListener('click', () => {
  legendaVisible = !legendaVisible;
  perbaruiLegenda();
});

perbaruiLegenda();

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
    select.querySelectorAll('option:not(:first-child)').forEach((opt) => opt.remove());
    for (const k of kecamatan) {
      const opt      = document.createElement('option');
      opt.value      = k;
      opt.textContent = k;
      select.appendChild(opt);
    }

    terapkanFilter();
    gambarLaporan(semuaLaporan);

    // Fokus ke seluruh sebaran data, bukan hanya sebagian koridor pesisir.
    if (semuaTitik.length) {
      const batasData = L.latLngBounds(semuaTitik.map((s) => [s.lat, s.lng]));
      peta.fitBounds(batasData.pad(0.08), { padding: [24, 24], maxZoom: 13 });
    } else {
      peta.fitBounds(BATAS_PESISIR, { padding: [24, 24], maxZoom: 12 });
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
  document.getElementById(id).addEventListener('change', () => perbaruiVisibilitasLayer(peta, lapisan));
}

/* ---------------- Layer Zona Bahaya (raster GEA lokal) ---------------- */
const layerGea = buatLayerGea(peta, {
  onGagal: () => {
    const cek = document.getElementById('layerGea');
    if (cek) cek.checked = false;
    toast('Zona Bahaya gagal dimuat. Coba muat ulang halaman.', 'gagal');
  },
});

document.getElementById('layerGea').addEventListener('change', (e) => {
  if (e.target.checked) layerGea.aktifkan();
  else layerGea.nonaktifkan();
});

muat();

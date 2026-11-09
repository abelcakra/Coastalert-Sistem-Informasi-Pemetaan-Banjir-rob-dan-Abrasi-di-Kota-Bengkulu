/**
 * admin-peta.js - Peta interaktif admin.
 * Menampilkan kategori bencana & tingkat kerawanan pada peta, lengkap dengan filter.
 *
 * Bentuk penanda : lingkaran = data kejadian, belah ketupat = laporan warga
 * Warna isi      : kategori bencana (rob biru, abrasi pasir)
 * Ikon penanda   : ikon bersama peta publik (rob/abrasi)
 * Cincin penanda : tingkat kerawanan (Rendah/Sedang/Tinggi)
 * Ukuran penanda : luas area terdampak
 */
import { buatLayerGea } from '../../js/layer-gea.js';
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
} from '../../js/peta-common.js?v=1';
import {
  api,
  badgeJenis,
  badgeKategori,
  badgeStatus,
  badgeVerifikasi,
  esc,
  format,
  labelJenis,
  labelTanggal,
  pasangLayout,
  toast,
  wajibLogin,
} from './admin-common.js?v=7';

let peta;
let layerGea = null;
const lapisan = { rob: null, abrasi: null, laporan: null };
let semuaTitik = [];
let semuaLaporan = [];
let indeksPenanda = new Map(); // id titik -> layer penanda
let indeksLaporan = new Map(); // id laporan -> layer penanda laporan
let ukuranPenanda;
let buatIkon;
let jagaPopupDalamPeta;
let pastikanZoomPopup;

/* ---------------- Inisialisasi peta ---------------- */
function siapkanPeta() {
  peta = L.map('petaAdmin', {
    zoomControl: true,
    maxBounds: BATAS_PESISIR.pad(1.5),
    maxBoundsViscosity: 0.65,
  }).setView(PUSAT_PESISIR, 12);
  ({ ukuranPenanda, buatIkon, jagaPopupDalamPeta, pastikanZoomPopup } = buatBantuanPeta(peta));
  L.tileLayer(URL_OSM, {
    maxZoom: 19,
    attribution: ATRIBUSI,
  })
    .on('tileerror', () => toast('Peta dasar gagal dimuat. Periksa koneksi internet.', 'gagal'))
    .addTo(peta);

  /*
   * Semua pin langsung ditampilkan sebagai penanda individual, tanpa klaster
   * bernomor. Sebaran data sudah terlihat sejak tampilan awal.
   */
  lapisan.rob = L.layerGroup().addTo(peta);
  lapisan.abrasi = L.layerGroup().addTo(peta);
  lapisan.laporan = L.layerGroup().addTo(peta);
  peta.on('zoomend', perbaruiUkuranPenanda);
  peta.on('popupopen', (e) => {
    jagaPopupDalamPeta(e);
    requestAnimationFrame(() => jagaPopupDalamPeta(e));
  });

  layerGea = buatLayerGea(peta, {
    onGagal: () => {
      const cek = document.getElementById('layerGea');
      if (cek) cek.checked = false;
      toast('Zona Bahaya gagal dimuat. Coba muat ulang halaman.', 'gagal');
    },
  });

  setTimeout(() => peta.invalidateSize(), 150);
}

/* ---------------- Penanda ---------------- */
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
  const catatanZona = kategoriValid(s.kategori)
    ? ''
    : 'Kategori risiko belum ditetapkan. Zona Bahaya hanya acuan wilayah, bukan status verifikasi kejadian.';
  const deskripsi = deskripsiTanpaCatatanPin(s.deskripsi);

  return `
    <div class="popup-judul">${esc(s.nama)} | ${esc(labelJenis(s.jenis, s.jenisAncaman))}</div>
    <div class="popup-badge-baris">
      ${badgeJenis(s.jenis, s.jenisAncaman)}
      ${badgeKategori(s.kategori)}
      ${badgeVerifikasi(s.terverifikasi)}
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
    <p style="margin:.5rem 0 0;font-size:.8rem">
      <a href="titik.html?fokus=${encodeURIComponent(s.id)}">Kelola titik ini →</a>
    </p>`;
}

function popupLaporan(r) {
  const foto = r.foto
    ? `<img src="${esc(r.foto)}" alt="Foto laporan" style="width:100%;border-radius:8px;margin-top:.5rem" />`
    : '';
  return `
    <div class="popup-judul">Laporan warga: ${esc(r.kecamatan || 'Kota Bengkulu')}</div>
    ${badgeJenis(r.jenis)} ${badgeStatus(r.status || 'diverifikasi')}
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Kecamatan', r.kecamatan || '—')}
      ${barisPopup('Tanggal', labelTanggal(r.tanggal))}
    </table>
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#627983">${esc(r.deskripsi || '')}</p>
    ${foto}`;
}

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

/* Ukuran ikon mengikuti zoom: titik mini saat jauh, pin penuh saat dekat.
 * Koordinat data tetap, hanya tampilan penanda yang menyesuaikan. */
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

function gambarLaporan(rows) {
  lapisan.laporan.clearLayers();
  semuaLaporan = rows;
  indeksLaporan = new Map();
  for (const r of rows) {
    const jenis = normalJenis(r.jenis);
    const judul = `Laporan warga — ${labelJenis(jenis)}`;
    const penanda = L.marker([r.lat, r.lng], {
      icon: buatIkon(r, true),
      riseOnHover: true,
      keyboard: true,
      title: judul,
    })
      .bindPopup(popupLaporan(r), { maxWidth: 330 })
      .bindTooltip(judul, { direction: 'top', offset: [0, -16] })
      .addTo(lapisan.laporan);
    if (r.id != null) indeksLaporan.set(r.id, penanda);
  }
}

/* ---------------- Daftar titik ---------------- */
function gambarDaftar(rows) {
  const wadah = document.getElementById('daftarTitik');
  document.getElementById('jumlahTitik').textContent = `(${rows.length})`;

  if (!rows.length) {
    wadah.innerHTML = '<p class="kosong">Tidak ada titik sesuai filter.</p>';
    return;
  }

  wadah.innerHTML = '';
  for (const s of rows) {
    const tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'item-titik';
    const jenis = normalJenis(s.jenis);
    tombol.innerHTML = `
      <span class="legenda-penanda legenda-penanda-${jenis}" aria-hidden="true">${ikonJenis(jenis)}</span>
      <span class="nama">${esc(s.nama)}</span>
      ${kategoriValid(s.kategori) ? badgeKategori(s.kategori) : badgeVerifikasi(s.terverifikasi)}`;
    tombol.addEventListener('click', () => bukaTitik(s));
    wadah.appendChild(tombol);
  }
}

function bukaTitik(s) {
  const jenis = normalJenis(s.jenis);
  const cekLayer = document.getElementById(jenis === 'rob' ? 'layerRob' : 'layerAbrasi');
  if (cekLayer && !cekLayer.checked) {
    cekLayer.checked = true;
    perbaruiVisibilitasLayer(peta, lapisan);
  }

  const target = indeksPenanda.get(s.id);
  if (!target) return;

  // Jalankan klik pada elemen penanda agar popup terbuka lewat jalur yang
  // sama dengan klik langsung di peta; posisinya dirapikan oleh popupopen.
  pastikanZoomPopup();
  peta.panInside(target.getLatLng(), { padding: [48, 48], animate: false });
  const elemen = target.getElement();
  if (elemen) elemen.click();
  else target.openPopup();
}

/* ---------------- Filter ---------------- */
function terapkanFilter() {
  const hasil = filterTitik(semuaTitik, bacaFilter());
  gambarTitik(hasil);
  gambarDaftar(hasil);
}

/* ---------------- Muat data ---------------- */
async function muat() {
  try {
    const [spots, laporan] = await Promise.all([
      api('/api/spots'),
      api('/api/reports/publik').catch(() => ({ data: [] })),
    ]);

    semuaTitik = spots.data || [];

    const select = document.getElementById('filterKecamatan');
    for (const k of [...new Set(semuaTitik.map((s) => s.kecamatan).filter(Boolean))].sort()) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      select.appendChild(opt);
    }

    terapkanFilter();
    gambarLaporan(laporan.data || []);

    if (semuaTitik.length) {
      // Fokus ke seluruh sebaran data, bukan hanya sebagian koridor pesisir.
      const batasData = L.latLngBounds(semuaTitik.map((s) => [s.lat, s.lng]));
      peta.fitBounds(batasData.pad(0.08), { padding: [24, 24], maxZoom: 13 });
    }
    setTimeout(() => peta.invalidateSize(), 200);
  } catch (err) {
    toast(`Gagal memuat data peta: ${err.message}`, 'gagal');
  }
}

/* ---------------- Kejadian ---------------- */
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

['layerRob', 'layerAbrasi', 'layerLaporan'].forEach((id) =>
  document.getElementById(id).addEventListener('change', () => perbaruiVisibilitasLayer(peta, lapisan))
);

document.getElementById('layerGea').addEventListener('change', (e) => {
  if (e.target.checked) layerGea?.aktifkan();
  else layerGea?.nonaktifkan();
});

/* ---------------- Mulai ---------------- */
(async () => {
  if (!(await wajibLogin())) return;
  pasangLayout({
    aktif: 'peta.html',
    judul: 'Peta Interaktif',
    subjudul: 'Sebaran titik rawan berdasarkan kategori bencana dan tingkat kerawanan',
  });
  siapkanPeta();
  muat();
})();

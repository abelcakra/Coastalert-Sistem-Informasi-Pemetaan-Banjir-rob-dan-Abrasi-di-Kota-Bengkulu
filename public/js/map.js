/**
 * map.js - Halaman peta interaktif publik.
 */
import { api, esc, format, radiusTitik, toast } from './common.js';
import { buatLayerBnpb } from './layer-bnpb.js';

const PUSAT_BENGKULU = [-3.785, 102.26];
const URL_OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const KATEGORI = new Set(['Rendah', 'Sedang', 'Tinggi']);
const LABEL_JENIS = { rob: 'Banjir rob', abrasi: 'Abrasi' };

/* ---------------- Inisialisasi peta ---------------- */
const peta = L.map('peta', { zoomControl: false }).setView(PUSAT_BENGKULU, 12);
// Kontrol zoom ditaruh di kanan atas agar tidak menumpuk dengan tombol Filter (kiri atas)
L.control.zoom({ position: 'topright' }).addTo(peta);

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

/* ---------------- Helper tampilan ---------------- */
function normalJenis(jenis) {
  return jenis === 'abrasi' ? 'abrasi' : 'rob';
}

function labelJenis(jenis) {
  return LABEL_JENIS[normalJenis(jenis)];
}

function kategoriValid(kategori) {
  return KATEGORI.has(kategori);
}

function ikonJenis(jenis) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ikon-${normalJenis(jenis)}"></use></svg>`;
}

function badgeJenis(jenis) {
  const j = normalJenis(jenis);
  return `<span class="badge badge-jenis badge-jenis-${j}">${ikonJenis(j)} ${labelJenis(j)}</span>`;
}

function badgeSumber(laporan = false) {
  return `<span class="badge badge-sumber${laporan ? ' badge-sumber-laporan' : ''}">${laporan ? 'Laporan warga' : 'Data kejadian'}</span>`;
}

function badgeRisiko(kategori) {
  if (!kategoriValid(kategori)) return '';
  const k = String(kategori).toLowerCase();
  return `<span class="badge badge-risiko badge-risiko-${k}">${esc(kategori)}</span>`;
}

function statusLaporan(r) {
  // Endpoint publik hanya mengirim laporan terverifikasi; fallback ini menjaga
  // status tetap tampil terpisah jika kelak endpoint menyertakan status lain.
  const status = r.status || 'diverifikasi';
  if (status === 'pending') return { label: 'Menunggu verifikasi', kelas: 'pending' };
  if (status === 'ditolak') return { label: 'Ditolak', kelas: 'ditolak' };
  return { label: 'Terverifikasi', kelas: 'diverifikasi' };
}

function ukuranPenanda(s, laporan = false) {
  if (laporan) return 28;
  return Math.round(Math.max(26, Math.min(40, radiusTitik(s.luasTerdampakHa) * 2)));
}

function htmlPenanda(s, laporan = false) {
  const j = normalJenis(s.jenis);
  const risiko = !laporan && kategoriValid(s.kategori)
    ? ` risiko-${String(s.kategori).toLowerCase()}`
    : '';
  return `<span class="penanda penanda-${j}${laporan ? ' penanda-laporan' : ''}${risiko}">${ikonJenis(j)}</span>`;
}

function buatIkon(s, laporan = false) {
  const ukuran = ukuranPenanda(s, laporan);
  return L.divIcon({
    className: 'penanda-wadah',
    html: htmlPenanda(s, laporan),
    iconSize: [ukuran, ukuran],
    iconAnchor: [ukuran / 2, ukuran / 2],
    popupAnchor: [0, -ukuran / 2 + 2],
  });
}

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
    <div class="popup-badge-baris">
      ${badgeJenis(s.jenis)}
      ${badgeSumber(false)}
      ${badgeRisiko(s.kategori)}
    </div>
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Kecamatan', s.kecamatan || '—')}
      ${detail}
      ${barisPopup('Luas terdampak', s.luasTerdampakHa ? `${format.angka(s.luasTerdampakHa, 1)} Ha` : '—')}
      ${barisPopup('KK terdampak', s.kkTerdampak ? `${format.angka(s.kkTerdampak)} KK` : '—')}
      ${barisPopup('Tahun data', s.tahun || '—')}
      ${barisPopup('Sumber', s.sumber || '—')}
      ${barisPopup('Koordinat', `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`)}
    </table>
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#627983">${esc(s.deskripsi || '')}</p>
  `;
}

function popupLaporan(r) {
  const foto = r.foto
    ? `<img src="${esc(r.foto)}" alt="Foto laporan" style="width:100%;border-radius:8px;margin-top:.5rem" />`
    : '';
  const status = statusLaporan(r);
  return `
    <div class="popup-judul">Laporan: ${esc(r.alamat || 'Tanpa alamat')}</div>
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
  cluster.rob.clearLayers();
  cluster.abrasi.clearLayers();

  for (const s of rows) {
    const jenis = normalJenis(s.jenis);
    const ukuran = ukuranPenanda(s);
    const judul = `${s.nama} — ${labelJenis(jenis)}${kategoriValid(s.kategori) ? ` • ${s.kategori}` : ''}`;
    const penanda = L.marker([s.lat, s.lng], {
      icon: buatIkon(s),
      riseOnHover: true,
      keyboard: true,
      title: judul,
    });

    penanda.bindPopup(popupTitik(s), { maxWidth: 320 });
    penanda.bindTooltip(judul, { direction: 'top', offset: [0, -ukuran / 2 - 2] });
    (jenis === 'rob' ? cluster.rob : cluster.abrasi).addLayer(penanda);
  }
}

function gambarLaporan(rows) {
  cluster.laporan.clearLayers();
  for (const r of rows) {
    const jenis = normalJenis(r.jenis);
    const status = statusLaporan(r);
    const judul = `Laporan warga — ${labelJenis(jenis)} • ${status.label}`;
    L.marker([r.lat, r.lng], {
      icon: buatIkon(r, true),
      riseOnHover: true,
      keyboard: true,
      title: judul,
    })
      .bindPopup(popupLaporan(r), { maxWidth: 320 })
      .bindTooltip(judul, { direction: 'top', offset: [0, -16] })
      .addTo(cluster.laporan);
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
    const judul = `${s.nama} — ${labelJenis(jenis)}${punyaRisiko ? `, kerawanan ${s.kategori}` : ''}`;

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
          <span class="item-jenis item-jenis-${jenis}">${labelJenis(jenis)}</span>
          ${risiko}
        </span>
      </span>
      <span class="item-kec">${esc(s.kecamatan || '')}</span>
    `;
    btn.addEventListener('click', () => {
      peta.setView([s.lat, s.lng], 15, { animate: true });
      const layerGrup = jenis === 'rob' ? cluster.rob : cluster.abrasi;
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
    // Data tanpa klasifikasi tidak dipaksa masuk/masuk keluar oleh filter risiko.
    if (kategoriValid(s.kategori) && !f.kategori.includes(s.kategori)) return false;
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

/* ---------------- Layer zona bahaya BNPB ---------------- */
const layerBnpb = buatLayerBnpb(peta, {
  onGagal: () => {
    const cek = document.getElementById('layerBnpb');
    if (cek) cek.checked = false;
    toast('Zona bahaya BNPB sedang tidak dapat diakses. Coba lagi nanti.', 'gagal');
  },
});

document.getElementById('layerBnpb').addEventListener('change', (e) => {
  if (e.target.checked) layerBnpb.aktifkan();
  else layerBnpb.nonaktifkan();
});

muat();

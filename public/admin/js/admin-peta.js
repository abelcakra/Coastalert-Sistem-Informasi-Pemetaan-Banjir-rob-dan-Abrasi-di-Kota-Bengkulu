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
import { buatLayerBnpb } from '../../js/layer-bnpb.js';
import {
  api,
  badgeJenis,
  badgeKategori,
  badgeStatus,
  esc,
  format,
  labelTanggal,
  pasangLayout,
  radiusPeta,
  toast,
  wajibLogin,
} from './admin-common.js?v=2';

const PUSAT_BENGKULU = [-3.785, 102.26];
const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

let peta;
let layerBnpb = null;
const lapisan = { rob: null, abrasi: null, laporan: null };
let semuaTitik = [];
let indeksPenanda = new Map(); // id titik -> layer penanda

/* ---------------- Inisialisasi peta ---------------- */
function siapkanPeta() {
  peta = L.map('petaAdmin', { zoomControl: true }).setView(PUSAT_BENGKULU, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ATRIBUSI,
  })
    .on('tileerror', () => toast('Peta dasar gagal dimuat. Periksa koneksi internet.', 'gagal'))
    .addTo(peta);

  lapisan.rob = L.layerGroup().addTo(peta);
  lapisan.abrasi = L.layerGroup().addTo(peta);
  lapisan.laporan = L.layerGroup().addTo(peta);

  layerBnpb = buatLayerBnpb(peta, {
    onGagal: () => {
      const cek = document.getElementById('layerBnpb');
      if (cek) cek.checked = false;
      toast('Zona bahaya BNPB sedang tidak dapat diakses. Coba lagi nanti.', 'gagal');
    },
  });

  setTimeout(() => peta.invalidateSize(), 150);
}

/* ---------------- Penanda ---------------- */
const KATEGORI = new Set(['Rendah', 'Sedang', 'Tinggi']);

function normalJenis(jenis) {
  return jenis === 'abrasi' ? 'abrasi' : 'rob';
}

function kategoriValid(kategori) {
  return KATEGORI.has(kategori);
}

function ikonJenis(jenis) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ikon-${normalJenis(jenis)}"></use></svg>`;
}

function ukuranPenanda(s, laporan = false) {
  if (laporan) return 28;
  return Math.round(Math.max(26, Math.min(40, radiusPeta(s.luasTerdampakHa) * 2)));
}

function htmlPenanda(s, laporan = false) {
  const jenis = normalJenis(s.jenis);
  const risiko = !laporan && kategoriValid(s.kategori)
    ? ` risiko-${String(s.kategori).toLowerCase()}`
    : '';
  return `<span class="penanda penanda-${jenis}${laporan ? ' penanda-laporan' : ''}${risiko}">${ikonJenis(jenis)}</span>`;
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
    ${badgeJenis(s.jenis)} ${badgeKategori(s.kategori)}
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Kecamatan', s.kecamatan || '—')}
      ${detail}
      ${barisPopup('Luas terdampak', s.luasTerdampakHa ? `${format.angka(s.luasTerdampakHa, 1)} Ha` : '—')}
      ${barisPopup('KK terdampak', s.kkTerdampak ? `${format.angka(s.kkTerdampak)} KK` : '—')}
      ${barisPopup('Tahun data', s.tahun || '—')}
      ${barisPopup('Koordinat', `${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}`)}
    </table>
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#627983">${esc(s.deskripsi || '')}</p>
    <p style="margin:.5rem 0 0;font-size:.8rem">
      <a href="titik.html?fokus=${encodeURIComponent(s.id)}">Kelola titik ini →</a>
    </p>`;
}

function popupLaporan(r) {
  const foto = r.foto
    ? `<img src="${esc(r.foto)}" alt="Foto laporan" style="width:100%;border-radius:8px;margin-top:.5rem" />`
    : '';
  return `
    <div class="popup-judul">Laporan: ${esc(r.alamat || 'Tanpa alamat')}</div>
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
    const judul = `${s.nama} — ${jenis === 'abrasi' ? 'Abrasi' : 'Banjir rob'}${kategoriValid(s.kategori) ? ` • ${s.kategori}` : ''}`;
    const penanda = L.marker([s.lat, s.lng], {
      icon: buatIkon(s),
      riseOnHover: true,
      keyboard: true,
      title: judul,
    });

    penanda.bindPopup(popupTitik(s), { maxWidth: 330 });
    penanda.bindTooltip(judul, { direction: 'top', offset: [0, -ukuran / 2 - 2] });
    (jenis === 'rob' ? lapisan.rob : lapisan.abrasi).addLayer(penanda);
    indeksPenanda.set(s.id, penanda);
  }
}

function gambarLaporan(rows) {
  lapisan.laporan.clearLayers();
  for (const r of rows) {
    const jenis = normalJenis(r.jenis);
    const judul = `Laporan warga — ${jenis === 'abrasi' ? 'Abrasi' : 'Banjir rob'}`;
    L.marker([r.lat, r.lng], {
      icon: buatIkon(r, true),
      riseOnHover: true,
      keyboard: true,
      title: judul,
    })
      .bindPopup(popupLaporan(r), { maxWidth: 330 })
      .bindTooltip(judul, { direction: 'top', offset: [0, -16] })
      .addTo(lapisan.laporan);
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
      ${badgeKategori(s.kategori)}`;
    tombol.addEventListener('click', () => {
      peta.setView([s.lat, s.lng], 15, { animate: true });
      setTimeout(() => indeksPenanda.get(s.id)?.openPopup(), 350);
    });
    wadah.appendChild(tombol);
  }
}

/* ---------------- Filter ---------------- */
function bacaFilter() {
  return {
    jenis: document.getElementById('filterJenis').value,
    kecamatan: document.getElementById('filterKecamatan').value,
    kategori: [...document.querySelectorAll('.filter-kategori:checked')].map((c) => c.value),
    cari: document.getElementById('cariTitik').value.trim().toLowerCase(),
  };
}

function terapkanFilter() {
  const f = bacaFilter();
  const hasil = semuaTitik.filter((s) => {
    if (f.jenis && s.jenis !== f.jenis) return false;
    if (f.kecamatan && s.kecamatan !== f.kecamatan) return false;
    if (!f.kategori.includes(s.kategori)) return false;
    if (f.cari && ![s.nama, s.kecamatan, s.deskripsi].join(' ').toLowerCase().includes(f.cari)) return false;
    return true;
  });
  gambarTitik(hasil);
  gambarDaftar(hasil);
}

function perbaruiLayer() {
  const pasang = (grup, nyala) => {
    const ada = peta.hasLayer(grup);
    if (nyala && !ada) grup.addTo(peta);
    if (!nyala && ada) peta.removeLayer(grup);
  };
  pasang(lapisan.rob, document.getElementById('layerRob').checked);
  pasang(lapisan.abrasi, document.getElementById('layerAbrasi').checked);
  pasang(lapisan.laporan, document.getElementById('layerLaporan').checked);
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
      peta.fitBounds(L.latLngBounds(semuaTitik.map((s) => [s.lat, s.lng])).pad(0.25), { maxZoom: 14 });
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
  document.getElementById(id).addEventListener('change', perbaruiLayer)
);

document.getElementById('layerBnpb').addEventListener('change', (e) => {
  if (e.target.checked) layerBnpb?.aktifkan();
  else layerBnpb?.nonaktifkan();
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

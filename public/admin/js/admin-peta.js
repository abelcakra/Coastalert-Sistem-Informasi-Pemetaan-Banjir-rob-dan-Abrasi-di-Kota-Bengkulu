/**
 * admin-peta.js - Peta interaktif admin.
 * Menampilkan kategori bencana & tingkat kerawanan pada peta, lengkap dengan filter.
 *
 * Bentuk penanda : lingkaran = banjir rob, kotak = abrasi
 * Warna penanda  : tingkat kerawanan (Rendah/Sedang/Tinggi)
 * Ukuran penanda : luas area terdampak
 */
import {
  api,
  badgeJenis,
  badgeKategori,
  esc,
  format,
  labelTanggal,
  pasangLayout,
  radiusPeta,
  toast,
  wajibLogin,
  warnaTitik,
} from './admin-common.js';

const PUSAT_BENGKULU = [-3.785, 102.26];
const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

let peta;
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
  setTimeout(() => peta.invalidateSize(), 150);
}

/* ---------------- Penanda ---------------- */
function ikonKotak(warna, ukuran) {
  return L.divIcon({
    className: 'penanda-abrasi',
    html: `<span style="background:${warna};width:${ukuran}px;height:${ukuran}px"></span>`,
    iconSize: [ukuran, ukuran],
    iconAnchor: [ukuran / 2, ukuran / 2],
    popupAnchor: [0, -ukuran / 2],
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
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#4b5563">${esc(s.deskripsi || '')}</p>
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
    ${badgeJenis(r.jenis)} <span class="badge diverifikasi">Terverifikasi</span>
    <table class="popup-tabel" style="margin-top:.5rem">
      ${barisPopup('Kecamatan', r.kecamatan || '—')}
      ${barisPopup('Tanggal', labelTanggal(r.tanggal))}
    </table>
    <p style="margin:.5rem 0 0;font-size:.82rem;color:#4b5563">${esc(r.deskripsi || '')}</p>
    ${foto}`;
}

function gambarTitik(rows) {
  lapisan.rob.clearLayers();
  lapisan.abrasi.clearLayers();
  indeksPenanda = new Map();

  for (const s of rows) {
    const warna = warnaTitik(s.jenis, s.kategori);
    const ukuran = radiusPeta(s.luasTerdampakHa);
    let penanda;

    if (s.jenis === 'abrasi') {
      penanda = L.marker([s.lat, s.lng], { icon: ikonKotak(warna, ukuran * 1.7), title: s.nama });
    } else {
      penanda = L.circleMarker([s.lat, s.lng], {
        radius: ukuran,
        color: '#ffffff',
        weight: 2,
        fillColor: warna,
        fillOpacity: 0.92,
      });
    }

    penanda.bindPopup(popupTitik(s), { maxWidth: 330 });
    penanda.bindTooltip(`${s.nama} · ${s.kategori}`, { direction: 'top', offset: [0, -6] });
    (s.jenis === 'rob' ? lapisan.rob : lapisan.abrasi).addLayer(penanda);
    indeksPenanda.set(s.id, penanda);
  }
}

function gambarLaporan(rows) {
  lapisan.laporan.clearLayers();
  for (const r of rows) {
    L.circleMarker([r.lat, r.lng], {
      radius: 8,
      color: '#ffffff',
      weight: 2,
      dashArray: '2 3',
      fillColor: '#7c3aed',
      fillOpacity: 0.95,
    })
      .bindPopup(popupLaporan(r), { maxWidth: 330 })
      .bindTooltip('Laporan warga terverifikasi', { direction: 'top', offset: [0, -6] })
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
    const bentuk = s.jenis === 'abrasi' ? 'kotak' : 'bulat';
    tombol.innerHTML = `
      <span class="legenda-bentuk ${bentuk}" style="background:${warnaTitik(s.jenis, s.kategori)}"></span>
      <span class="nama">${esc(s.nama)}</span>
      <span class="tag-kecil">${esc(s.kategori)}</span>`;
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

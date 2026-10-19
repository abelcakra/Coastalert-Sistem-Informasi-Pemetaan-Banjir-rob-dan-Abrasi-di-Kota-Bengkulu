/**
 * admin-common.js - Fungsi & komponen bersama seluruh halaman admin.
 */
import {
  api,
  auth,
  esc,
  format,
  isiSelect,
  radiusTitik,
  toast,
  WARNA_ABRASI,
  WARNA_ROB,
  warnaTitik,
} from '../../js/common.js';

export { api, auth, esc, format, isiSelect, toast, WARNA_ABRASI, WARNA_ROB, warnaTitik };

/** Ukuran penanda pada peta admin (memakai rumus yang sama dengan peta publik). */
export const radiusPeta = radiusTitik;

/* ---------------- Label & warna status ---------------- */
export const LABEL_STATUS = {
  pending: 'Menunggu',
  diverifikasi: 'Terverifikasi',
  ditolak: 'Ditolak',
};

export const badgeJenis = (j) =>
  `<span class="badge ${esc(j)}">${j === 'abrasi' ? 'Abrasi' : 'Banjir Rob'}</span>`;

export const badgeKategori = (k) =>
  `<span class="badge ${esc(String(k).toLowerCase())}">${esc(k)}</span>`;

export const badgeStatus = (s) =>
  `<span class="badge ${esc(s)}">${esc(LABEL_STATUS[s] || s)}</span>`;

export const labelTanggal = (teks) => {
  if (!teks) return '—';
  const d = new Date(teks);
  if (Number.isNaN(d.getTime())) return teks;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

/* ---------------- Ikon SVG (tanpa emoji) ---------------- */
const svgIkon = (isi, ukuran = 17) =>
  `<svg viewBox="0 0 24 24" width="${ukuran}" height="${ukuran}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isi}</svg>`;

const IKON = {
  dashboard: svgIkon(
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'
  ),
  peta: svgIkon(
    '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>'
  ),
  data: svgIkon(
    '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M12 3v18"/>'
  ),
  verifikasi: svgIkon('<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>'),
  titik: svgIkon(
    '<path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'
  ),
  publik: svgIkon(
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'
  ),
  keluar: svgIkon(
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'
  ),
  pelindung: svgIkon(
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    14
  ),
  gelombang: svgIkon(
    '<path d="M2 9c.6.5 1.2 1 2.5 1C7 10 7 8 9.5 8c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 15c.6.5 1.2 1 2.5 1C7 16 7 14 9.5 14c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    18
  ),
};

/* ---------------- Menu navbar ---------------- */
const MENU = [
  { href: 'index.html',        teks: 'Dashboard'           },
  { href: 'peta.html',         teks: 'Peta Interaktif'     },
  { href: 'data-laporan.html', teks: 'Data Laporan'        },
  { href: 'verifikasi.html',   teks: 'Verifikasi Laporan',  badge: true },
  { href: 'titik.html',        teks: 'Kelola Titik Lokasi' },
  { href: '../dashboard.html', teks: 'Statistik'           },
];

/** Gambar navbar horizontal baru sesuai desain dashboard. */
export function pasangLayout({ aktif, judul, subjudul } = {}) {
  const navbar = document.getElementById('navbarAdmin');
  if (!navbar) return;

  const ikonKeluar = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>`;

  navbar.innerHTML = `
    <a class="db-brand" href="index.html">
      <img src="../img/logo-coastalert.png" alt="CoastAlert" class="logo-img" />
    </a>
    <nav class="db-nav" aria-label="Menu utama admin">
      ${MENU.map((m) => `
        <a href="${m.href}" class="${m.href === aktif ? 'db-aktif' : ''}">
          ${esc(m.teks)}
          ${m.badge ? '<span class="db-badge-nav" id="badgePending" style="display:none">0</span>' : ''}
        </a>`).join('')}
    </nav>
    <div class="db-nav-right">
      <button type="button" class="db-btn-keluar" id="keluarNavbar">
        ${ikonKeluar} Keluar
      </button>
      <div class="db-avatar">A</div>
    </div>`;

  document.getElementById('keluarNavbar')?.addEventListener('click', keluar);

  // Sisipkan page header (judul + subjudul) bila belum ada di halaman
  if (judul && !document.querySelector('.db-page-header')) {
    const wadah = document.querySelector('.db-wrapper, .admin-isi');
    if (wadah) {
      const pageHeader = document.createElement('div');
      pageHeader.className = 'db-page-header';
      pageHeader.innerHTML = `
        <div>
          <h1 class="db-page-title">${esc(judul)}</h1>
          ${subjudul ? `<p class="db-page-sub">${esc(subjudul)}</p>` : ''}
        </div>`;
      wadah.insertBefore(pageHeader, wadah.firstChild);
    }
  }
}

/** Pindah ke halaman login memakai animasi perpindahan halaman. */
function keLogin() {
  if (window.transisiKe) window.transisiKe('login.html');
  else location.replace('login.html');
}

async function keluar() {
  try {
    await api('/api/admin/logout', { method: 'POST', auth: true });
  } catch {
    /* abaikan */
  }
  auth.hapus();
  keLogin();
}

/** Perbarui badge jumlah laporan menunggu verifikasi di navbar. */
export async function perbaruiBadgePending() {
  const el = document.getElementById('badgePending');
  if (!el) return;
  try {
    const { data } = await api('/api/reports?status=pending', { auth: true });
    el.textContent = data.length;
    el.style.display = data.length ? 'inline-block' : 'none';
  } catch {
    /* abaikan */
  }
}

/**
 * Pastikan pengguna sudah login. Mengembalikan true bila boleh lanjut.
 * Bila token tidak ada/tidak valid, diarahkan ke halaman login.
 */
export async function wajibLogin() {
  if (!auth.ada()) {
    keLogin();
    return false;
  }
  try {
    await api('/api/admin/cek', { auth: true });
    return true;
  } catch {
    auth.hapus();
    keLogin();
    return false;
  }
}

/** Modal sederhana: tampilkan / sembunyikan. */
export function pasangModal(idLatar) {
  const latar = document.getElementById(idLatar);
  if (!latar) return { buka: () => {}, tutup: () => {} };
  const tutup = () => latar.classList.remove('tampil');
  latar.addEventListener('click', (e) => {
    if (e.target === latar) tutup();
  });
  latar.querySelectorAll('.tutup-modal').forEach((b) => b.addEventListener('click', tutup));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') tutup();
  });
  return {
    buka: () => latar.classList.add('tampil'),
    tutup,
    isi: () => document.getElementById('isiModal'),
  };
}

/** Peta mini Leaflet di dalam modal detail. */
export function petaMini(idWadah, lat, lng, warna = '#1d6fb8') {
  const el = document.getElementById(idWadah);
  if (!el || typeof L === 'undefined') return;
  // hancurkan peta sebelumnya bila ada
  if (el._petaLeaflet) el._petaLeaflet.remove();
  const peta = L.map(el, { zoomControl: false, attributionControl: false, dragging: false }).setView(
    [lat, lng],
    15
  );
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(peta);
  L.circleMarker([lat, lng], {
    radius: 10,
    color: '#fff',
    weight: 3,
    fillColor: warna,
    fillOpacity: 0.95,
  }).addTo(peta);
  el._petaLeaflet = peta;
  setTimeout(() => peta.invalidateSize(), 120);
  return peta;
}

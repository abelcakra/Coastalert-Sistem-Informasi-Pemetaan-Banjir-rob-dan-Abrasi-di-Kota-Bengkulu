/**
 * transisi.js - Animasi perpindahan halaman (situs publik & panel admin).
 *
 * Cara kerja:
 *  - Saat halaman dimuat, <body> dianimasikan masuk lewat CSS (style.css).
 *  - Saat tautan internal diklik, <body> dianimasikan keluar dulu,
 *    baru peramban berpindah ke halaman tujuan (transisi terasa halus).
 *  - Menghormati preferensi sistem "kurangi gerakan" (prefers-reduced-motion).
 *
 * Dimuat otomatis lewat common.js, sehingga semua halaman ikut memakainya.
 */

const KELAS_KELUAR = 'ca-halaman-keluar';
const DURASI_KELUAR = 200; // ms — samakan dengan animasi di style.css
const kurangiGerak = window.matchMedia('(prefers-reduced-motion: reduce)');

let sedangKeluar = false;

/** Apakah tautan ini boleh memakai animasi perpindahan halaman? */
function tautanBolehDianimasikan(tautan, peristiwa) {
  if (peristiwa.defaultPrevented) return false;
  // Hanya klik kiri biasa (bukan Ctrl/Cmd/Shift/Alt, bukan klik tengah/kanan)
  if (peristiwa.button !== 0 || peristiwa.ctrlKey || peristiwa.metaKey || peristiwa.shiftKey || peristiwa.altKey) {
    return false;
  }
  if (tautan.target && tautan.target !== '_self') return false;
  if (tautan.hasAttribute('download')) return false;

  const href = tautan.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;

  let url;
  try {
    url = new URL(tautan.href, location.href);
  } catch {
    return false;
  }
  if (url.origin !== location.origin) return false;
  // Halaman yang sama (mis. hanya berganti #anchor) → biarkan browser menanganinya
  if (url.pathname === location.pathname && url.search === location.search) return false;
  // Hanya halaman HTML (bukan gambar/berkas unduhan)
  if (!url.pathname.endsWith('/') && !/\.html?$/i.test(url.pathname)) return false;

  return true;
}

/** Animasi keluar lalu pindah ke URL tujuan. */
export function pindahHalaman(tujuan) {
  if (sedangKeluar) return;
  sedangKeluar = true;

  let url;
  try {
    url = new URL(tujuan, location.href).href;
  } catch {
    url = tujuan;
  }

  if (!document.body || kurangiGerak.matches) {
    location.href = url;
    return;
  }

  document.body.classList.add(KELAS_KELUAR);
  setTimeout(() => {
    location.href = url;
  }, DURASI_KELUAR);
}

// Bisa dipanggil dari skrip lain (mis. login & logout admin).
window.transisiKe = pindahHalaman;

// Intersep semua klik tautan internal yang memenuhi syarat.
document.addEventListener('click', (peristiwa) => {
  const tautan = peristiwa.target.closest?.('a[href]');
  if (!tautan || !tautanBolehDianimasikan(tautan, peristiwa)) return;
  peristiwa.preventDefault();
  pindahHalaman(tautan.href);
});

// Kembali dari cache riwayat (bfcache): pulihkan tampilan normal.
window.addEventListener('pageshow', (peristiwa) => {
  if (!peristiwa.persisted) return;
  sedangKeluar = false;
  document.body.classList.remove(KELAS_KELUAR);
});

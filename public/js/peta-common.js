/**
 * peta-common.js - Helper bersama peta publik dan admin.
 *
 * Hanya konstanta/fungsi yang implementasinya sama yang dipusatkan di sini.
 * Popup, daftar titik, filter UI, dan alur muat data tetap berada di halaman
 * masing-masing karena markup dan perilakunya berbeda.
 */
import { esc, radiusTitik } from './common.js';

export const PUSAT_PESISIR = [-3.837, 102.267];
// Koridor pesisir Kota Bengkulu, diperluas agar seluruh titik dataset baru
// (Beringin Raya di utara sampai Teluk Sepang di selatan) tetap terlihat.
export const BATAS_PESISIR = L.latLngBounds([[-3.950, 102.238], [-3.725, 102.313]]);
export const URL_OSM = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const ZOOM_MIN_POPUP = 12;
const PADDING_POPUP = 12;
// Beri ruang untuk tombol Filter dan kontrol zoom di bagian atas peta.
const PADDING_POPUP_ATAS = 60;
const KATEGORI = new Set(['Rendah', 'Sedang', 'Tinggi']);

export function normalJenis(jenis) {
  return jenis === 'abrasi' ? 'abrasi' : 'rob';
}

export function kategoriValid(kategori) {
  return KATEGORI.has(kategori);
}

export function ikonJenis(jenis) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ikon-${normalJenis(jenis)}"></use></svg>`;
}

export function barisPopup(label, nilai) {
  return `<tr><td>${esc(label)}</td><td><strong>${esc(nilai)}</strong></td></tr>`;
}

export function deskripsiTanpaCatatanPin(teks) {
  const kalimat = String(teks || '').match(/[^.!?]+[.!?]*/g) || [];
  return kalimat
    .filter((k) => !/(pin perkiraan|perkiraan kawasan|ringkasan area|bukan lokasi kejadian|bukan titik kejadian|bukan titik genangan|bukan koordinat kejadian|bukan titik pengukuran)/i.test(k))
    .join(' ')
    .trim();
}

export function bacaFilter() {
  return {
    jenis: document.getElementById('filterJenis').value,
    kecamatan: document.getElementById('filterKecamatan').value,
    kategori: [...document.querySelectorAll('.filter-kategori:checked')].map((c) => c.value),
    cari: document.getElementById('cariTitik').value.trim().toLowerCase(),
  };
}

export function filterTitik(rows, f) {
  return rows.filter((s) => {
    if (f.jenis && s.jenis !== f.jenis) return false;
    if (f.kecamatan && s.kecamatan !== f.kecamatan) return false;
    // Data tanpa klasifikasi tidak dipaksa masuk/masuk keluar oleh filter risiko.
    if (kategoriValid(s.kategori) && !f.kategori.includes(s.kategori)) return false;
    if (f.cari && ![s.nama, s.kecamatan, s.deskripsi].join(' ').toLowerCase().includes(f.cari)) return false;
    return true;
  });
}

export function perbaruiVisibilitasLayer(peta, lapisan) {
  const pasang = (grup, nyala) => {
    const ada = peta.hasLayer(grup);
    if (nyala && !ada) grup.addTo(peta);
    if (!nyala && ada) peta.removeLayer(grup);
  };
  pasang(lapisan.rob, document.getElementById('layerRob').checked);
  pasang(lapisan.abrasi, document.getElementById('layerAbrasi').checked);
  pasang(lapisan.laporan, document.getElementById('layerLaporan').checked);
}

/**
 * Helper yang terikat pada satu instance peta. Dibuat sebagai factory agar
 * semua pemanggilan lama tetap memakai nama fungsi yang sama.
 */
export function buatBantuanPeta(peta) {
  function ukuranPenanda(s, laporan = false) {
    const z = peta.getZoom();
    if (z <= 12) return laporan ? 9 : 8;
    if (laporan) {
      if (z === 13) return 14;
      if (z === 14) return 20;
      return 28;
    }
    if (z === 13) return 16;
    if (z === 14) return 22;
    return Math.round(Math.max(26, Math.min(40, radiusTitik(s.luasTerdampakHa) * 2)));
  }

  function htmlPenanda(s, laporan = false) {
    const jenis = normalJenis(s.jenis);
    const mini = peta.getZoom() <= 12;
    const risiko = !laporan && kategoriValid(s.kategori)
      ? ` risiko-${String(s.kategori).toLowerCase()}`
      : '';
    return `<span class="penanda penanda-${jenis}${laporan ? ' penanda-laporan' : ''}${risiko}${mini ? ' penanda-mini' : ''}">${
      mini ? '' : ikonJenis(jenis)
    }</span>`;
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

  function jagaPopupDalamPeta(e) {
    const elemen = e.popup && e.popup.getElement();
    if (!elemen) return;

    const batas = peta.getContainer().getBoundingClientRect();
    const kotak = elemen.getBoundingClientRect();
    let dx = 0;
    let dy = 0;

    if (kotak.left < batas.left + PADDING_POPUP) {
      dx = batas.left + PADDING_POPUP - kotak.left;
    } else if (kotak.right > batas.right - PADDING_POPUP) {
      dx = batas.right - PADDING_POPUP - kotak.right;
    }

    if (kotak.top < batas.top + PADDING_POPUP_ATAS) {
      dy = batas.top + PADDING_POPUP_ATAS - kotak.top;
    } else if (kotak.bottom > batas.bottom - PADDING_POPUP) {
      dy = batas.bottom - PADDING_POPUP - kotak.bottom;
    }

    if (dx || dy) peta.panBy([-dx, -dy], { animate: false });
  }

  function pastikanZoomPopup() {
    if (peta.getZoom() < ZOOM_MIN_POPUP) {
      peta.setZoom(ZOOM_MIN_POPUP, { animate: false });
    }
  }

  return { ukuranPenanda, buatIkon, jagaPopupDalamPeta, pastikanZoomPopup };
}

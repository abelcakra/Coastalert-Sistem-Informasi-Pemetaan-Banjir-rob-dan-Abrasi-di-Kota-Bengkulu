/**
 * layer-bnpb.js - Layer zona bahaya gelombang ekstrem & abrasi dari InaRISK BNPB.
 *
 * BNPB mempublikasikan layer ini sebagai ArcGIS ImageServer. Leaflet belum
 * membaca ImageServer secara langsung, jadi setiap kali peta berhenti bergerak
 * kita minta satu citra (exportImage) untuk kotak wilayah yang sedang tampil.
 * Pola ini sama dengan yang dipakai aplikasi InaRISK BNPB versi web.
 *
 * Sumber data:
 * https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_gelombang_ekstrim_dan_abrasi/ImageServer
 *
 * Catatan: layer ini adalah ZONA BAHAYA (raster), bukan titik kejadian.
 */
const URL_CITRA =
  'https://gis.bnpb.go.id/server/rest/services/inarisk/layer_bahaya_gelombang_ekstrim_dan_abrasi/ImageServer/exportImage';

const ATRIBUSI =
  'Zona bahaya: <a href="https://inarisk.bnpb.go.id/" target="_blank" rel="noopener">InaRISK BNPB</a>';

const OPASITAS = 0.55;
const UKURAN_MAKS = 2048;

/**
 * Buat pengelola layer BNPB untuk satu instance Leaflet.
 * @param {L.Map} peta
 * @param {{ onGagal?: () => void }} [opsi]
 */
export function buatLayerBnpb(peta, { onGagal } = {}) {
  let aktif = false;
  let overlay = null;
  let permintaan = 0;

  function urlCitra(bounds, ukuran) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let lebar = Math.max(1, Math.round(ukuran.x * dpr));
    let tinggi = Math.max(1, Math.round(ukuran.y * dpr));

    const skala = Math.min(1, UKURAN_MAKS / Math.max(lebar, tinggi));
    lebar = Math.max(1, Math.round(lebar * skala));
    tinggi = Math.max(1, Math.round(tinggi * skala));

    const bbox = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ]
      .map((n) => n.toFixed(6))
      .join(',');

    const params = new URLSearchParams({
      bbox,
      bboxSR: '4326',
      imageSR: '4326',
      size: `${lebar},${tinggi}`,
      format: 'png32',
      transparent: 'true',
      f: 'image',
      _ts: String(Date.now()),
    });

    return `${URL_CITRA}?${params.toString()}`;
  }

  let menunggu = null;
  let timerMuat = null;

  function batalkanTimer() {
    if (timerMuat) {
      clearTimeout(timerMuat);
      timerMuat = null;
    }
  }

  function bersihkan() {
    batalkanTimer();
    if (menunggu) {
      peta.removeLayer(menunggu);
      menunggu = null;
    }
    if (overlay) {
      peta.removeLayer(overlay);
      overlay = null;
    }
  }

  function muat() {
    if (!aktif) return;

    const id = ++permintaan;
    batalkanTimer();
    if (menunggu) {
      peta.removeLayer(menunggu);
      menunggu = null;
    }

    // Sedikit lebih besar dari layar agar tepi tetap tertutup saat peta digeser.
    const bounds = peta.getBounds().pad(0.02);
    const baru = L.imageOverlay(urlCitra(bounds, peta.getSize()), bounds, {
      opacity: OPASITAS,
      interactive: false,
      className: 'lapisan-bnpb',
      attribution: ATRIBUSI,
    });
    menunggu = baru;

    let selesai = false;
    const gagal = () => {
      if (selesai) return;
      selesai = true;
      batalkanTimer();
      peta.removeLayer(baru);
      if (menunggu === baru) menunggu = null;
      if (id !== permintaan) return;

      bersihkan();
      aktif = false;
      permintaan += 1;
      onGagal?.();
    };

    baru.on('load', () => {
      if (selesai) return;
      selesai = true;
      batalkanTimer();
      if (menunggu === baru) menunggu = null;
      if (id !== permintaan || !aktif) {
        peta.removeLayer(baru);
        return;
      }
      const lama = overlay;
      overlay = baru;
      if (lama && lama !== baru) peta.removeLayer(lama);
    });

    baru.on('error', gagal);
    // Server BNPB kadang tidak menjawab; jangan biarkan peta menunggu selamanya.
    timerMuat = setTimeout(gagal, 15000);

    baru.addTo(peta);
  }

  peta.on('moveend', () => {
    if (aktif) muat();
  });

  return {
    aktifkan() {
      if (aktif) return;
      aktif = true;
      muat();
    },
    nonaktifkan() {
      aktif = false;
      permintaan += 1;
      bersihkan();
    },
    sedangAktif: () => aktif,
  };
}

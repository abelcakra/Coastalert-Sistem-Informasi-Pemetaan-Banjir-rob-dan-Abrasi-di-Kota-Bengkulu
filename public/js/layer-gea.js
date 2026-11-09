/**
 * layer-gea.js - Overlay raster Zona Bahaya Kota Bengkulu.
 *
 * Berkas PNG dibuat oleh scripts/process_gea.py. Warna:
 * hijau = Rendah, kuning = Sedang, merah = Tinggi; piksel NoData transparan.
 * Raster GEA lokal ini adalah satu-satunya sumber layer Zona Bahaya.
 */
const GAMBAR = '/img/gea/gea-kota-bengkulu.png';

// Bounds WGS84 dari raster sumber (EPSG:32748 -> EPSG:4326).
const BOUNDS = [
  [-3.98242301, 102.17856274],
  [-3.73835786, 102.37178117],
];

const OPASITAS = 0.55;

/**
 * Buat pengelola layer GEA untuk satu instance Leaflet.
 * @param {L.Map} peta
 * @param {{ onGagal?: () => void }} [opsi]
 */
export function buatLayerGea(peta, { onGagal } = {}) {
  let aktif = false;
  let overlay = null;

  function pasang() {
    if (overlay) return;

    const baru = L.imageOverlay(GAMBAR, BOUNDS, {
      opacity: OPASITAS,
      interactive: false,
      className: 'lapisan-gea',
    });

    let selesai = false;
    const gagal = () => {
      if (selesai) return;
      selesai = true;
      if (overlay === baru) overlay = null;
      peta.removeLayer(baru);
      aktif = false;
      onGagal?.();
    };

    baru.on('load', () => {
      selesai = true;
    });
    baru.on('error', gagal);
    overlay = baru;
    baru.addTo(peta);
  }

  return {
    aktifkan() {
      if (aktif) return;
      aktif = true;
      pasang();
    },
    nonaktifkan() {
      aktif = false;
      if (!overlay) return;
      peta.removeLayer(overlay);
      overlay = null;
    },
    sedangAktif: () => aktif,
  };
}

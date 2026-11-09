/**
 * peta-pilih.js - Helper bersama pemilih lokasi Leaflet.
 *
 * Bagian yang sama antara form laporan publik dan form titik admin:
 * membuat peta OSM, penanda yang dapat digeser, klik peta, dan tombol
 * "lokasi saya". Penyimpanan koordinat tetap ditangani callback masing-masing
 * halaman karena publik memakai objek koordinat + info teks, sedangkan admin
 * memakai input tLat/tLng dan opsi geser peta.
 */
import { toast } from './common.js';
import { ATRIBUSI, URL_OSM } from './peta-common.js?v=1';

export const PUSAT_PILIH = [-3.785, 102.26];

/**
 * Pasang peta pemilih lokasi pada elemen dan tombol yang diberikan.
 *
 * @param {object} opsi
 * @param {string} opsi.idPeta ID elemen wadah peta.
 * @param {string} opsi.idTombolLokasi ID tombol geolokasi.
 * @param {(lat: number, lng: number) => void} opsi.onPilih Dipanggil setiap
 *   koordinat berubah dari klik peta, geser penanda, atau geolokasi.
 * @returns {{ peta: L.Map, pilih: Function, hapusPenanda: Function }}
 */
export function buatPemilihLokasi({ idPeta, idTombolLokasi, onPilih }) {
  const peta = L.map(idPeta).setView(PUSAT_PILIH, 12);
  L.tileLayer(URL_OSM, {
    maxZoom: 19,
    attribution: ATRIBUSI,
  }).addTo(peta);

  let penanda = null;

  function pilih(lat, lng, { geserPeta = true } = {}) {
    onPilih(lat, lng);

    if (penanda) {
      penanda.setLatLng([lat, lng]);
    } else {
      penanda = L.marker([lat, lng], { draggable: true }).addTo(peta);
      penanda.on('dragend', () => {
        const p = penanda.getLatLng();
        onPilih(p.lat, p.lng);
      });
    }

    if (geserPeta) peta.panTo([lat, lng]);
  }

  peta.on('click', (e) => pilih(e.latlng.lat, e.latlng.lng));

  document.getElementById(idTombolLokasi).addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Peramban tidak mendukung geolokasi.', 'gagal');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pilih(pos.coords.latitude, pos.coords.longitude);
        peta.setView([pos.coords.latitude, pos.coords.longitude], 16);
        toast('Lokasi Anda berhasil diambil.', 'sukses');
      },
      () => toast('Gagal mengambil lokasi. Izinkan akses lokasi pada peramban.', 'gagal')
    );
  });

  function hapusPenanda() {
    if (penanda) {
      peta.removeLayer(penanda);
      penanda = null;
    }
  }

  return { peta, pilih, hapusPenanda };
}

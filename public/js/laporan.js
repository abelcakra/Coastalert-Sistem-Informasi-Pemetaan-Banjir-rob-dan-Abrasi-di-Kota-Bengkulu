/**
 * laporan.js - Formulir laporan warga + peta pemilih lokasi.
 */
import { api, esc, isiSelect, toast } from './common.js';
import { simpanKode } from './kode-laporan.js';

const PUSAT = [-3.785, 102.26];
const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const peta = L.map('petaPilih').setView(PUSAT, 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: ATRIBUSI,
}).addTo(peta);

let penanda = null;
let koordinat = null;

function setLokasi(lat, lng) {
  koordinat = { lat, lng };
  if (penanda) {
    penanda.setLatLng([lat, lng]);
  } else {
    penanda = L.marker([lat, lng], { draggable: true }).addTo(peta);
    penanda.on('dragend', () => {
      const p = penanda.getLatLng();
      koordinat = { lat: p.lat, lng: p.lng };
      tampilkanKoordinat();
    });
  }
  peta.panTo([lat, lng]);
  tampilkanKoordinat();
}

function tampilkanKoordinat() {
  const el = document.getElementById('infoKoordinat');
  el.textContent = koordinat
    ? `Lokasi dipilih: ${koordinat.lat.toFixed(6)}, ${koordinat.lng.toFixed(6)} (geser penanda untuk menyesuaikan)`
    : 'Belum ada titik dipilih.';
}

peta.on('click', (e) => setLokasi(e.latlng.lat, e.latlng.lng));

document.getElementById('lokasiSaya').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Peramban tidak mendukung geolokasi.', 'gagal');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setLokasi(pos.coords.latitude, pos.coords.longitude);
      peta.setView([pos.coords.latitude, pos.coords.longitude], 16);
      toast('Lokasi Anda berhasil diambil.', 'sukses');
    },
    () => toast('Gagal mengambil lokasi. Izinkan akses lokasi pada peramban.', 'gagal')
  );
});

/* ---------------- Isi pilihan kecamatan ---------------- */
async function muatKecamatan() {
  try {
    const meta = await api('/api/stats/meta');
    isiSelect(document.getElementById('kecamatan'), meta.kecamatan || [], {
      kosong: 'Pilih kecamatan',
    });
  } catch {
    /* biarkan kosong bila gagal */
  }
}

/* ---------------- Kirim formulir ---------------- */
document.getElementById('formLaporan').addEventListener('submit', async (e) => {
  e.preventDefault();

  const namaPelapor = document.getElementById('namaPelapor').value.trim();
  const deskripsi = document.getElementById('deskripsi').value.trim();

  if (!namaPelapor) return toast('Nama pelapor wajib diisi.', 'gagal');
  if (!deskripsi) return toast('Deskripsi kejadian wajib diisi.', 'gagal');
  if (!koordinat) return toast('Silakan pilih titik lokasi pada peta.', 'gagal');

  const formData = new FormData();
  formData.append('namaPelapor', namaPelapor);
  formData.append('kontak', document.getElementById('kontak').value.trim());
  formData.append('jenis', document.getElementById('jenis').value);
  formData.append('kecamatan', document.getElementById('kecamatan').value);
  formData.append('tanggal', document.getElementById('tanggal').value);
  formData.append('alamat', document.getElementById('alamat').value.trim());
  formData.append('deskripsi', deskripsi);
  formData.append('lat', koordinat.lat);
  formData.append('lng', koordinat.lng);

  const foto = document.getElementById('foto').files[0];
  if (foto) formData.append('foto', foto);

  const tombol = document.getElementById('kirim');
  tombol.disabled = true;
  tombol.textContent = 'Mengirim...';

  try {
    const hasil = await api('/api/reports', { method: 'POST', formData });
    const kode = hasil?.data?.kode;

    if (kode) {
      simpanKode(kode);
      const info = document.getElementById('infoKode');
      info.hidden = false;
      info.innerHTML =
        `Laporan terkirim. Kode laporan Anda: <strong>${esc(kode)}</strong>. ` +
        `Simpan kode ini atau lihat perkembangannya di <a href="status.html">Status Laporan</a>.`;
      toast(`Laporan terkirim. Kode: ${kode}`, 'sukses');
    } else {
      toast(hasil.pesan || 'Laporan terkirim.', 'sukses');
    }

    e.target.reset();
    koordinat = null;
    if (penanda) {
      peta.removeLayer(penanda);
      penanda = null;
    }
    tampilkanKoordinat();
    document.getElementById('tanggal').value = new Date().toISOString().slice(0, 10);
  } catch (err) {
    toast(`Gagal mengirim: ${err.message}`, 'gagal');
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Kirim Laporan';
  }
});

document.getElementById('tanggal').value = new Date().toISOString().slice(0, 10);
muatKecamatan();

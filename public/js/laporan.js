/**
 * laporan.js - Formulir laporan warga + peta pemilih lokasi.
 */
import { api, esc, isiSelect, toast } from './common.js';
import { simpanKode } from './kode-laporan.js';
import { buatPemilihLokasi } from './peta-pilih.js?v=1';

let koordinat = null;

const pemilih = buatPemilihLokasi({
  idPeta: 'petaPilih',
  idTombolLokasi: 'lokasiSaya',
  onPilih: (lat, lng) => {
    koordinat = { lat, lng };
    tampilkanKoordinat();
  },
});

function tampilkanKoordinat() {
  const el = document.getElementById('infoKoordinat');
  el.textContent = koordinat
    ? `Lokasi dipilih: ${koordinat.lat.toFixed(6)}, ${koordinat.lng.toFixed(6)} (geser penanda untuk menyesuaikan)`
    : 'Belum ada titik dipilih.';
}

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
        `Simpan kode ini atau lihat perkembangannya di <a href="/status">Status Laporan</a>.`;
      toast(`Laporan terkirim. Kode: ${kode}`, 'sukses');
    } else {
      toast(hasil.pesan || 'Laporan terkirim.', 'sukses');
    }

    e.target.reset();
    koordinat = null;
    pemilih.hapusPenanda();
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

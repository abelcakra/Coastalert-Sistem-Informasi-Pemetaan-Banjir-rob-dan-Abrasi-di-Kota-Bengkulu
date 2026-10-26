/**
 * status.js - Halaman Status Laporan.
 * Menampilkan laporan yang pernah dikirim melalui browser ini (localStorage)
 * dan memungkinkan pencarian berdasarkan kode laporan.
 */
import { api, esc, format, toast } from './common.js';
import { ambilKode, hapusKode, normalisasiKode, simpanKode } from './kode-laporan.js';

const LABEL_JENIS = { rob: 'Banjir Rob', abrasi: 'Abrasi Pantai' };
const LABEL_STATUS = {
  pending: 'Menunggu Verifikasi',
  diverifikasi: 'Terverifikasi',
  ditolak: 'Ditolak',
};

const tbody = document.getElementById('tabelStatus');
const form = document.getElementById('formCari');
const input = document.getElementById('kodeLaporan');
const tombol = document.getElementById('tombolCari');

/** @type {Array<object>} laporan yang sudah dimuat */
let daftar = [];

/* ---------------- Tampilan ---------------- */
function barisLaporan(r, sorot = false) {
  const jenis = r.jenis === 'abrasi' ? 'abrasi' : 'rob';
  const status = LABEL_STATUS[r.status] ? r.status : 'pending';
  const lokasi = r.lokasi && r.lokasi !== '-' ? r.lokasi : r.kecamatan || '—';
  return `
    <tr data-kode="${esc(r.kode)}"${sorot ? ' class="baru"' : ''}>
      <td><span class="status-kode">${esc(r.kode)}</span></td>
      <td>${esc(format.tanggal(r.tanggal || r.createdAt))}</td>
      <td><span class="badge ${jenis}">${esc(LABEL_JENIS[jenis])}</span></td>
      <td>${esc(lokasi)}</td>
      <td><span class="badge ${status}">${esc(LABEL_STATUS[status])}</span></td>
    </tr>`;
}

function gambar(sorot = '') {
  if (!daftar.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="kosong">
          Belum ada laporan dari browser ini.
          <a href="laporan.html">Kirim laporan pertama Anda</a>.
        </td>
      </tr>`;
    return;
  }
  tbody.innerHTML = daftar.map((r) => barisLaporan(r, r.kode === sorot)).join('');
}

function urutkan() {
  daftar.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

/* ---------------- Muat riwayat ---------------- */
async function muat() {
  const kodeTersimpan = ambilKode();
  if (!kodeTersimpan.length) {
    gambar();
    return;
  }

  const hasil = await Promise.allSettled(
    kodeTersimpan.map((kode) => api(`/api/reports/lacak/${encodeURIComponent(kode)}`))
  );

  const data = [];
  let gagal = 0;
  hasil.forEach((hasilSatu, i) => {
    if (hasilSatu.status === 'fulfilled' && hasilSatu.value?.data) {
      data.push(hasilSatu.value.data);
    } else if (/tidak ditemukan/i.test(hasilSatu.reason?.message || '')) {
      // Laporan sudah dihapus admin: bersihkan dari riwayat browser.
      hapusKode(kodeTersimpan[i]);
    } else {
      gagal += 1;
    }
  });

  daftar = data;
  urutkan();
  gambar();
  if (gagal) toast('Sebagian data laporan gagal dimuat. Muat ulang halaman bila perlu.', 'gagal');
}

/* ---------------- Cari kode ---------------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const kode = normalisasiKode(input.value);
  if (!kode) {
    toast('Masukkan kode laporan terlebih dahulu.', 'gagal');
    input.focus();
    return;
  }

  tombol.disabled = true;
  tombol.textContent = 'Mencari...';
  try {
    const { data } = await api(`/api/reports/lacak/${encodeURIComponent(kode)}`);
    simpanKode(data.kode);

    const ada = daftar.find((r) => r.kode === data.kode);
    if (ada) Object.assign(ada, data);
    else daftar.push(data);
    urutkan();
    gambar(data.kode);

    input.value = '';
    toast(`Laporan ${data.kode} ditemukan.`, 'sukses');
  } catch (err) {
    toast(err.message || 'Kode laporan tidak ditemukan.', 'gagal');
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Cari';
  }
});

muat();

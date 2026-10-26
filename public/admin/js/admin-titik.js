/**
 * admin-titik.js - Halaman kelola titik lokasi (titik rawan rob & abrasi).
 * Menampilkan daftar titik (ID, kategori, nama lokasi, kerawanan, koordinat, aksi),
 * menyediakan tambah/edit/hapus titik, serta import data GIS.
 */
import {
  api,
  badgeJenis,
  badgeKategori,
  esc,
  format,
  isiSelect,
  pasangLayout,
  toast,
  wajibLogin,
} from './admin-common.js';

const PUSAT = [-3.785, 102.26];
const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const KECAMATAN_BENGKULU = [
  'Teluk Segara',
  'Ratu Samban',
  'Gading Cempaka',
  'Ratu Agung',
  'Singaran Pati',
  'Selebar',
  'Kampung Melayu',
  'Sungai Serut',
  'Muara Bangkahulu',
];

let semuaTitik = [];
let peta = null;
let penanda = null;
let idFokus = new URLSearchParams(location.search).get('fokus');

/* =====================================================
   Peta pemilih lokasi
   ===================================================== */
function siapkanPeta() {
  peta = L.map('petaAdmin').setView(PUSAT, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ATRIBUSI,
  }).addTo(peta);
  peta.on('click', (e) => setKoordinat(e.latlng.lat, e.latlng.lng));
  setTimeout(() => peta.invalidateSize(), 200);
}

function setKoordinat(lat, lng, { geserPeta = true } = {}) {
  document.getElementById('tLat').value = Number(lat).toFixed(6);
  document.getElementById('tLng').value = Number(lng).toFixed(6);

  if (penanda) {
    penanda.setLatLng([lat, lng]);
  } else {
    penanda = L.marker([lat, lng], { draggable: true }).addTo(peta);
    penanda.on('dragend', () => {
      const p = penanda.getLatLng();
      document.getElementById('tLat').value = p.lat.toFixed(6);
      document.getElementById('tLng').value = p.lng.toFixed(6);
    });
  }
  if (geserPeta) peta.panTo([lat, lng]);
}

document.getElementById('tLat').addEventListener('change', sinkronDariInput);
document.getElementById('tLng').addEventListener('change', sinkronDariInput);

function sinkronDariInput() {
  const lat = Number(document.getElementById('tLat').value);
  const lng = Number(document.getElementById('tLng').value);
  if (Number.isFinite(lat) && Number.isFinite(lng)) setKoordinat(lat, lng);
}

document.getElementById('lokasiSaya').addEventListener('click', () => {
  if (!navigator.geolocation) return toast('Peramban tidak mendukung geolokasi.', 'gagal');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setKoordinat(pos.coords.latitude, pos.coords.longitude);
      peta.setView([pos.coords.latitude, pos.coords.longitude], 16);
      toast('Lokasi Anda berhasil diambil.', 'sukses');
    },
    () => toast('Gagal mengambil lokasi. Izinkan akses lokasi pada peramban.', 'gagal')
  );
});

/* =====================================================
   Form
   ===================================================== */
function isiPilihanKecamatan() {
  const daftar = [...new Set([...semuaTitik.map((s) => s.kecamatan), ...KECAMATAN_BENGKULU])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  isiSelect(document.getElementById('tKecamatan'), daftar, { kosong: 'Pilih kecamatan' });
}

function resetForm() {
  document.getElementById('formTitik').reset();
  document.getElementById('titikId').value = '';
  document.getElementById('judulForm').textContent = 'Tambah titik lokasi';
  document.getElementById('batalEdit').style.display = 'none';
  if (penanda) {
    peta.removeLayer(penanda);
    penanda = null;
  }
}

function isiFormDariTitik(s) {
  document.getElementById('titikId').value = s.id;
  document.getElementById('tNama').value = s.nama || '';
  document.getElementById('tKecamatan').value = s.kecamatan || '';
  document.getElementById('tJenis').value = s.jenis || 'rob';
  document.getElementById('tKategori').value = s.kategori || 'Sedang';
  document.getElementById('tTinggiRob').value = s.tinggiRob ?? '';
  document.getElementById('tLajuAbrasi').value = s.lajuAbrasi ?? '';
  document.getElementById('tLuas').value = s.luasTerdampakHa ?? '';
  document.getElementById('tKK').value = s.kkTerdampak ?? '';
  document.getElementById('tTahun').value = s.tahun ?? '';
  document.getElementById('tDeskripsi').value = s.deskripsi || '';
  document.getElementById('judulForm').textContent = 'Edit titik lokasi';
  document.getElementById('batalEdit').style.display = 'inline-flex';

  peta.setView([s.lat, s.lng], 15);
  setKoordinat(s.lat, s.lng, { geserPeta: false });
  document.getElementById('badanForm').style.display = 'block';
  document.getElementById('tombolForm').textContent = 'Sembunyikan form';
  document.getElementById('kartuForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => peta.invalidateSize(), 250);
}

document.getElementById('batalEdit').addEventListener('click', resetForm);

document.getElementById('tombolForm').addEventListener('click', () => {
  const badan = document.getElementById('badanForm');
  const tampil = badan.style.display !== 'none';
  badan.style.display = tampil ? 'none' : 'block';
  document.getElementById('tombolForm').textContent = tampil ? 'Tampilkan form' : 'Sembunyikan form';
  if (!tampil) setTimeout(() => peta.invalidateSize(), 150);
});

document.getElementById('formTitik').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('titikId').value;

  const payload = {
    nama: document.getElementById('tNama').value.trim(),
    kecamatan: document.getElementById('tKecamatan').value,
    jenis: document.getElementById('tJenis').value,
    kategori: document.getElementById('tKategori').value,
    lat: Number(document.getElementById('tLat').value),
    lng: Number(document.getElementById('tLng').value),
    tinggiRob: document.getElementById('tTinggiRob').value,
    lajuAbrasi: document.getElementById('tLajuAbrasi').value,
    luasTerdampakHa: document.getElementById('tLuas').value,
    kkTerdampak: document.getElementById('tKK').value,
    tahun: document.getElementById('tTahun').value,
    deskripsi: document.getElementById('tDeskripsi').value.trim(),
    sumber: 'Input admin',
  };

  if (!payload.nama) return toast('Nama lokasi wajib diisi.', 'gagal');
  if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lng)) {
    return toast('Tentukan koordinat titik pada peta terlebih dahulu.', 'gagal');
  }

  const tombol = document.getElementById('simpanTitik');
  tombol.disabled = true;
  tombol.textContent = 'Menyimpan...';

  try {
    if (id) {
      await api(`/api/spots/${id}`, { method: 'PUT', auth: true, body: payload });
      toast('Titik lokasi berhasil diperbarui.', 'sukses');
    } else {
      await api('/api/spots', { method: 'POST', auth: true, body: payload });
      toast('Titik lokasi baru berhasil ditambahkan.', 'sukses');
    }
    resetForm();
    await muatTitik();
  } catch (err) {
    toast(err.message, 'gagal');
  } finally {
    tombol.disabled = false;
    tombol.textContent = 'Simpan titik';
  }
});

/* =====================================================
   Tabel titik
   ===================================================== */
function terapkanFilter() {
  const kategori = document.getElementById('filterKategori').value;
  const kerawanan = document.getElementById('filterKerawanan').value;
  const cari = document.getElementById('cariTitik').value.trim().toLowerCase();

  const rows = semuaTitik.filter((s) => {
    if (kategori && s.jenis !== kategori) return false;
    if (kerawanan && s.kategori !== kerawanan) return false;
    if (cari && ![s.nama, s.kecamatan, s.deskripsi].join(' ').toLowerCase().includes(cari)) return false;
    return true;
  });

  document.getElementById('jumlahTitik').textContent = `(${rows.length} dari ${semuaTitik.length})`;

  const tbody = document.getElementById('tabelTitik');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="kosong">Tidak ada titik sesuai filter.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (s) => `
      <tr id="baris-${esc(s.id)}">
        <td><code class="tag-kecil" title="${esc(s.id)}">${esc(s.id)}</code></td>
        <td>${badgeJenis(s.jenis)}</td>
        <td>${esc(s.nama)}<br><span class="tag-kecil">${esc(s.kecamatan || '—')}</span></td>
        <td>${badgeKategori(s.kategori)}</td>
        <td class="tag-kecil">${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}</td>
        <td>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap">
            <button class="tombol sekunder kecil" data-edit="${esc(s.id)}">Edit</button>
            <button class="tombol sekunder kecil" data-peta="${esc(s.id)}">Peta</button>
            <button class="tombol bahaya kecil" data-hapus="${esc(s.id)}">Hapus</button>
          </div>
        </td>
      </tr>`
    )
    .join('');

  if (idFokus) {
    const baris = document.getElementById(`baris-${idFokus}`);
    if (baris) {
      baris.style.outline = '3px solid var(--biru-500)';
      baris.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    idFokus = null;
  }
}

document.getElementById('filterKategori').addEventListener('change', terapkanFilter);
document.getElementById('filterKerawanan').addEventListener('change', terapkanFilter);
let timerCari = null;
document.getElementById('cariTitik').addEventListener('input', () => {
  clearTimeout(timerCari);
  timerCari = setTimeout(terapkanFilter, 220);
});

document.getElementById('tabelTitik').addEventListener('click', async (e) => {
  const editId = e.target.closest('[data-edit]')?.dataset.edit;
  const hapusId = e.target.closest('[data-hapus]')?.dataset.hapus;
  const petaId = e.target.closest('[data-peta]')?.dataset.peta;

  if (editId) {
    const s = semuaTitik.find((x) => x.id === editId);
    if (s) isiFormDariTitik(s);
  }

  if (petaId) {
    const s = semuaTitik.find((x) => x.id === petaId);
    if (s) {
      document.getElementById('badanForm').style.display = 'block';
      document.getElementById('tombolForm').textContent = 'Sembunyikan form';
      peta.setView([s.lat, s.lng], 16);
      setKoordinat(s.lat, s.lng, { geserPeta: false });
      document.getElementById('kartuForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => peta.invalidateSize(), 250);
    }
  }

  if (hapusId) {
    const s = semuaTitik.find((x) => x.id === hapusId);
    if (!confirm(`Hapus titik "${s?.nama || hapusId}" dari peta?`)) return;
    try {
      await api(`/api/spots/${hapusId}`, { method: 'DELETE', auth: true });
      toast('Titik lokasi dihapus.', 'sukses');
      await muatTitik();
    } catch (err) {
      toast(err.message, 'gagal');
    }
  }
});

/* =====================================================
   Import GIS
   ===================================================== */
function tampilkanHasil(hasil) {
  document.getElementById('hasilImport').style.display = 'block';
  document.getElementById('isiHasilImport').innerHTML = `
    <p>${esc(hasil.pesan || '')}</p>
    <p class="tag-kecil">Berhasil: ${format.angka(hasil.berhasil)} · Gagal: ${format.angka(hasil.gagal)}</p>
    ${
      hasil.errors && hasil.errors.length
        ? `<ul style="margin:.5rem 0 0 1.2rem;font-size:.85rem">${hasil.errors
            .map((er) => `<li>${esc(er)}</li>`)
            .join('')}</ul>`
        : ''
    }`;
}

async function unggah(ev, endpoint, inputId) {
  ev.preventDefault();
  const input = document.getElementById(inputId);
  if (!input.files.length) return toast('Pilih berkas terlebih dahulu.', 'gagal');

  const formData = new FormData();
  formData.append('file', input.files[0]);

  try {
    const hasil = await api(endpoint, { method: 'POST', formData, auth: true });
    tampilkanHasil(hasil);
    toast(hasil.pesan || 'Impor selesai.', 'sukses');
    input.value = '';
    await muatTitik();
  } catch (err) {
    toast(err.message, 'gagal');
  }
}

document.getElementById('formGeojson').addEventListener('submit', (e) =>
  unggah(e, '/api/import/geojson', 'fileGeojson')
);
document.getElementById('formCsv').addEventListener('submit', (e) => unggah(e, '/api/import/csv', 'fileCsv'));

/* =====================================================
   Muat data
   ===================================================== */
async function muatTitik() {
  try {
    const { data } = await api('/api/spots');
    semuaTitik = data;
    isiPilihanKecamatan();
    terapkanFilter();
  } catch (err) {
    toast(`Gagal memuat titik lokasi: ${err.message}`, 'gagal');
  }
}

(async () => {
  if (!(await wajibLogin())) return;
  pasangLayout({
    aktif: 'titik.html',
    judul: 'Kelola Titik Lokasi',
    subjudul: 'Tambah, ubah, dan hapus titik rawan rob & abrasi',
  });
  siapkanPeta();
  await muatTitik();
})();

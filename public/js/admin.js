/**
 * admin.js - Panel admin: verifikasi laporan, kelola titik, import GIS.
 */
import { api, auth, esc, format, isiSelect, toast } from './common.js';

const ATRIBUSI = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const PUSAT = [-3.785, 102.26];

let daftarTitik = [];
let petaAdmin = null;
let penandaAdmin = null;

/* =====================================================
   Login / logout
   ===================================================== */
const panelLogin = document.getElementById('panelLogin');
const panelAdmin = document.getElementById('panelAdmin');

function tampilkanPanel(masuk) {
  panelLogin.style.display = masuk ? 'none' : 'block';
  panelAdmin.style.display = masuk ? 'block' : 'none';
  if (masuk) {
    muatLaporan();
    muatTitik();
    muatKecamatanAdmin();
  }
}

document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  try {
    const { token } = await api('/api/admin/login', { method: 'POST', body: { password } });
    auth.set(token);
    toast('Berhasil masuk sebagai admin.', 'sukses');
    e.target.reset();
    tampilkanPanel(true);
  } catch (err) {
    toast(err.message, 'gagal');
  }
});

document.getElementById('keluar').addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST', auth: true });
  } catch {
    /* abaikan */
  }
  auth.hapus();
  tampilkanPanel(false);
  toast('Anda telah keluar.');
});

/* =====================================================
   Pindah tab
   ===================================================== */
document.querySelectorAll('[data-tab]').forEach((tombol) => {
  tombol.addEventListener('click', () => {
    const target = tombol.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach((t) => {
      const aktif = t === tombol;
      t.classList.toggle('tombol', aktif);
      t.classList.toggle('sekunder', !aktif);
    });
    document.querySelectorAll('.tab').forEach((sec) => {
      sec.style.display = sec.id === `tab-${target}` ? 'block' : 'none';
    });
    if (target === 'titik' && petaAdmin) setTimeout(() => petaAdmin.invalidateSize(), 50);
  });
});

/* =====================================================
   Peta pemilih lokasi (tab titik)
   ===================================================== */
function siapkanPetaAdmin() {
  petaAdmin = L.map('petaAdmin').setView(PUSAT, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ATRIBUSI,
  }).addTo(petaAdmin);

  petaAdmin.on('click', (e) => isiKoordinat(e.latlng.lat, e.latlng.lng));
  setTimeout(() => petaAdmin.invalidateSize(), 200);
}

function isiKoordinat(lat, lng) {
  document.getElementById('tLat').value = Number(lat).toFixed(6);
  document.getElementById('tLng').value = Number(lng).toFixed(6);
  if (penandaAdmin) penandaAdmin.setLatLng([lat, lng]);
  else penandaAdmin = L.marker([lat, lng], { draggable: true }).addTo(petaAdmin);
  petaAdmin.panTo([lat, lng]);
}

/* =====================================================
   Tab: Laporan warga
   ===================================================== */
const badgeJenis = (j) =>
  `<span class="badge ${esc(j)}">${j === 'abrasi' ? 'Abrasi' : 'Rob'}</span>`;

async function muatLaporan() {
  const status = document.getElementById('filterStatus').value;
  const tbody = document.getElementById('tabelLaporan');
  try {
    const { data } = await api(`/api/reports${status ? `?status=${status}` : ''}`, { auth: true });
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="kosong">Belum ada laporan.</td></tr>';
      return;
    }

    tbody.innerHTML = data
      .map((r) => {
        const foto = r.foto
          ? `<a href="${esc(r.foto)}" target="_blank" rel="noopener">Lihat foto</a>`
          : '<span class="tag-kecil">—</span>';

        const aksi = [];
        if (r.status !== 'diverifikasi') {
          aksi.push(`<button class="tombol sukses kecil" data-aksi="verifikasi" data-id="${r.id}">Verifikasi</button>`);
          aksi.push(`<button class="tombol kecil" data-aksi="verifikasi-titik" data-id="${r.id}">Verifikasi + jadikan titik</button>`);
        }
        if (r.status !== 'ditolak') {
          aksi.push(`<button class="tombol sekunder kecil" data-aksi="tolak" data-id="${r.id}">Tolak</button>`);
        }
        aksi.push(`<button class="tombol bahaya kecil" data-aksi="hapus" data-id="${r.id}">Hapus</button>`);

        return `
          <tr>
            <td class="tag-kecil">${format.tanggal(r.tanggal)}<br>${format.tanggal(r.createdAt)}</td>
            <td>${esc(r.namaPelapor)}<br><span class="tag-kecil">${esc(r.kontak || '—')}</span></td>
            <td>${badgeJenis(r.jenis)}</td>
            <td>${esc(r.alamat || '—')}<br><span class="tag-kecil">${esc(r.kecamatan || '—')} · ${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}</span></td>
            <td style="max-width:260px">${esc(r.deskripsi)}</td>
            <td>${foto}</td>
            <td><span class="badge ${esc(r.status)}">${esc(r.status)}</span></td>
            <td><div style="display:flex;flex-direction:column;gap:.3rem">${aksi.join('')}</div></td>
          </tr>`;
      })
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="kosong">${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('filterStatus').addEventListener('change', muatLaporan);

document.getElementById('tabelLaporan').addEventListener('click', async (e) => {
  const tombol = e.target.closest('button[data-aksi]');
  if (!tombol) return;
  const { aksi, id } = tombol.dataset;

  try {
    if (aksi === 'hapus') {
      if (!confirm('Hapus laporan ini?')) return;
      await api(`/api/reports/${id}`, { method: 'DELETE', auth: true });
      toast('Laporan dihapus.', 'sukses');
    } else if (aksi === 'verifikasi' || aksi === 'verifikasi-titik') {
      await api(`/api/reports/${id}`, {
        method: 'PATCH',
        auth: true,
        body: { status: 'diverifikasi', jadikanTitik: aksi === 'verifikasi-titik' },
      });
      toast(
        aksi === 'verifikasi-titik'
          ? 'Laporan diverifikasi dan ditambahkan ke peta.'
          : 'Laporan diverifikasi.',
        'sukses'
      );
      muatTitik();
    } else if (aksi === 'tolak') {
      const catatan = prompt('Alasan penolakan (opsional):') ?? '';
      await api(`/api/reports/${id}`, {
        method: 'PATCH',
        auth: true,
        body: { status: 'ditolak', catatanAdmin: catatan },
      });
      toast('Laporan ditolak.');
    }
    muatLaporan();
  } catch (err) {
    toast(err.message, 'gagal');
  }
});

/* =====================================================
   Tab: Data titik
   ===================================================== */
async function muatKecamatanAdmin() {
  try {
    const meta = await api('/api/stats/meta');
    const select = document.getElementById('tKecamatan');
    isiSelect(select, meta.kecamatan || [], { kosong: 'Pilih kecamatan' });
    // tambahkan kecamatan yang belum ada di data sebagai pilihan baru
    select.insertAdjacentHTML(
      'beforeend',
      ['Teluk Segara', 'Ratu Samban', 'Gading Cempaka', 'Sungai Serut', 'Kampung Melayu', 'Selebar', 'Muara Bangkahulu', 'Ratu Agung', 'Singaran Pati']
        .filter((k) => !(meta.kecamatan || []).includes(k))
        .map((k) => `<option value="${esc(k)}">${esc(k)}</option>`)
        .join('')
    );
  } catch {
    /* abaikan */
  }
}

async function muatTitik() {
  const tbody = document.getElementById('tabelTitik');
  try {
    const { data } = await api('/api/spots');
    daftarTitik = data;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="kosong">Belum ada titik.</td></tr>';
      return;
    }

    tbody.innerHTML = data
      .map(
        (s) => `
        <tr>
          <td>${esc(s.nama)}</td>
          <td>${esc(s.kecamatan || '—')}</td>
          <td>${badgeJenis(s.jenis)}</td>
          <td><span class="badge ${esc(String(s.kategori).toLowerCase())}">${esc(s.kategori)}</span></td>
          <td>${
            s.jenis === 'rob'
              ? s.tinggiRob != null
                ? `${format.angka(s.tinggiRob)} cm`
                : '—'
              : s.lajuAbrasi != null
                ? `${format.angka(s.lajuAbrasi, 1)} m/th`
                : '—'
          }</td>
          <td>${format.angka(s.luasTerdampakHa, 1)}</td>
          <td>${format.angka(s.kkTerdampak)}</td>
          <td>${format.angka(s.tahun)}</td>
          <td><div style="display:flex;gap:.3rem">
            <button class="tombol sekunder kecil" data-edit="${s.id}">Edit</button>
            <button class="tombol bahaya kecil" data-hapus="${s.id}">Hapus</button>
          </div></td>
        </tr>`
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="kosong">${esc(err.message)}</td></tr>`;
  }
}

function resetFormTitik() {
  document.getElementById('formTitik').reset();
  document.getElementById('titikId').value = '';
  document.getElementById('judulFormTitik').textContent = 'Tambah titik rawan';
  document.getElementById('batalTitik').style.display = 'none';
  if (penandaAdmin) {
    petaAdmin.removeLayer(penandaAdmin);
    penandaAdmin = null;
  }
}

document.getElementById('batalTitik').addEventListener('click', resetFormTitik);

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

  try {
    if (id) {
      await api(`/api/spots/${id}`, { method: 'PUT', auth: true, body: payload });
      toast('Titik diperbarui.', 'sukses');
    } else {
      await api('/api/spots', { method: 'POST', auth: true, body: payload });
      toast('Titik baru ditambahkan.', 'sukses');
    }
    resetFormTitik();
    muatTitik();
  } catch (err) {
    toast(err.message, 'gagal');
  }
});

document.getElementById('tabelTitik').addEventListener('click', async (e) => {
  const editId = e.target.closest('[data-edit]')?.dataset.edit;
  const hapusId = e.target.closest('[data-hapus]')?.dataset.hapus;

  if (editId) {
    const s = daftarTitik.find((row) => row.id === editId);
    if (!s) return;
    document.getElementById('titikId').value = s.id;
    document.getElementById('tNama').value = s.nama || '';
    document.getElementById('tKecamatan').value = s.kecamatan || '';
    document.getElementById('tJenis').value = s.jenis || 'rob';
    document.getElementById('tKategori').value = s.kategori || 'Sedang';
    document.getElementById('tLat').value = s.lat;
    document.getElementById('tLng').value = s.lng;
    document.getElementById('tTinggiRob').value = s.tinggiRob ?? '';
    document.getElementById('tLajuAbrasi').value = s.lajuAbrasi ?? '';
    document.getElementById('tLuas').value = s.luasTerdampakHa ?? '';
    document.getElementById('tKK').value = s.kkTerdampak ?? '';
    document.getElementById('tTahun').value = s.tahun ?? '';
    document.getElementById('tDeskripsi').value = s.deskripsi || '';
    document.getElementById('judulFormTitik').textContent = 'Edit titik rawan';
    document.getElementById('batalTitik').style.display = 'inline-flex';

    if (petaAdmin) {
      petaAdmin.setView([s.lat, s.lng], 15);
      isiKoordinat(s.lat, s.lng);
      setTimeout(() => petaAdmin.invalidateSize(), 100);
    }
    document.getElementById('tab-titik').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (hapusId) {
    if (!confirm('Hapus titik ini dari peta?')) return;
    try {
      await api(`/api/spots/${hapusId}`, { method: 'DELETE', auth: true });
      toast('Titik dihapus.', 'sukses');
      muatTitik();
    } catch (err) {
      toast(err.message, 'gagal');
    }
  }
});

/* =====================================================
   Tab: Import GIS
   ===================================================== */
function tampilkanHasil(hasil) {
  const kotak = document.getElementById('hasilImport');
  const isi = document.getElementById('isiHasilImport');
  kotak.style.display = 'block';
  isi.innerHTML = `
    <p>${esc(hasil.pesan || '')}</p>
    <p class="tag-kecil">Berhasil: ${format.angka(hasil.berhasil)} · Gagal: ${format.angka(hasil.gagal)}</p>
    ${
      hasil.errors && hasil.errors.length
        ? `<ul style="margin:.5rem 0 0 1.2rem;font-size:.85rem">${hasil.errors
            .map((e) => `<li>${esc(e)}</li>`)
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
    muatTitik();
  } catch (err) {
    toast(err.message, 'gagal');
  }
}

document.getElementById('formGeojson').addEventListener('submit', (e) =>
  unggah(e, '/api/import/geojson', 'fileGeojson')
);
document.getElementById('formCsv').addEventListener('submit', (e) => unggah(e, '/api/import/csv', 'fileCsv'));

/* =====================================================
   Mulai
   ===================================================== */
function mulai() {
  siapkanPetaAdmin();

  // Cek apakah token yang tersimpan masih berlaku
  if (auth.ada()) {
    api('/api/admin/cek', { auth: true })
      .then(() => tampilkanPanel(true))
      .catch(() => {
        auth.hapus();
        tampilkanPanel(false);
      });
  } else {
    tampilkanPanel(false);
  }
}

mulai();

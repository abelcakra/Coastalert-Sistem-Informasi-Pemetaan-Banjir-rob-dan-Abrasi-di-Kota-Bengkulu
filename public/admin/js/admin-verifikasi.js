/**
 * admin-verifikasi.js - Halaman verifikasi laporan warga.
 * Menampilkan laporan menunggu verifikasi dalam bentuk kartu lengkap dengan
 * foto kejadian, lokasi, tanggal, pelapor, dan deskripsi.
 */
import {
  api,
  badgeJenis,
  badgeStatus,
  esc,
  labelTanggal,
  pasangLayout,
  perbaruiBadgePending,
  toast,
  wajibLogin,
  warnaKategori,
} from './admin-common.js?v=2';

let semuaLaporan = [];
let tabAktif = 'pending'; // 'pending' | 'riwayat'
let idFokus = new URLSearchParams(location.search).get('fokus');

/* ---------------- Kartu laporan ---------------- */
function kartuLaporan(r) {
  const foto = r.foto
    ? `<img src="${esc(r.foto)}" alt="Foto kejadian laporan ${esc(r.namaPelapor)}" />`
    : `<div class="tanpa-foto">Tidak ada foto kejadian</div>`;

  const tombolAksi =
    r.status === 'pending'
      ? `
        <div class="aksi-kartu">
          <button class="tombol sukses kecil" data-aksi="verifikasi" data-id="${r.id}">Verifikasi</button>
          <button class="tombol kecil" data-aksi="verifikasi-titik" data-id="${r.id}">Verifikasi &amp; jadikan titik</button>
          <button class="tombol sekunder kecil" data-aksi="tolak" data-id="${r.id}">Tolak</button>
        </div>`
      : `
        <div class="aksi-kartu">
          ${badgeStatus(r.status)}
          ${r.catatanAdmin ? `<span class="tag-kecil">Catatan: ${esc(r.catatanAdmin)}</span>` : ''}
          <button class="tombol bahaya kecil" data-aksi="hapus" data-id="${r.id}">Hapus</button>
        </div>`;

  return `
    <article class="kartu-laporan" id="kartu-${esc(r.id)}">
      <div class="foto-bungkus">${foto}</div>
      <div class="isi">
        <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
          ${badgeJenis(r.jenis)}
          <span class="tag-kecil">${labelTanggal(r.tanggal)}</span>
          ${r.kode ? `<span class="tag-kecil">Kode: <strong>${esc(r.kode)}</strong></span>` : ''}
        </div>
        <h3>${esc(r.alamat || 'Lokasi tanpa alamat')}</h3>
        <div class="meta">
          <span>Pelapor: <strong>${esc(r.namaPelapor)}</strong>${r.kontak && r.kontak !== '-' ? ` · ${esc(r.kontak)}` : ''}</span>
          <span>${esc(r.kecamatan || 'Kecamatan belum diisi')}</span>
          <span>${Number(r.lat).toFixed(5)}, ${Number(r.lng).toFixed(5)}</span>
        </div>
        <p class="deskripsi">${esc(r.deskripsi || '—')}</p>
        <button class="tombol sekunder kecil" data-peta="${r.id}">Tampilkan peta lokasi</button>
        <div class="peta-mini" id="peta-${esc(r.id)}" style="display:none"></div>
        ${tombolAksi}
      </div>
    </article>`;
}

function gambar() {
  const wadah = document.getElementById('wadahLaporan');
  const rows =
    tabAktif === 'pending'
      ? semuaLaporan.filter((r) => r.status === 'pending')
      : semuaLaporan.filter((r) => r.status !== 'pending');

  document.getElementById('jumlahMenunggu').textContent =
    `(${semuaLaporan.filter((r) => r.status === 'pending').length})`;

  if (!rows.length) {
    wadah.innerHTML = `<p class="kosong">${
      tabAktif === 'pending'
        ? 'Tidak ada laporan yang menunggu verifikasi.'
        : 'Belum ada laporan yang diproses.'
    }</p>`;
    return;
  }

  const urut = [...rows].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  wadah.innerHTML = urut.map(kartuLaporan).join('');

  if (idFokus) {
    const el = document.getElementById(`kartu-${idFokus}`);
    if (el) {
      el.style.outline = '3px solid var(--biru-500)';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    idFokus = null;
  }
}

/* ---------------- Aksi verifikasi ---------------- */
async function proses(id, aksi) {
  const r = semuaLaporan.find((x) => x.id === id);
  if (!r) return;

  try {
    if (aksi === 'hapus') {
      if (!confirm('Hapus laporan ini secara permanen?')) return;
      await api(`/api/reports/${id}`, { method: 'DELETE', auth: true });
      toast('Laporan dihapus.', 'sukses');
    } else if (aksi === 'tolak') {
      const catatan = prompt('Alasan penolakan (opsional):', '') ?? '';
      await api(`/api/reports/${id}`, {
        method: 'PATCH',
        auth: true,
        body: { status: 'ditolak', catatanAdmin: catatan },
      });
      toast('Laporan ditolak.', 'sukses');
    } else {
      const jadikanTitik = aksi === 'verifikasi-titik';
      await api(`/api/reports/${id}`, {
        method: 'PATCH',
        auth: true,
        body: { status: 'diverifikasi', jadikanTitik },
      });
      toast(
        jadikanTitik
          ? 'Laporan diverifikasi dan ditambahkan ke peta sebagai titik rawan.'
          : 'Laporan berhasil diverifikasi.',
        'sukses'
      );
    }
    await muat();
  } catch (err) {
    toast(err.message, 'gagal');
  }
}

/* ---------------- Kejadian ---------------- */
document.getElementById('wadahLaporan').addEventListener('click', (e) => {
  const aksi = e.target.closest('[data-aksi]');
  if (aksi) return proses(aksi.dataset.id, aksi.dataset.aksi);

  const tombolPeta = e.target.closest('[data-peta]');
  if (tombolPeta) {
    const id = tombolPeta.dataset.peta;
    const r = semuaLaporan.find((x) => x.id === id);
    const wadah = document.getElementById(`peta-${id}`);
    if (!r || !wadah) return;

    if (wadah.style.display === 'none') {
      wadah.style.display = 'block';
      if (!wadah._petaLeaflet) {
        const peta = L.map(wadah, { zoomControl: false, attributionControl: false }).setView([r.lat, r.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(peta);
        L.circleMarker([r.lat, r.lng], {
          radius: 10,
          color: '#fff',
          weight: 3,
          fillColor: warnaKategori(r.jenis),
          fillOpacity: 0.95,
        }).addTo(peta);
        wadah._petaLeaflet = peta;
      }
      setTimeout(() => wadah._petaLeaflet.invalidateSize(), 100);
      tombolPeta.textContent = 'Sembunyikan peta';
    } else {
      wadah.style.display = 'none';
      tombolPeta.textContent = 'Tampilkan peta lokasi';
    }
  }
});

function aktifkanTab(tab) {
  tabAktif = tab;
  const tMenunggu = document.getElementById('tabMenunggu');
  const tRiwayat = document.getElementById('tabRiwayat');
  tMenunggu.className = tab === 'pending' ? 'tombol' : 'tombol sekunder';
  tRiwayat.className = tab === 'riwayat' ? 'tombol' : 'tombol sekunder';
  gambar();
}

document.getElementById('tabMenunggu').addEventListener('click', () => aktifkanTab('pending'));
document.getElementById('tabRiwayat').addEventListener('click', () => aktifkanTab('riwayat'));
document.getElementById('muatUlang').addEventListener('click', muat);

/* ---------------- Muat data ---------------- */
async function muat() {
  try {
    const { data } = await api('/api/reports', { auth: true });
    semuaLaporan = data;
    perbaruiBadgePending();
    aktifkanTab(tabAktif);
  } catch (err) {
    toast(`Gagal memuat laporan: ${err.message}`, 'gagal');
  }
}

(async () => {
  if (!(await wajibLogin())) return;
  pasangLayout({
    aktif: 'verifikasi.html',
    judul: 'Verifikasi Laporan',
    subjudul: 'Periksa laporan warga, lalu verifikasi atau tolak',
  });
  await muat();
})();

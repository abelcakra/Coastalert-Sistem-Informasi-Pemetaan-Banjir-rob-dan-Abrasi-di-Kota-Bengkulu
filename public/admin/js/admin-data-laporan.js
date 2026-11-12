/**
 * admin-data-laporan.js - Halaman data laporan admin.
 * Menampilkan seluruh laporan (terverifikasi & menunggu) beserta detailnya.
 */
import {
  badgeJenis,
  badgeStatus,
  esc,
  formatKoordinat,
  labelTanggal,
  pasangLayout,
  pasangModal,
  petaMini,
  wajibLogin,
  warnaKategori,
} from './admin-common.js?v=7';
import { muatLaporanAdmin } from './admin-laporan-common.js?v=2';

let semuaLaporan = [];
const modal = pasangModal('modalDetail');

/* ---------------- Ringkasan ---------------- */
function gambarRingkasan(rows) {
  const hitung = (status) => rows.filter((r) => r.status === status).length;
  document.getElementById('jmlSemua').textContent = rows.length;
  document.getElementById('jmlMenunggu').textContent = hitung('pending');
  document.getElementById('jmlTerverifikasi').textContent = hitung('diverifikasi');
  document.getElementById('jmlDitolak').textContent = hitung('ditolak');
  document.getElementById('jmlRob').textContent = rows.filter((r) => r.jenis === 'rob').length;
  document.getElementById('jmlAbrasi').textContent = rows.filter((r) => r.jenis === 'abrasi').length;
}

/* ---------------- Tabel ---------------- */
function terapkanFilter() {
  const status = document.getElementById('filterStatus').value;
  const cari = document.getElementById('cariLaporan').value.trim().toLowerCase();

  const rows = semuaLaporan.filter((r) => {
    if (status && r.status !== status) return false;
    if (cari && ![r.namaPelapor, r.alamat, r.kecamatan, r.deskripsi].join(' ').toLowerCase().includes(cari)) {
      return false;
    }
    return true;
  });

  gambarRingkasan(rows);

  const tbody = document.getElementById('tabelLaporan');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="kosong">Tidak ada laporan sesuai filter.</td></tr>';
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${labelTanggal(r.tanggal)}${r.kode ? `<br><span class="tag-kecil">${esc(r.kode)}</span>` : ''}</td>
        <td>${esc(r.namaPelapor)}<br><span class="tag-kecil">${esc(r.kontak || '—')}</span></td>
        <td>${badgeJenis(r.jenis)}</td>
        <td>${esc(r.alamat || '—')}<br><span class="tag-kecil">${esc(r.kecamatan || '—')}</span></td>
        <td class="tag-kecil">${formatKoordinat(r.lat, r.lng, { pemisah: ',<br>' })}</td>
        <td>${badgeStatus(r.status)}</td>
        <td>
          <div style="display:flex;gap:.3rem;flex-wrap:wrap">
            <button class="tombol sekunder kecil" data-detail="${r.id}">Detail</button>
            ${r.status === 'pending' ? `<a class="tombol kecil" href="/admin/verifikasi?fokus=${encodeURIComponent(r.id)}">Verifikasi</a>` : ''}
          </div>
        </td>
      </tr>`
    )
    .join('');
}

/* ---------------- Detail ---------------- */
function bukaDetail(id) {
  const r = semuaLaporan.find((x) => x.id === id);
  if (!r) return;

  document.getElementById('judulModal').textContent = `Laporan ${r.jenis === 'rob' ? 'Banjir Rob' : 'Abrasi'}`;
  document.getElementById('subJudulModal').textContent = r.kode ? `Kode: ${r.kode}` : `ID: ${r.id}`;

  const foto = r.foto
    ? `<img class="foto-penuh" src="${esc(r.foto)}" alt="Foto kejadian" />`
    : `<div class="foto-penuh" style="height:170px;display:grid;place-items:center;color:var(--abu-500);font-size:.85rem">
         Tidak ada foto kejadian
       </div>`;

  modal.isi().innerHTML = `
    <div class="grid-2" style="gap:1.2rem;align-items:start">
      <div>
        ${foto}
        <div id="petaDetail" class="peta-mini" style="margin-top:.8rem"></div>
        <p class="tag-kecil" style="margin-top:.4rem">
          Koordinat: ${formatKoordinat(r.lat, r.lng, { desimal: 6 })}
        </p>
      </div>
      <div>
        ${badgeJenis(r.jenis)} ${badgeStatus(r.status)}
        <dl class="daftar-detail" style="margin-top:.8rem">
          <dt>Tanggal kejadian</dt><dd>${labelTanggal(r.tanggal)}</dd>
          <dt>Pelapor</dt><dd>${esc(r.namaPelapor)}</dd>
          <dt>Kontak</dt><dd>${esc(r.kontak || '—')}</dd>
          <dt>Kecamatan</dt><dd>${esc(r.kecamatan || '—')}</dd>
          <dt>Alamat / patokan</dt><dd>${esc(r.alamat || '—')}</dd>
          <dt>Dikirim pada</dt><dd>${r.createdAt ? new Date(r.createdAt).toLocaleString('id-ID') : '—'}</dd>
          <dt>Catatan admin</dt><dd>${esc(r.catatanAdmin || '—')}</dd>
        </dl>
        <p style="margin-top:.8rem;font-size:.88rem;color:var(--abu-700)">
          <strong>Deskripsi:</strong><br>${esc(r.deskripsi || '—')}
        </p>
      </div>
    </div>`;

  modal.buka();
  petaMini('petaDetail', r.lat, r.lng, warnaKategori(r.jenis));
}

/* ---------------- Kejadian ---------------- */
document.getElementById('filterStatus').addEventListener('change', terapkanFilter);

let timerCari = null;
document.getElementById('cariLaporan').addEventListener('input', () => {
  clearTimeout(timerCari);
  timerCari = setTimeout(terapkanFilter, 220);
});

document.getElementById('tabelLaporan').addEventListener('click', (e) => {
  const id = e.target.closest('[data-detail]')?.dataset.detail;
  if (id) bukaDetail(id);
});

/* ---------------- Muat ---------------- */
async function muat() {
  const data = await muatLaporanAdmin();
  if (!data) return;
  semuaLaporan = data;
  terapkanFilter();
}

(async () => {
  if (!(await wajibLogin())) return;
  pasangLayout({
    aktif: '/admin/data-laporan',
    judul: 'Data Laporan',
    subjudul: 'Daftar seluruh laporan warga beserta status dan detailnya',
  });
  muat();

  // Buka detail otomatis bila ada parameter ?fokus=id
  const fokus = new URLSearchParams(location.search).get('fokus');
  if (fokus) {
    const cek = setInterval(() => {
      if (semuaLaporan.length) {
        clearInterval(cek);
        bukaDetail(fokus);
      }
    }, 200);
  }
})();

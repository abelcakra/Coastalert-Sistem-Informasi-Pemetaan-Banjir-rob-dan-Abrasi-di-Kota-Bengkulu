/**
 * gea-stats.js - Kartu statistik Zona Bahaya dari hasil olahan raster.
 * Dipakai dashboard publik dan admin; data berasal dari properti `gea`
 * pada GET /api/stats.
 */

const KELAS = [
  { kunci: 'Rendah', label: 'Zona Bahaya Rendah', kelas: 'gea-rendah' },
  { kunci: 'Sedang', label: 'Zona Bahaya Sedang', kelas: 'gea-sedang' },
  { kunci: 'Tinggi', label: 'Zona Bahaya Tinggi', kelas: 'gea-tinggi' },
];

function angka(n) {
  const nilai = Number(n);
  if (!Number.isFinite(nilai)) return '-';
  return nilai.toLocaleString('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function kartu({ nilai, label, kelas }) {
  const teksNilai = angka(nilai);
  return `
    <div class="gea-card ${kelas}">
      <div class="gea-nilai">${teksNilai}${teksNilai === '-' ? '' : ' <span class="gea-satuan">Ha</span>'}</div>
      <div class="gea-label"><span class="gea-warna" aria-hidden="true"></span>${label}</div>
    </div>`;
}

/** HTML kartu Zona Bahaya; menampilkan pesan, bukan angka palsu, bila data tidak ada. */
export function htmlStatistikGea(gea) {
  if (!gea || !gea.kelas || !gea.total) {
    return '<p class="gea-kosong">Statistik Zona Bahaya belum tersedia. Jalankan pengolahan raster terlebih dahulu.</p>';
  }

  const kartuKelas = KELAS.map(({ kunci, label, kelas }) => {
    const data = gea.kelas[kunci];
    if (!data) return '';
    return kartu({ nilai: data.luasHa, label, kelas });
  }).join('');

  const total = kartu({
    nilai: gea.total.luasHa,
    label: 'Total Zona Bahaya',
    kelas: 'gea-total',
  });

  return kartuKelas + total;
}

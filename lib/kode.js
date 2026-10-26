/**
 * kode.js - Kode laporan publik (dipakai warga untuk melacak status).
 *
 * Format: CL-123456 (CL = CoastAlert, diikuti 6 angka).
 * Kode dibuat acak dan dicek ke database agar tidak ada yang kembar.
 */
import { cariBerdasarkan, read, update } from './db.js';

/** Buat kode laporan baru yang belum dipakai. */
export async function buatKodeLaporan() {
  for (let i = 0; i < 50; i += 1) {
    const kode = `CL-${Math.floor(100000 + Math.random() * 900000)}`;
    if (!(await cariBerdasarkan('reports', 'kode', kode))) return kode;
  }
  // Cadangan bila 50 percobaan gagal (sangat jarang).
  return `CL-${String(Date.now()).slice(-6)}`;
}

/** Lengkapi laporan lama yang belum punya kode. Kembalikan jumlah yang diubah. */
export async function lengkapiKodeLaporan() {
  const rows = await read('reports');
  let jumlah = 0;
  for (const row of rows) {
    if (!row.kode) {
      await update('reports', row.id, { kode: await buatKodeLaporan() });
      jumlah += 1;
    }
  }
  return jumlah;
}

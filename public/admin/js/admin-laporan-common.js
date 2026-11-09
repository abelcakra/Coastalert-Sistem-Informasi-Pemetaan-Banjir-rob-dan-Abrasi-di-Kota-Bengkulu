/**
 * admin-laporan-common.js - Pemuatan data bersama halaman laporan admin.
 *
 * Hanya proses yang benar-benar sama yang dipusatkan di sini. Rendering,
 * filter, tab, modal, peta, dan aksi admin tetap berada di halaman masing-
 * masing agar perbedaan alur tidak dipaksakan menjadi satu abstraksi.
 */
import { api, perbaruiBadgePending, toast } from './admin-common.js?v=7';

/**
 * Ambil seluruh laporan admin dan mulai pembaruan badge pending.
 * Mengembalikan null bila gagal agar halaman tidak merender data lama.
 */
export async function muatLaporanAdmin() {
  try {
    const { data } = await api('/api/reports', { auth: true });
    void perbaruiBadgePending();
    return data;
  } catch (err) {
    toast(`Gagal memuat laporan: ${err.message}`, 'gagal');
    return null;
  }
}

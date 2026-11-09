/**
 * normalisasi.js - aturan normalisasi nilai bersama untuk backend.
 *
 * Modul ini murni (tanpa akses database/berkas) agar aman dipakai route,
 * script impor, dan pengujian. Fungsi yang aturan bisnisnya berbeda sengaja
 * tidak dipindahkan ke sini.
 */

export const JENIS = Object.freeze(['rob', 'abrasi']);
export const KATEGORI = Object.freeze(['Rendah', 'Sedang', 'Tinggi']);
export const STATUS_KOORDINAT = Object.freeze(['perkiraan', 'referensi_lokasi', 'terverifikasi']);
export const STATUS_LAPORAN = Object.freeze(['pending', 'diverifikasi', 'ditolak']);
export const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}(?: s\.d\. \d{4}-\d{2}-\d{2})?$/;

/**
 * Kosong/undefined menjadi null; angka 0 eksplisit tetap 0.
 * String dengan koma desimal diterima; nilai bukan angka menjadi null.
 */
export function normalisasiAngka(nilai) {
  if (nilai === null || nilai === undefined) return null;
  if (typeof nilai === 'string' && nilai.trim() === '') return null;
  const n = Number(typeof nilai === 'string' ? nilai.replace(',', '.') : nilai);
  return Number.isFinite(n) ? n : null;
}

/** Teks aman: null/undefined menjadi string kosong, lalu di-trim. */
export function normalisasiTeks(nilai) {
  return String(nilai ?? '').trim();
}

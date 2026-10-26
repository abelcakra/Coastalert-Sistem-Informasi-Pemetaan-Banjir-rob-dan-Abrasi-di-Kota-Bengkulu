/**
 * kode-laporan.js - Menyimpan kode laporan yang dikirim dari browser ini.
 *
 * Data disimpan di localStorage (bukan akun), sehingga halaman Status Laporan
 * hanya menampilkan laporan yang pernah dikirim melalui browser/perangkat ini.
 */
const KUNCI = 'coastalert_laporan';
const MAKS = 100;

/** Rapikan input kode: huruf besar, tanpa spasi, "123456" -> "CL-123456". */
export function normalisasiKode(teks) {
  let kode = String(teks || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d{6}$/.test(kode)) kode = `CL-${kode}`;
  return kode;
}

/** Ambil daftar kode yang tersimpan (terbaru lebih dulu). */
export function ambilKode() {
  try {
    const data = JSON.parse(localStorage.getItem(KUNCI) || '[]');
    if (!Array.isArray(data)) return [];
    return data.map(normalisasiKode).filter(Boolean);
  } catch {
    return [];
  }
}

/** Simpan satu kode (paling atas) lalu kembalikan daftar terbaru. */
export function simpanKode(kode) {
  const k = normalisasiKode(kode);
  const daftar = ambilKode();
  if (!k) return daftar;

  const baru = [k, ...daftar.filter((x) => x !== k)].slice(0, MAKS);
  localStorage.setItem(KUNCI, JSON.stringify(baru));
  return baru;
}

/** Hapus satu kode (mis. laporannya sudah tidak ada di server). */
export function hapusKode(kode) {
  const k = normalisasiKode(kode);
  const baru = ambilKode().filter((x) => x !== k);
  localStorage.setItem(KUNCI, JSON.stringify(baru));
  return baru;
}

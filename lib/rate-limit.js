/**
 * rate-limit.js - Rate limiter sederhana berbasis memori.
 *
 * Catatan penting:
 * - Penghitung disimpan di memori proses. Saat aplikasi dijalankan pada lebih
 *   dari satu instance/worker, setiap instance memiliki penghitung sendiri.
 *   Untuk deployment multi-instance, gunakan penyimpanan bersama (misalnya
 *   Redis) agar batas permintaan berlaku global.
 * - Kunci bawaan adalah alamat IP dari Express (`req.ip`). Di belakang reverse
 *   proxy, aktifkan `trust proxy` secara benar agar semua pengguna tidak
 *   dianggap memiliki IP proxy yang sama.
 */

const buckets = new Map();
let pembersihanTerakhir = 0;

/** Buang bucket yang sudah kedaluwarsa agar memori tidak terus bertambah. */
function bersihkanKedaluwarsa(sekarang) {
  if (sekarang - pembersihanTerakhir < 60_000) return;
  pembersihanTerakhir = sekarang;
  for (const [kunci, bucket] of buckets) {
    if (bucket.reset <= sekarang) buckets.delete(kunci);
  }
}

function kunciDariRequest(req, nama, keyGenerator) {
  if (keyGenerator) return `${nama}:${keyGenerator(req)}`;
  return `${nama}:${req.ip || req.socket?.remoteAddress || 'tidak-diketahui'}`;
}

/**
 * Buat middleware rate limiter.
 *
 * @param {object} opsi
 * @param {string} opsi.nama Nama unik untuk memisahkan penghitung antar-endpoint.
 * @param {number} opsi.windowMs Jendela waktu dalam milidetik.
 * @param {number} opsi.max Jumlah maksimum permintaan per jendela.
 * @param {string} [opsi.pesan] Pesan kesalahan saat batas terlampaui.
 * @param {number} [opsi.status=429] Status HTTP saat batas terlampaui.
 * @param {(req: import('express').Request) => string} [opsi.keyGenerator]
 */
export function buatRateLimiter({
  nama,
  windowMs,
  max,
  pesan = 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
  status = 429,
  keyGenerator,
}) {
  if (!nama || !Number.isFinite(windowMs) || windowMs <= 0 || !Number.isFinite(max) || max <= 0) {
    throw new TypeError('Konfigurasi rate limiter tidak valid.');
  }

  return function rateLimiter(req, res, next) {
    const sekarang = Date.now();
    bersihkanKedaluwarsa(sekarang);

    const kunci = kunciDariRequest(req, nama, keyGenerator);
    let bucket = buckets.get(kunci);
    if (!bucket || bucket.reset <= sekarang) {
      bucket = { jumlah: 0, reset: sekarang + windowMs };
      buckets.set(kunci, bucket);
    }

    bucket.jumlah += 1;

    const sisa = Math.max(0, max - bucket.jumlah);
    const detikPulih = Math.max(1, Math.ceil((bucket.reset - sekarang) / 1000));
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(sisa));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.reset / 1000)));

    if (bucket.jumlah > max) {
      res.setHeader('Retry-After', String(detikPulih));
      return res.status(status).json({ error: pesan, retryAfter: detikPulih });
    }

    next();
  };
}

/** Hanya dipakai oleh pengujian untuk memastikan state tidak bocor antar-tes. */
export function resetRateLimitUntukTes() {
  buckets.clear();
  pembersihanTerakhir = 0;
}

/**
 * routes/chat.js - Chatbot CS CoastAlert (proxy ke Ollama lokal).
 *
 * Membutuhkan Ollama berjalan di http://localhost:11434 dengan model
 * sesuai OLLAMA_MODEL (bawaan: qwen2.5:7b — unduh dulu: ollama pull qwen2.5:7b).
 *
 * Balasan diteruskan apa adanya sebagai streaming NDJSON dari Ollama,
 * sehingga jawaban tampil bertahap (mengetik) di peramban.
 */
import { Router } from 'express';
import { read } from '../lib/db.js';

const router = Router();

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const MAX_PESAN = 2000; // batas panjang satu pesan
const MAX_RIWAYAT = 8; // jumlah pesan sebelumnya yang dikirim ke model

/** Ringkas data titik & laporan sebagai konteks si chatbot. */
async function konteksData() {
  const spots = await read('spots');
  const reports = await read('reports');

  const rob = spots.filter((s) => s.jenis === 'rob');
  const abrasi = spots.filter((s) => s.jenis === 'abrasi');

  const perKecamatan = {};
  for (const s of spots) {
    const k = s.kecamatan || 'Tidak diketahui';
    perKecamatan[k] = (perKecamatan[k] || 0) + 1;
  }

  const barisTitik = spots
    .map((s) => {
      const detail =
        s.jenis === 'rob'
          ? `tinggi rob ${s.tinggiRob ?? '—'} cm`
          : `laju abrasi ${s.lajuAbrasi ?? '—'} m/tahun`;
      return `- ${s.nama} — ${s.jenis} — ${s.kategori} — Kec. ${s.kecamatan || '—'} — ${detail}, luas ${s.luasTerdampakHa ?? '—'} ha, ${s.kkTerdampak ?? '—'} KK terdampak`;
    })
    .join('\n');

  return [
    `Total titik rawan terpetakan: ${spots.length} (${rob.length} rob, ${abrasi.length} abrasi).`,
    `Sebaran per kecamatan: ${Object.entries(perKecamatan).map(([k, n]) => `${k}=${n}`).join(', ')}.`,
    `Laporan warga: ${reports.length} total, ${reports.filter((r) => r.status === 'diverifikasi').length} terverifikasi, ${reports.filter((r) => r.status === 'pending').length} menunggu verifikasi.`,
    '',
    'Daftar titik rawan:',
    barisTitik || '(belum ada data)',
  ].join('\n');
}

/** Prompt sistem: peran chatbot + petunjuk + data terkini. */
async function promptSistem() {
  return `Kamu adalah "CoastAlert CS", asisten virtual (customer service) untuk situs CoastAlert - Web GIS pemetaan banjir rob dan abrasi pesisir Kota Bengkulu.

Tugasmu membantu pengunjung: menjelaskan fitur situs, menceritakan titik rawan berdasarkan DATA di bawah, dan mengarahkan cara melaporkan kejadian.

Halaman situs:
- Peta Interaktif (peta.html): sebaran titik rawan rob & abrasi; bisa difilter jenis, kecamatan, dan tingkat kerawanan.
- Statistik (dashboard.html): grafik jumlah titik per kecamatan, tren tinggi rob, dan laju abrasi per tahun.
- Lapor Kejadian (laporan.html): formulir laporan warga, lengkap dengan titik lokasi di peta dan foto. Laporan tampil di peta publik setelah diverifikasi admin.
- Panel Admin (/admin/): untuk petugas memverifikasi laporan warga dan mengelola titik.

Aturan menjawab:
- Selalu gunakan bahasa Indonesia yang ramah, sopan, dan ringkas (maksimal sekitar 120 kata).
- Jika pengguna meminta daftar, periksa SELURUH data dengan teliti dan sebutkan semua yang cocok, jangan sampai ada yang terlewat.
- Jawab HANYA berdasarkan DATA di bawah dan informasi halaman di atas. Jangan mengarang angka, lokasi, atau koordinat.
- Jika informasi tidak ada pada data, katakan belum tersedia lalu arahkan ke halaman yang relevan.
- Untuk kondisi darurat, anjurkan menghubungi 112 (darurat) atau BPBD Kota Bengkulu.
- Jangan membahas topik di luar CoastAlert, rob/abrasi pesisir, dan kebencanaan pesisir Bengkulu; tolak dengan sopan dan arahkan kembali ke topik situs.

DATA SAAT INI:
${await konteksData()}`;
}

/** POST /api/chat - kirim pertanyaan, terima balasan streaming (NDJSON). */
router.post('/', async (req, res) => {
  const pesan = String(req.body?.pesan || '').trim().slice(0, MAX_PESAN);
  if (!pesan) return res.status(400).json({ error: 'Pesan tidak boleh kosong.' });

  // Ambil beberapa pesan terakhir untuk menjaga konteks percakapan.
  const riwayat = (Array.isArray(req.body?.riwayat) ? req.body.riwayat : [])
    .filter(
      (m) =>
        m &&
        ['user', 'assistant'].includes(m.role) &&
        typeof m.content === 'string' &&
        m.content.trim()
    )
    .slice(-MAX_RIWAYAT)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_PESAN) }));

  const messages = [
    { role: 'system', content: await promptSistem() },
    ...riwayat,
    { role: 'user', content: pesan },
  ];

  // Batalkan permintaan ke Ollama bila peramban menutup koneksi.
  const kontrol = new AbortController();
  res.on('close', () => kontrol.abort());

  let ollama;
  try {
    ollama = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: kontrol.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: true,
        keep_alive: '30m', // tahan model di memori agar balasan berikutnya cepat
        options: { temperature: 0.4, num_predict: 512 },
      }),
    });
  } catch {
    return res.status(503).json({
      error:
        `Chatbot tidak dapat terhubung ke Ollama di ${OLLAMA_URL}. ` +
        `Pastikan Ollama sedang berjalan dan model "${OLLAMA_MODEL}" sudah diunduh ` +
        `(jalankan: ollama pull ${OLLAMA_MODEL}).`,
    });
  }

  if (!ollama.ok || !ollama.body) {
    const teks = await ollama.text().catch(() => '');
    return res.status(502).json({
      error: `Ollama menolak permintaan (${ollama.status}). ${teks}`.trim(),
    });
  }

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    for await (const bagian of ollama.body) {
      res.write(bagian);
    }
  } catch {
    // Koneksi terputus di tengah jalan — tidak perlu tindakan.
  }
  res.end();
});

export default router;

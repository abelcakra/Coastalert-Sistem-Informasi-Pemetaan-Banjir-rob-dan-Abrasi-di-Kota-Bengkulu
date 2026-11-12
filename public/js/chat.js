/**
 * chat.js - Widget chatbot CS CoastAlert.
 *
 * Menampilkan tombol mengambang di semua halaman publik; percakapan
 * diteruskan ke POST /api/chat (yang meneruskan ke Ollama lokal) dan
 * jawaban tampil bertahap mengikuti streaming NDJSON.
 */
import { esc } from './common.js';

const MAKS_RIWAYAT = 8;

/** Riwayat percakapan sesi ini: { role: 'user' | 'assistant', content } */
const riwayat = [];
let sibuk = false; // true selama menunggu balasan
let sudahDibuka = false;

/* ---------------- Struktur widget ---------------- */
const tombol = document.createElement('button');
tombol.className = 'chat-tombol';
tombol.title = 'Tanya CoastAlert CS';
tombol.setAttribute('aria-label', 'Buka layanan informasi CoastAlert');
tombol.innerHTML = `
  <svg class="ikon-buka" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>
  </svg>
  <svg class="ikon-tutup" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
`;

const panel = document.createElement('section');
panel.className = 'chat-panel';
panel.hidden = true;
panel.setAttribute('aria-label', 'Layanan informasi CoastAlert');
panel.innerHTML = `
  <header class="chat-kepala">
    <img class="chat-mark" src="/img/logo-mark.png" alt="" />
    <div class="chat-identitas">
      <strong>CoastAlert</strong>
      <span class="chat-status">Layanan informasi — siap membantu</span>
    </div>
    <button type="button" class="chat-tombol-tutup" title="Tutup" aria-label="Tutup chat">&times;</button>
  </header>
  <div class="chat-pesan" id="chatPesan" aria-live="polite"></div>
  <div class="chat-saran">
    <button type="button">Titik rawan rob di Teluk Segara?</button>
    <button type="button">Bagaimana cara melaporkan kejadian?</button>
    <button type="button">Berapa jumlah titik abrasi?</button>
  </div>
  <form class="chat-form">
    <textarea class="chat-input" rows="1" placeholder="Tulis pertanyaan Anda…" aria-label="Pesan"></textarea>
    <button type="submit" class="chat-kirim" title="Kirim" aria-label="Kirim pesan">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </form>
  <p class="chat-catatan">Kondisi darurat: hubungi 112 atau BPBD Kota Bengkulu.</p>
`;

document.body.appendChild(tombol);
document.body.appendChild(panel);

const areaPesan = panel.querySelector('.chat-pesan');
const areaSaran = panel.querySelector('.chat-saran');
const form = panel.querySelector('.chat-form');
const input = panel.querySelector('.chat-input');
const tombolKirim = panel.querySelector('.chat-kirim');
const tombolTutup = panel.querySelector('.chat-tombol-tutup');

/* ---------------- Bantu tampilan ---------------- */
/** Ubah teks balasan (teks biasa + **tebal**) menjadi HTML aman. */
function rapikan(teks) {
  return esc(teks)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function geserKeBawah() {
  areaPesan.scrollTop = areaPesan.scrollHeight;
}

/** Tambah gelembung pesan; kembalikan elemennya agar bisa diperbarui. */
function tambahPesan(peran, teks = '', kelasTambahan = '') {
  const el = document.createElement('div');
  el.className = `pesan ${peran === 'user' ? 'pengguna' : 'robot'}${kelasTambahan ? ` ${kelasTambahan}` : ''}`;
  el.innerHTML = rapikan(teks);
  areaPesan.appendChild(el);
  geserKeBawah();
  return el;
}

/** Gelembung indikator "sedang menulis…" */
function tambahMenulis() {
  const el = document.createElement('div');
  el.className = 'pesan robot menulis';
  el.innerHTML = '<span class="titik"></span><span class="titik"></span><span class="titik"></span>';
  areaPesan.appendChild(el);
  geserKeBawah();
  return el;
}

function aturSibuk(nilai) {
  sibuk = nilai;
  tombolKirim.disabled = nilai;
  input.disabled = nilai;
  if (!nilai) input.focus();
}

/* ---------------- Alur percakapan ---------------- */
function bukaPanel() {
  panel.hidden = false;
  tombol.classList.add('aktif');
  if (!sudahDibuka) {
    sudahDibuka = true;
    tambahPesan(
      'robot',
      'Halo! Selamat datang di CoastAlert.\n\nSaya bisa membantu Anda:\n- Mencari tahu titik rawan **banjir rob & abrasi** di pesisir Kota Bengkulu\n- Menjelaskan cara membaca **peta** dan **statistik**\n- Mengarahkan cara **melaporkan kejadian** di sekitar Anda\n\nSilakan tulis pertanyaan, atau pilih salah satu contoh di bawah.'
    );
  }
  input.focus();
}

function tutupPanel() {
  panel.hidden = true;
  tombol.classList.remove('aktif');
}

/** Kirim pesan ke /api/chat dan tampilkan balasan bertahap. */
async function kirimPesan(teks) {
  const pesan = teks.trim();
  if (!pesan || sibuk) return;

  areaSaran.hidden = true;
  tambahPesan('user', pesan);
  riwayat.push({ role: 'user', content: pesan });
  input.value = '';
  input.style.height = 'auto';
  aturSibuk(true);

  const gelembung = tambahMenulis();
  let balasan = '';
  let mulai = false;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pesan, riwayat: riwayat.slice(0, -1) }),
    });

    if (!res.ok || !res.body) {
      const galat = await res.json().catch(() => ({}));
      const err = new Error(
        galat.error || 'Layanan informasi sedang tidak tersedia. Silakan coba lagi beberapa saat lagi.'
      );
      err.publik = true;
      throw err;
    }

    // Baca streaming NDJSON dari Ollama baris per baris.
    const pembaca = res.body.getReader();
    const dekoder = new TextDecoder();
    let sisa = '';

    for (;;) {
      const { done, value } = await pembaca.read();
      if (done) break;
      sisa += dekoder.decode(value, { stream: true });

      const baris = sisa.split('\n');
      sisa = baris.pop(); // simpan potongan baris terakhir yang belum lengkap

      for (const satu of baris) {
        if (!satu.trim()) continue;
        let objek;
        try {
          objek = JSON.parse(satu);
        } catch {
          continue;
        }
        const bagian = objek.message?.content || '';
        if (!bagian) continue;
        if (!mulai) {
          mulai = true;
          gelembung.remove();
        }
        balasan += bagian;
        const target = mulai ? areaPesan.lastElementChild : gelembung;
        if (!target || !target.classList.contains('robot')) {
          tambahPesan('robot', balasan);
        } else {
          target.innerHTML = rapikan(balasan);
        }
        geserKeBawah();
      }
    }

    if (!balasan.trim()) {
      gelembung.remove();
      tambahPesan('robot', 'Maaf, saya belum bisa menjawab saat ini. Coba lagi sesaat ya.', 'galat');
    } else {
      riwayat.push({ role: 'assistant', content: balasan });
      if (riwayat.length > MAKS_RIWAYAT * 2) riwayat.splice(0, riwayat.length - MAKS_RIWAYAT * 2);
    }
  } catch (err) {
    gelembung.remove();
    tambahPesan(
      'robot',
      err?.publik
        ? err.message
        : 'Maaf, layanan informasi sedang tidak dapat diakses. Silakan coba lagi beberapa saat lagi.',
      'galat'
    );
  } finally {
    aturSibuk(false);
  }
}

/* ---------------- Kejadian ---------------- */
tombol.addEventListener('click', () => (panel.hidden ? bukaPanel() : tutupPanel()));
tombolTutup.addEventListener('click', tutupPanel);

areaSaran.querySelectorAll('button').forEach((b) =>
  b.addEventListener('click', () => kirimPesan(b.textContent))
);

form.addEventListener('submit', (e) => {
  e.preventDefault();
  kirimPesan(input.value);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    kirimPesan(input.value);
  }
});

// Tinggi kolom input mengikuti isi (maks 3 baris).
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 96)}px`;
});

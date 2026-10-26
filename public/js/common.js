/**
 * common.js - Fungsi bantu yang dipakai semua halaman.
 */
import './transisi.js';

const TOKEN_KEY = 'coastalert_token';

/* ---------------- Token admin ---------------- */
export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  hapus: () => localStorage.removeItem(TOKEN_KEY),
  ada: () => Boolean(localStorage.getItem(TOKEN_KEY)),
};

/* ---------------- Panggilan API ---------------- */
export async function api(path, { method = 'GET', body, formData, auth: pakaiToken = false } = {}) {
  const headers = {};
  if (pakaiToken && auth.get()) headers.Authorization = `Bearer ${auth.get()}`;

  let payload;
  if (formData) {
    payload = formData; // biarkan browser mengatur Content-Type
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(path, { method, headers, body: payload });
  const teks = await res.text();
  let json = {};
  try {
    json = teks ? JSON.parse(teks) : {};
  } catch {
    json = { error: teks };
  }
  if (!res.ok) {
    if (res.status === 401) auth.hapus();
    throw new Error(json.error || `Permintaan gagal (${res.status})`);
  }
  return json;
}

/* ---------------- Format ---------------- */
export const format = {
  angka: (n, desimal = 0) =>
    Number.isFinite(Number(n))
      ? Number(n).toLocaleString('id-ID', { maximumFractionDigits: desimal })
      : '—',
  persen: (n) => (Number.isFinite(Number(n)) ? `${format.angka(n, 1)}%` : '—'),
  tanggal: (teks) => {
    if (!teks) return '—';
    const d = new Date(teks);
    if (Number.isNaN(d.getTime())) return teks;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  },
  teks: (s) => (s === null || s === undefined || s === '' ? '—' : String(s)),
};

/** Amankan teks agar aman dimasukkan ke HTML. */
export function esc(teks) {
  return String(teks ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------------- Warna kategori ---------------- */
export const WARNA_ROB = { Rendah: '#8CC7BF', Sedang: '#449B94', Tinggi: '#256486' };
export const WARNA_ABRASI = { Rendah: '#EFC0BF', Sedang: '#D38180', Tinggi: '#A85E5D' };

export function warnaTitik(jenis, kategori) {
  const palet = jenis === 'abrasi' ? WARNA_ABRASI : WARNA_ROB;
  return palet[kategori] || palet.Sedang;
}

/** Ukuran radius penanda berdasarkan luas terdampak (ha). */
export function radiusTitik(luas) {
  const nilai = Number(luas);
  if (!Number.isFinite(nilai) || nilai <= 0) return 9;
  return Math.min(22, 8 + Math.sqrt(nilai) * 2.6);
}

/* ---------------- Notifikasi ---------------- */
let timerToast = null;
export function toast(pesan, jenis = '') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = pesan;
  el.className = jenis ? `tampil ${jenis}` : 'tampil';
  clearTimeout(timerToast);
  timerToast = setTimeout(() => {
    el.className = '';
  }, 3400);
}

/* ---------------- Navigasi ---------------- */
export function tandaiNav() {
  const halaman = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar nav a').forEach((a) => {
    const target = a.getAttribute('href');
    if (target === halaman || (halaman === '' && target === 'index.html')) {
      a.classList.add('aktif');
    }
  });
}

/** Isi dropdown dari daftar nilai. */
export function isiSelect(select, daftar, { kosong = null, terpilih = '' } = {}) {
  if (!select) return;
  select.innerHTML = '';
  if (kosong) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = kosong;
    select.appendChild(opt);
  }
  for (const item of daftar) {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    if (String(item) === String(terpilih)) opt.selected = true;
    select.appendChild(opt);
  }
}

document.addEventListener('DOMContentLoaded', tandaiNav);

/**
 * uji-api.mjs - Uji cepat seluruh alur API CoastAlert.
 *
 * Jalankan server lebih dulu (npm start), lalu:
 *   node scripts/uji-api.mjs
 *
 * Skrip ini membuat data uji lalu menghapusnya kembali.
 */
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let lulus = 0;
let gagal = 0;

function cek(nama, kondisi, info = '') {
  if (kondisi) {
    lulus += 1;
    console.log(`  ✔ ${nama}`);
  } else {
    gagal += 1;
    console.log(`  ✘ ${nama} ${info ? `→ ${info}` : ''}`);
  }
}

async function json(path, opsi = {}) {
  const res = await fetch(BASE + path, opsi);
  const teks = await res.text();
  let data = {};
  try {
    data = teks ? JSON.parse(teks) : {};
  } catch {
    data = { raw: teks };
  }
  return { status: res.status, data };
}

console.log(`\nMenguji API di ${BASE}\n`);

/* ---------- 1. Endpoint publik ---------- */
console.log('1) Endpoint publik');
const spots = await json('/api/spots');
cek('GET /api/spots', spots.status === 200 && Array.isArray(spots.data.data));
cek('Data contoh tersedia', spots.data.jumlah > 0, `jumlah=${spots.data.jumlah}`);

const rob = await json('/api/spots?jenis=rob');
cek('Filter jenis=rob', rob.data.data.every((s) => s.jenis === 'rob'));

const stats = await json('/api/stats');
cek('GET /api/stats', stats.status === 200 && stats.data.ringkasan.totalTitik > 0);

const meta = await json('/api/stats/meta');
cek('GET /api/stats/meta', meta.status === 200 && meta.data.kecamatan.length > 0);

/* ---------- 2. Laporan warga ---------- */
console.log('\n2) Laporan warga');
const fd = new FormData();
fd.append('namaPelapor', 'Penguji Otomatis');
fd.append('kontak', '0812xxxxxxx');
fd.append('jenis', 'rob');
fd.append('kecamatan', 'Teluk Segara');
fd.append('alamat', 'Uji coba jalan Malabero');
fd.append('deskripsi', 'Laporan uji otomatis oleh skrip uji-api.mjs');
fd.append('lat', '-3.7861');
fd.append('lng', '102.2581');
fd.append('foto', new Blob([Buffer.from('uji')], { type: 'image/png' }), 'uji.png');

const laporan = await json('/api/reports', { method: 'POST', body: fd });
cek('POST /api/reports', laporan.status === 201, JSON.stringify(laporan.data).slice(0, 120));
const laporanId = laporan.data?.data?.id;

const tanpaToken = await json('/api/reports');
cek('GET /api/reports ditolak tanpa token', tanpaToken.status === 401);

/* ---------- 3. Login admin ---------- */
console.log('\n3) Admin');
const salah = await json('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: 'password-salah' }),
});
cek('Login dengan password salah ditolak', salah.status === 401);

const login = await json('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD }),
});
cek('Login admin berhasil', login.status === 200 && Boolean(login.data.token));
const token = login.data.token;
const H = { Authorization: `Bearer ${token}` };

const daftarLaporan = await json('/api/reports', { headers: H });
cek('GET /api/reports dengan token', daftarLaporan.status === 200 && daftarLaporan.data.jumlah > 0);

/* ---------- 4. Verifikasi laporan ---------- */
console.log('\n4) Verifikasi laporan');
const verifikasi = await json(`/api/reports/${laporanId}`, {
  method: 'PATCH',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'diverifikasi', jadikanTitik: true }),
});
cek('PATCH verifikasi + jadikan titik', verifikasi.status === 200 && Boolean(verifikasi.data.spot));
const titikDariLaporan = verifikasi.data?.spot?.id;

const publik = await json('/api/reports/publik');
cek('Laporan muncul di endpoint publik', publik.data.data.some((r) => r.id === laporanId));

/* ---------- 5. CRUD titik ---------- */
console.log('\n5) CRUD titik (admin)');
const buat = await json('/api/spots', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nama: 'Titik Uji Otomatis',
    kecamatan: 'Teluk Segara',
    jenis: 'abrasi',
    kategori: 'Sedang',
    lat: -3.8,
    lng: 102.25,
    lajuAbrasi: 1.5,
    luasTerdampakHa: 2.5,
    kkTerdampak: 10,
    tahun: 2024,
  }),
});
cek('POST /api/spots', buat.status === 201);
const titikId = buat.data?.data?.id;

const ubah = await json(`/api/spots/${titikId}`, {
  method: 'PUT',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...buat.data.data, kategori: 'Tinggi' }),
});
cek('PUT /api/spots/:id', ubah.status === 200 && ubah.data.data.kategori === 'Tinggi');

const tidakValid = await json('/api/spots', {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({ nama: '', jenis: 'xxx' }),
});
cek('Validasi menolak data tidak lengkap', tidakValid.status === 400);

/* ---------- 6. Import GIS ---------- */
console.log('\n6) Import GIS');
const gj = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [102.26, -3.79] },
      properties: { nama: 'Uji GeoJSON', jenis: 'rob', kategori: 'Tinggi', kecamatan: 'Teluk Segara', tinggiRob: 70 },
    },
  ],
};
const fdGj = new FormData();
fdGj.append('file', new Blob([JSON.stringify(gj)], { type: 'application/json' }), 'uji.geojson');
const imporGj = await json('/api/import/geojson', { method: 'POST', headers: H, body: fdGj });
cek('Import GeoJSON', imporGj.status === 200 && imporGj.data.berhasil === 1, JSON.stringify(imporGj.data));

const csv = 'nama,jenis,kategori,kecamatan,lat,lng,tinggiRob\nUji CSV,rob,Sedang,Teluk Segara,-3.79,102.26,45\n';
const fdCsv = new FormData();
fdCsv.append('file', new Blob([csv], { type: 'text/csv' }), 'uji.csv');
const imporCsv = await json('/api/import/csv', { method: 'POST', headers: H, body: fdCsv });
cek('Import CSV', imporCsv.status === 200 && imporCsv.data.berhasil === 1, JSON.stringify(imporCsv.data));

/* ---------- 7. Bersihkan data uji ---------- */
console.log('\n7) Membersihkan data uji');
const semua = await json('/api/spots');
const sampah = semua.data.data.filter((s) =>
  ['Uji GeoJSON', 'Uji CSV', 'Titik Uji Otomatis', 'Uji coba jalan Malabero'].includes(s.nama) ||
  String(s.sumber || '').includes('Penguji Otomatis')
);
for (const s of sampah) await json(`/api/spots/${s.id}`, { method: 'DELETE', headers: H });
if (laporanId) await json(`/api/reports/${laporanId}`, { method: 'DELETE', headers: H });
if (titikId) await json(`/api/spots/${titikId}`, { method: 'DELETE', headers: H });
if (titikDariLaporan) await json(`/api/spots/${titikDariLaporan}`, { method: 'DELETE', headers: H });
cek('Data uji dibersihkan', true);

/* ---------- Ringkasan ---------- */
const akhir = await json('/api/spots');
console.log(`\nSisa titik di peta: ${akhir.data.jumlah}`);
console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal ? 1 : 0);

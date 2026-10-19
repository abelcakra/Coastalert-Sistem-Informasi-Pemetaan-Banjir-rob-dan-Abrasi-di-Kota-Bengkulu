# 🌊 CoastAlert

**Web GIS Pemetaan Banjir Rob dan Abrasi Pesisir Kota Bengkulu**

Aplikasi web untuk memetakan titik rawan banjir rob dan abrasi pantai, dilengkapi
dashboard admin, pelaporan oleh warga, verifikasi laporan, serta impor data GIS.

---

## ✨ Fitur

### Situs publik
| Fitur | Keterangan |
|---|---|
| 🗺️ Peta interaktif | Leaflet + OpenStreetMap (tanpa API key), titik rob & abrasi berwarna sesuai tingkat kerawanan |
| 🔎 Filter & pencarian | Filter jenis, kecamatan, tingkat kerawanan + pencarian nama lokasi |
| 📊 Dashboard publik | Kartu ringkasan + grafik Chart.js (per kecamatan, kategori, tren tahunan) |
| 📝 Laporan warga | Formulir laporan dengan pemilih titik lokasi di peta + unggah foto |
| 🤖 Chatbot CS | Asisten virtual mengambang di semua halaman publik, menjawab pertanyaan tentang peta, statistik, titik rawan, dan cara melapor (via Ollama lokal) |

### Dashboard admin (5 halaman)
| Halaman | Isi |
|---|---|
| 📊 **Dashboard Utama** | Ringkasan (total titik, laporan terverifikasi/menunggu/ditolak), **statistik titik rawan**, **statistik laporan**, **sebaran kategori bencana** dalam grafik, serta daftar pelaporan terverifikasi & laporan terbaru |
| 🗺️ **Peta Interaktif** | Sebaran titik di peta: **bentuk** penanda = kategori bencana (lingkaran = rob, kotak = abrasi), **warna** = tingkat kerawanan, **ukuran** = luas terdampak; dilengkapi filter & layer |
| 🗂️ **Data Laporan** | Daftar semua laporan (terverifikasi & menunggu) + filter status/pencarian + **modal detail** berisi foto, lokasi, tanggal, pelapor, deskripsi, dan peta lokasi |
| ✅ **Verifikasi Laporan** | Kartu laporan dari warga (foto kejadian, lokasi, tanggal, pelapor, deskripsi) dengan aksi **Verifikasi**, **Verifikasi & jadikan titik**, atau **Tolak** |
| 📍 **Kelola Titik Lokasi** | Tabel titik: **ID, kategori, nama lokasi, kerawanan, koordinat, aksi**; admin dapat **menambah/mengubah/menghapus** titik, memilih lokasi lewat peta, dan **import GeoJSON/CSV** |

---

## 🚀 Menjalankan

Prasyarat: **Node.js**, **Laragon** (MySQL), dan **Ollama** (untuk chatbot CS).

1. Buka aplikasi **Laragon** → klik **Start All** (MySQL berjalan di `localhost:3306`, user `root` tanpa password).
2. Siapkan database (sekali saja):
   ```bash
   npm install
   npm run db:setup   # buat database `coastalert` + tabel + impor data dari data/*.json
   ```
3. Jalankan website:
   ```bash
   npm start
   ```

Buka <http://localhost:3000>

| Halaman | URL |
|---|---|
| Peta publik | <http://localhost:3000> |
| Dashboard publik | <http://localhost:3000/dashboard.html> |
| Lapor kejadian | <http://localhost:3000/laporan.html> |
| **Panel admin** | <http://localhost:3000/admin/> — password bawaan **admin123** |

Ubah password admin lewat variabel lingkungan:

```powershell
$env:ADMIN_PASSWORD="rahasia123"; npm start
```

### 🗄️ Database (MySQL — Laragon)

Konfigurasi bawaan sudah cocok untuk Laragon (host `127.0.0.1`, user `root`, tanpa password,
database `coastalert`). Ubah bila perlu:

```powershell
$env:DB_HOST="127.0.0.1"; $env:DB_USER="root"; $env:DB_PASSWORD=""; $env:DB_NAME="coastalert"; npm start
```

| Tabel | Isi |
|---|---|
| `spots` | Titik rawan rob & abrasi: nama, kecamatan, jenis, kategori, koordinat, tinggi rob / laju abrasi, luas terdampak, KK, tahun, deskripsi |
| `reports` | Laporan warga: pelapor, kontak, alamat, jenis kejadian, lokasi, tanggal, foto, status verifikasi, catatan admin |

Perintah yang berguna:

```bash
npm run db:setup              # buat database + tabel, impor data dari data/*.json bila tabel kosong
npm run db:setup -- --force   # buat ulang tabel + impor ulang dari data/*.json
npm run seed                  # tulis ulang data contoh (24 titik + 8 laporan) ke MySQL
```

Database dapat dilihat lewat phpMyAdmin Laragon (<http://localhost/phpmyadmin>) atau HeidiSQL.

Mode pengembangan (otomatis muat ulang): `npm run dev`
Uji seluruh API: `node scripts/uji-api.mjs`

### 🤖 Chatbot CS (Ollama)

Chatbot memakai **Ollama** yang berjalan lokal — gratis, tanpa API key:
1. Pasang Ollama dari <https://ollama.com/download> lalu jalankan.
2. Unduh model (sekali saja): `ollama pull qwen2.5:7b`
3. `npm start` — tombol chat 💬 muncul di pojok kanan bawah semua halaman publik.

Konfigurasi lewat variabel lingkungan (opsional):

```powershell
$env:OLLAMA_URL="http://localhost:11434"; $env:OLLAMA_MODEL="qwen2.5:7b"; npm start
```

> ⚠️ **Windows + NVIDIA:** bila model gagal dimuat dengan galat
> `CUDA error: shared object initialization failed`, atur variabel lingkungan
> `CUDA_MODULE_LOADING=EAGER` sebelum Ollama dijalankan
> (solusi untuk bug ollama/ollama#17380 — sudah diterapkan di komputer ini).
> Pemuatan model pertama kali ke VRAM memerlukan ±8 detik.

---

## 🗂️ Struktur Proyek

```
Coastalert/
├── server.js                    # Server Express (file utama)
├── package.json
├── lib/
│   ├── db.js                    # Koneksi & query MySQL (Laragon)
│   ├── auth.js                  # Login & token admin
│   └── seed.js                  # Data contoh 24 titik + 8 laporan warga (masuk MySQL)
├── routes/
│   ├── spots.js                 # CRUD titik rawan
│   ├── reports.js               # Laporan warga + verifikasi
│   ├── stats.js                 # Statistik dashboard & metadata
│   ├── import.js                # Import GeoJSON / CSV
│   └── chat.js                  # Chatbot CS (proxy Ollama)
├── public/                      # Situs publik
│   ├── index.html               # Peta interaktif publik
│   ├── dashboard.html           # Dashboard statistik publik
│   ├── laporan.html             # Formulir laporan warga
│   ├── admin.html               # Pengalih ke /admin/
│   ├── css/style.css
│   └── js/{common,map,dashboard,laporan}.js
├── public/admin/                # Dashboard admin
│   ├── login.html               # Halaman masuk admin
│   ├── index.html               # Dashboard utama
│   ├── peta.html                # Peta interaktif admin
│   ├── data-laporan.html        # Data & detail laporan
│   ├── verifikasi.html          # Verifikasi laporan warga
│   ├── titik.html               # Kelola titik lokasi
│   ├── css/admin.css
│   └── js/admin-{common,dashboard,peta,data-laporan,verifikasi,titik}.js
├── contoh-data/                 # Contoh berkas untuk uji import
├── scripts/
│   ├── setup-db.mjs             # Setup database MySQL (buat tabel + migrasi data JSON)
│   └── uji-api.mjs              # Skrip pengujian API
├── data/                        # Data JSON lama (sumber migrasi awal)
└── uploads/                     # Foto laporan (otomatis dibuat)
```

---

## 🛡️ Alur Kerja Admin

1. **Masuk** di `/admin/login.html` dengan password admin.
2. **Dashboard Utama** — pantau ringkasan: total titik lokasi, laporan terverifikasi,
   statistik titik rawan per kecamatan, sebaran kategori bencana, dan statistik laporan.
3. **Peta Interaktif** — periksa sebaran titik; gunakan filter kategori bencana,
   kecamatan, dan tingkat kerawanan.
4. **Data Laporan** — lihat detail seluruh laporan (terverifikasi & menunggu) termasuk foto,
   pelapor, tanggal, dan peta lokasi.
5. **Verifikasi Laporan** — proses laporan baru:
   - **✓ Verifikasi** → status menjadi terverifikasi dan tampil di peta publik.
   - **＋ Verifikasi & jadikan titik** → sekaligus membuat titik rawan baru di peta.
   - **✗ Tolak** → status menjadi ditolak disertai catatan alasan.
6. **Kelola Titik Lokasi** — tambah/edit/hapus titik, pilih koordinat lewat peta,
   atau import data banyak sekaligus (GeoJSON/CSV).

Token login berlaku 8 jam dan disimpan di peramban (`localStorage`).

---

## 🔌 Ringkasan API

| Method | Endpoint | Keterangan | Akses |
|---|---|---|---|
| POST | `/api/admin/login` | Login admin | Publik |
| POST | `/api/admin/logout` | Keluar | Admin |
| GET | `/api/admin/cek` | Cek keabsahan token | Admin |
| GET | `/api/spots` | Daftar titik (filter: `jenis`, `kategori`, `kecamatan`, `q`) | Publik |
| GET | `/api/spots/:id` | Detail titik | Publik |
| POST | `/api/spots` | Tambah titik | Admin |
| PUT | `/api/spots/:id` | Ubah titik | Admin |
| DELETE | `/api/spots/:id` | Hapus titik | Admin |
| POST | `/api/reports` | Kirim laporan (multipart, opsional `foto`) | Publik |
| GET | `/api/reports/publik` | Laporan terverifikasi (layer peta) | Publik |
| GET | `/api/reports` | Daftar semua laporan (filter `status`) | Admin |
| PATCH | `/api/reports/:id` | Verifikasi/tolak (`status`, `catatanAdmin`, `jadikanTitik`) | Admin |
| DELETE | `/api/reports/:id` | Hapus laporan | Admin |
| GET | `/api/stats` | Statistik titik **dan** laporan | Publik |
| GET | `/api/stats/meta` | Daftar kecamatan, tahun, jenis, kategori | Publik |
| POST | `/api/import/geojson` | Import GeoJSON (field `file`) | Admin |
| POST | `/api/import/csv` | Import CSV (field `file`) | Admin |
| POST | `/api/chat` | Chatbot CS (`pesan`, `riwayat`) — proxy ke Ollama, balasan streaming NDJSON | Publik |

Respons `/api/stats` memuat:
`ringkasan`, `perKategori`, `perKecamatan`, `sebaranKategori` (rob/abrasi × Rendah/Sedang/Tinggi),
`trenPerTahun`, dan `laporan` (`perStatus`, `perJenis`, `trenPerBulan`, `terverifikasi`, `menunggu`, `terbaru`).

Autentikasi admin memakai header `Authorization: Bearer <token>`.

---

## 📤 Format Import

### GeoJSON

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [102.2585, -3.7865] },
      "properties": {
        "nama": "Kelurahan Malabero",
        "kecamatan": "Teluk Segara",
        "jenis": "rob",
        "kategori": "Tinggi",
        "tinggiRob": 92,
        "luasTerdampakHa": 14.5,
        "kkTerdampak": 780,
        "tahun": 2024,
        "deskripsi": "Rob masuk hingga 500 m ke darat."
      }
    }
  ]
}
```

### CSV

```csv
nama,jenis,kategori,kecamatan,lat,lng,tinggiRob,lajuAbrasi,luasTerdampakHa,kkTerdampak,tahun,deskripsi
Kelurahan Malabero,rob,Tinggi,Teluk Segara,-3.7865,102.2585,92,,14.5,780,2024,Rob masuk hingga 500 m ke darat
```

Kolom `jenis` diisi `rob` atau `abrasi`. Untuk abrasi, isi kolom `lajuAbrasi`.
Contoh berkas tersedia di folder `contoh-data/`.

---

## 🛠️ Teknologi

- **Backend:** Node.js + Express, Multer (unggah berkas)
- **Database:** MySQL 9 (Laragon) lewat paket `mysql2` — tabel `spots` & `reports`
- **Chatbot:** Ollama (AI lokal) dengan model `qwen2.5:7b`
- **Frontend:** HTML, CSS, JavaScript (ES Modules)
- **Peta:** Leaflet 1.9 + OpenStreetMap
- **Grafik:** Chart.js 4

## 📌 Rencana Pengembangan

- [ ] Dashboard khusus pengguna (riwayat laporan yang dikirim)
- [ ] Layer batas administrasi kelurahan/kecamatan
- [ ] Ekspor data ke CSV/GeoJSON

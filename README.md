# 🌊 CoastAlert

**Web GIS Pemetaan Banjir Rob dan Abrasi Pesisir Kota Bengkulu**

Aplikasi web untuk memetakan titik rawan banjir rob dan abrasi pantai, dilengkapi
dashboard admin, pelaporan oleh warga, verifikasi laporan, serta impor data GIS.

---

## ✨ Fitur

### Situs publik
| Fitur | Keterangan |
|---|---|
| 🏠 Beranda | Halaman pembuka dengan ringkasan layanan dan tautan ke peta, dashboard, pelaporan, dan status laporan |
| 🗺️ Peta interaktif | Leaflet + OpenStreetMap (tanpa API key), titik rob & abrasi berwarna sesuai tingkat kerawanan |
| 🔎 Filter & pencarian | Filter jenis, kecamatan, tingkat kerawanan + pencarian nama lokasi |
| 📊 Dashboard publik | Kartu ringkasan + grafik Chart.js (per kecamatan, kategori, tren tahunan) |
| 📝 Laporan warga | Formulir laporan dengan pemilih titik lokasi di peta + unggah foto |
| 🔎 Status laporan | Lacak status laporan dengan kode (contoh: `CL-123456`) atau lihat riwayat laporan yang dikirim dari browser ini |
| 🤖 HARA (Asisten Virtual) | Singkatan dari **High Automated Response for Abrasive and Coast**, juga diambil dari nama **Haiji Rifky Abel**; menjawab pertanyaan tentang peta, statistik, titik rawan, dan cara melapor (via Ollama lokal) |

### Dashboard admin (login + 5 halaman)
| Halaman | Isi |
|---|---|
| 🔐 **Login** | Masuk dengan satu kolom password dari `ADMIN_PASSWORD`; tidak ada username |
| 📊 **Dashboard Utama** | Ringkasan (total titik, laporan terverifikasi/menunggu/ditolak), **statistik titik rawan**, **statistik laporan**, **sebaran kategori bencana** dalam grafik, serta daftar pelaporan terverifikasi & laporan terbaru |
| 🗺️ **Peta Interaktif** | Sebaran titik di peta: **bentuk** penanda = kategori bencana (lingkaran = rob, kotak = abrasi), **warna** = tingkat kerawanan, **ukuran** = luas terdampak; dilengkapi filter & layer |
| 🗂️ **Data Laporan** | Daftar semua laporan (terverifikasi & menunggu) + filter status/pencarian + **modal detail** berisi foto, lokasi, tanggal, pelapor, deskripsi, dan peta lokasi |
| ✅ **Verifikasi Laporan** | Kartu laporan dari warga (foto kejadian, lokasi, tanggal, pelapor, deskripsi) dengan aksi **Verifikasi**, **Verifikasi & jadikan titik**, atau **Tolak** |
| 📍 **Kelola Titik Lokasi** | Tabel titik: **ID, kategori, nama lokasi, kerawanan, koordinat, aksi**; admin dapat **menambah/mengubah/menghapus** titik, memilih lokasi lewat peta, dan **import GeoJSON/CSV** |

---

## 🚀 Menjalankan

Prasyarat: **Node.js 24+** (diuji pada v24.14.1), **Laragon** (MySQL), dan **Ollama** (opsional, untuk chatbot HARA).

1. Buka aplikasi **Laragon** → klik **Start All** (MySQL berjalan di `localhost:3306`, user `root` tanpa password).
2. Siapkan database (sekali saja):
   ```bash
   npm install
   npm run db:setup   # buat database `coastalert` + tabel + impor data dari data/*.json
   ```
3. Siapkan environment lokal:
   ```powershell
   Copy-Item .env.example .env
   ```
   Isi `ADMIN_PASSWORD` di `.env` dengan password admin pilihan Anda. File `.env`
   sudah diabaikan Git dan tidak boleh di-commit.
4. Jalankan website:
   ```bash
   npm start
   ```
   Jika PowerShell menolak `npm.ps1`, gunakan `npm.cmd start` atau
   `node --env-file-if-exists=.env server.js`.

Buka <http://localhost:3000>

| Halaman | URL |
|---|---|
| Beranda | <http://localhost:3000/> |
| Peta publik | <http://localhost:3000/peta.html> |
| Dashboard publik | <http://localhost:3000/dashboard.html> |
| Lapor kejadian | <http://localhost:3000/laporan.html> |
| Status laporan | <http://localhost:3000/status.html> |
| **Panel admin** | <http://localhost:3000/admin/> — login memakai satu password dari `ADMIN_PASSWORD` |
| Login admin langsung | <http://localhost:3000/admin/login.html> |

### 🔐 Login admin dan environment

Login admin hanya memakai satu input password; tidak ada username.

- `npm start` dan `npm run dev` menjalankan Node dengan
  `--env-file-if-exists=.env`, sehingga `.env` dibaca otomatis sebelum aplikasi
  dan `lib/auth.js` dimuat.
- Jika `.env` tidak ada atau `ADMIN_PASSWORD` kosong, server tetap berjalan,
  tetapi login admin nonaktif dan `POST /api/admin/login` mengembalikan HTTP 503.
- Development lokal: `ADMIN_PASSWORD` minimal 8 karakter. Nilai demo hanya
  diizinkan pada mode `development`.
- Di luar development (termasuk production): gunakan password minimal 12 karakter
  yang mengandung huruf besar, huruf kecil, angka, dan simbol. Set
  `NODE_ENV=production` saat deploy production; nilai demo ditolak.
- Setelah mengubah `.env`, restart server agar nilai baru dipakai.
- Dari terminal baru, `.env` tetap dibaca otomatis selama file itu ada di folder
  proyek.
- Alternatif tanpa `.env`: atur `$env:ADMIN_PASSWORD` di terminal yang sama
  sebelum `npm start`. Variabel ini hilang saat terminal ditutup.

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
npm run db:setup                        # buat database + tabel, impor data dari data/*.json bila tabel kosong
npm run db:setup -- --force --yes       # DESTRUKTIF: buat ulang tabel + impor ulang dari data/*.json
npm run seed                            # isi data awal bila tabel masih kosong (upsert)
node lib/seed.js --force --yes          # perbarui dari JSON; --force wajib --yes
npm run dataset:check                   # validasi data/spots.json + data/reports.json tanpa menulis DB
npm run dataset:import                  # tambah/ubah data berdasarkan id (tanpa menghapus baris lain)
node scripts/import-dataset.mjs --replace --yes  # ganti data aktif (backup otomatis; butuh persetujuan)
npm test                                # jalankan seluruh tes otomatis dengan database uji terpisah
```

Jangan menjalankan `--force`, `--replace`, `seed --force`, atau `dataset:import`
terhadap database produksi tanpa backup dan persetujuan eksplisit. Rincian risiko
setiap script ada di [`scripts/README.md`](scripts/README.md).

### 📚 Dataset aktif

- Data yang dipakai aplikasi: `data/spots.json` berisi **57 titik** (7 rob, 50 abrasi)
  di 5 kecamatan, dan `data/reports.json` berisi **0 laporan**.
- Seluruh 57 titik masih berstatus **belum terverifikasi** dan memakai koordinat
  **perkiraan**. Kategori risiko pada data aktif sudah terisi: 3 Rendah, 18 Sedang,
  dan 36 Tinggi.
- Paket sumber terpisah: `dataset/coastalalert-2021-2025/` (`README_DATASET.txt`,
  `sumber_dataset.csv`, `spots.json`, `reports.json`) berisi **11 catatan sumber**
  (8 rob, 3 abrasi) dan **0 laporan**. Paket ini bukan isi tabel aktif.
- Nilai `tinggiRob`, `lajuAbrasi`, `luasTerdampakHa`, dan `kkTerdampak` hanya diisi
  bila tersedia pada sumber; nilai yang tidak tersedia tidak dikarang.
- Laporan abrasi 2024 dan 2025 pada paket sumber dapat merujuk masalah berkelanjutan
  yang sama; keduanya tidak otomatis dihitung sebagai dua kejadian independen.

Database dapat dilihat lewat phpMyAdmin Laragon (<http://localhost/phpmyadmin>) atau HeidiSQL.

Mode pengembangan (otomatis muat ulang): `npm run dev`

Tes otomatis memakai database uji terpisah (`coastalert_phase*_test`) dan tidak
menyentuh database `coastalert`:

```bash
npm test
```

Uji API manual (hanya terhadap server/database uji, bukan produksi):

```bash
node --env-file-if-exists=.env scripts/uji-api.mjs
```

### 🤖 HARA — Asisten Virtual (Ollama)

**HARA** adalah singkatan dari **High Automated Response for Abrasive and Coast**, sekaligus diambil dari nama **Haiji Rifky Abel**. HARA memakai **Ollama** yang berjalan lokal — gratis, tanpa API key:
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
├── .env.example                 # Template konfigurasi lokal (salin ke .env)
├── lib/
│   ├── auth.js                  # Login & token admin
│   ├── db.js                    # Koneksi & query MySQL (Laragon)
│   ├── kode.js                  # Pembuatan kode pelacakan laporan
│   ├── rate-limit.js            # Pembatas percobaan login/laporan
│   ├── seed.js                  # Memuat data awal dari data/spots.json & data/reports.json
│   ├── upload-laporan.js        # Validasi & penyimpanan foto laporan
│   └── wilayah.js               # Klasifikasi titik di dalam/luar batas kota
├── routes/
│   ├── spots.js                 # CRUD titik rawan
│   ├── reports.js               # Laporan warga + verifikasi
│   ├── stats.js                 # Statistik dashboard & metadata
│   ├── import.js                # Import GeoJSON / CSV
│   └── chat.js                  # HARA (chatbot, proxy Ollama)
├── public/                      # Situs publik
│   ├── index.html               # Beranda/landing page
│   ├── peta.html                # Peta interaktif publik
│   ├── dashboard.html           # Dashboard statistik publik
│   ├── laporan.html             # Formulir laporan warga
│   ├── status.html              # Pelacakan status laporan
│   ├── admin.html               # Pengalih ke /admin/
│   ├── css/{style,map-publik,gea}.css
│   ├── js/{common,map,dashboard,laporan,status,chat,kode-laporan,gea-stats,layer-gea,transisi}.js
│   ├── img/                     # Logo, foto, dan overlay GEA
│   └── admin/                   # Dashboard admin
│       ├── login.html           # Halaman masuk admin
│       ├── index.html           # Dashboard utama
│       ├── peta.html            # Peta interaktif admin
│       ├── data-laporan.html    # Data & detail laporan
│       ├── verifikasi.html      # Verifikasi laporan warga
│       ├── titik.html           # Kelola titik lokasi
│       ├── css/admin.css
│       └── js/admin-{common,dashboard,peta,data-laporan,verifikasi,titik}.js
├── data/
│   ├── spots.json               # Data titik aktif untuk migrasi/import
│   ├── reports.json             # Data laporan untuk migrasi/import
│   ├── gea/                     # Raster, statistik, dan visualisasi GEA
│   └── arsip/                   # Arsip titik/laporan di luar batas kota
├── dataset/coastalalert-2021-2025/ # Paket 11 catatan sumber (terpisah dari data aktif)
├── contoh-data/                 # Contoh berkas untuk uji import
├── scripts/                     # Script operasional; lihat scripts/README.md
├── tests/                       # Tes otomatis Phase 1–3 (database uji terpisah)
├── uploads/                     # Foto laporan (diabaikan Git)
└── backup/                      # Backup/audit (diabaikan Git)
```

> Catatan audit: `public/js/admin.js` dan `public/img/logo-coastalert.jpg` belum
> dirujuk halaman aktif. Dua tag CDN `leaflet.markercluster` di `public/peta.html`
> dan `public/admin/peta.html` juga tidak dipakai karena tidak ada pemakaian
> `markerCluster`/`clusterGroup` di JavaScript. Semua kandidat tersebut tidak
> dihapus atau diubah pada Phase 4 Tahap 2 dan perlu ditinjau terpisah.

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
| GET | `/api/reports/lacak/:kode` | Cek status laporan dengan kode (contoh `CL-123456`) | Publik |
| GET | `/api/reports` | Daftar semua laporan (filter `status`) | Admin |
| PATCH | `/api/reports/:id` | Verifikasi/tolak (`status`, `catatanAdmin`, `jadikanTitik`) | Admin |
| DELETE | `/api/reports/:id` | Hapus laporan | Admin |
| GET | `/api/stats` | Statistik titik **dan** laporan | Publik |
| GET | `/api/stats/meta` | Daftar kecamatan, tahun, jenis, kategori | Publik |
| POST | `/api/import/geojson` | Import GeoJSON (field `file`) | Admin |
| POST | `/api/import/csv` | Import CSV (field `file`) | Admin |
| POST | `/api/chat` | HARA (`pesan`, `riwayat`) — proxy ke Ollama, balasan streaming NDJSON | Publik |

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
- **Chatbot HARA:** Ollama (AI lokal) dengan model `qwen2.5:7b`
- **Frontend:** HTML, CSS, JavaScript (ES Modules)
- **Peta:** Leaflet 1.9 + OpenStreetMap
- **Grafik:** Chart.js 4

## 📌 Rencana Pengembangan

- [ ] Dashboard khusus pengguna (riwayat laporan yang dikirim)
- [ ] Layer batas administrasi kelurahan/kecamatan
- [ ] Ekspor data ke CSV/GeoJSON

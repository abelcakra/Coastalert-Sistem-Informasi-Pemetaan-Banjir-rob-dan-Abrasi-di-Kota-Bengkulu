# CoastAlert

CoastAlert adalah sistem informasi geografis berbasis web (Web GIS) untuk inventarisasi dan pemantauan titik rawan banjir rob serta abrasi di pesisir Kota Bengkulu. Aplikasi ini dibangun dengan Laravel dan menyediakan peta interaktif, statistik kerawanan, visualisasi Zona Bahaya GEA, serta kanal pelaporan masyarakat.

> **Batasan sistem:** CoastAlert bukan sistem prediksi bencana dan bukan sistem peringatan dini. CoastAlert menyajikan data inventaris titik rawan, indikasi kerawanan spasial, dan laporan kejadian yang telah diverifikasi. Informasi dalam aplikasi tidak dapat digunakan sebagai satu-satunya dasar peringatan darurat.

## Tujuan dan Fungsi

CoastAlert berfungsi untuk:

- Mendokumentasikan titik rawan banjir rob dan abrasi di wilayah pesisir Kota Bengkulu.
- Menyajikan sebaran titik rawan melalui peta interaktif yang dapat difilter.
- Menampilkan statistik dan visualisasi kerawanan pesisir, termasuk Zona Bahaya GEA.
- Menerima laporan kejadian dari masyarakat melalui formulir publik.
- Mendukung verifikasi laporan oleh administrator sebelum ditampilkan ke publik.
- Menyediakan kanal informasi tambahan berbasis Ollama yang bersifat opsional.

## Teknologi

| Komponen | Teknologi |
|---|---|
| Bahasa dan framework | PHP 8.3+ dan Laravel 13 |
| Database | MySQL 8.0+ dengan `utf8mb4_unicode_ci` |
| Tampilan | Blade, CSS, dan JavaScript di `public/` |
| Peta | Leaflet.js dan OpenStreetMap |
| Grafik | Chart.js |
| Layanan informasi | Ollama (opsional) |
| Pengujian | PHPUnit 12 |
| Server lokal | Laragon, Apache, atau `php artisan serve` |

Proyek ini tidak menggunakan `package.json`, Vite, atau proses build frontend. Berkas CSS dan JavaScript dimuat langsung dari direktori `public/` dan sebagian pustaka dimuat melalui CDN.

## Persyaratan Instalasi

- PHP 8.3 atau lebih baru dengan ekstensi `pdo_mysql`, `mbstring`, `fileinfo`, `curl`, `json`, dan `openssl`.
- Composer 2.x.
- MySQL 8.0+.
- Laragon, Apache, Nginx, atau PHP built-in server.
- Koneksi internet untuk memuat pustaka peta dan grafik dari CDN serta tile OpenStreetMap.
- Ollama hanya diperlukan jika fitur layanan informasi ingin digunakan.

## Instalasi

### 1. Masuk ke direktori proyek

```bash
cd C:\laragon\www\coastalert
```

### 2. Pasang dependensi PHP

```bash
composer install
```

### 3. Siapkan berkas `.env`

Salin berkas contoh, lalu buat application key:

```bash
copy .env.example .env
php artisan key:generate
```

Pada Linux atau macOS, gunakan `cp .env.example .env`.

Berkas `.env.example` masih menggunakan konfigurasi SQLite. Ubah konfigurasi database menjadi MySQL dan tambahkan variabel yang diperlukan. Contoh struktur konfigurasi:

```ini
APP_NAME=CoastAlert
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=coastalert
DB_USERNAME=<user-mysql>
DB_PASSWORD=<password-mysql>

ADMIN_PASSWORD=
# ADMIN_PASSWORD_HASH=
ADMIN_TOKEN_TTL_MINUTES=480

# Opsional, untuk layanan informasi Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT=180
```

Keterangan:

- Ganti seluruh nilai di dalam `<...>` dengan konfigurasi lingkungan Anda. Jangan menyimpan atau membagikan berkas `.env`.
- `ADMIN_PASSWORD` wajib diisi agar login administrator dapat digunakan. Gunakan password yang kuat. Untuk produksi, disarankan menggunakan `ADMIN_PASSWORD_HASH` dan tidak menyimpan password mentah.
- `ADMIN_TOKEN_TTL_MINUTES` mengatur masa berlaku token administrator dalam menit.
- `OLLAMA_URL` dan `OLLAMA_MODEL` bersifat opsional. Sesuaikan dengan instalasi Ollama dan model yang sudah tersedia.
- `BATAS_KOTA_PATH` dan `GEA_STATS_PATH` dapat diisi jika lokasi berkas GeoJSON batas kota atau statistik GEA dipindahkan. Nilai default sudah menunjuk ke `storage/app/geo/` dan `storage/app/gea/`.

Setelah mengubah `.env`, bersihkan konfigurasi yang mungkin masih tersimpan:

```bash
php artisan config:clear
```

### 4. Siapkan database MySQL di Laragon

1. Jalankan Laragon, lalu aktifkan MySQL.
2. Buat database baru bernama `coastalert` dengan karakter set `utf8mb4` dan collation `utf8mb4_unicode_ci`. Gunakan HeidiSQL, phpMyAdmin, atau MySQL CLI.
3. Pastikan nilai `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, dan `DB_PASSWORD` di `.env` sesuai dengan akun MySQL lokal Anda.

Contoh pembuatan database melalui MySQL CLI:

```bash
mysql -u <user-mysql> -p -e "CREATE DATABASE IF NOT EXISTS coastalert CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

> Jika nama `coastalert` sudah digunakan aplikasi lama, buat database terpisah (misalnya `coastalert_laravel`) dan set `DB_DATABASE` ke nama tersebut agar data lama tidak tertimpa.

### 5. Jalankan migration untuk instalasi baru

Untuk database baru yang masih kosong:

```bash
php artisan migrate
```

Migration membuat struktur tabel yang dibutuhkan aplikasi, termasuk `spots`, `reports`, dan `admin_tokens`, serta tabel bawaan Laravel.

> **Penting:** Migration tidak memuat ulang 57 titik rawan. Data titik merupakan data operasional yang harus diimpor dari sumber data yang telah diverifikasi melalui fitur impor GeoJSON atau CSV di panel administrator. Untuk berkas JSON warisan seperti `data/spots.json`, gunakan perintah `php artisan coastalert:import-spots-json "D:\Praktikum WEB\Coastalert\data\spots.json"` (tambahkan `--dry-run` untuk simulasi). Jangan menjalankan `migrate:fresh`, `db:wipe`, atau migration ulang pada database yang sudah berisi data operasional.

Jika aplikasi sudah terpasang dan database `coastalert` sudah berisi data, lewati langkah migration.

### 6. Jalankan aplikasi secara lokal

```bash
php artisan serve
```

Buka `http://127.0.0.1:8000`. Jika menggunakan virtual host Laragon, gunakan domain lokal yang telah dikonfigurasi.

## Struktur Direktori

| Direktori atau berkas | Keterangan |
|---|---|
| `app/Http/Controllers/` | Controller halaman publik, panel admin, dan API |
| `app/Models/` | Model `Spot`, `Report`, dan `AdminToken` |
| `app/Services/` | Logika laporan, titik, statistik, impor, autentikasi, foto, wilayah, dan chat |
| `app/Console/Commands/` | Perintah artisan, termasuk impor data lama |
| `config/coastalert.php` | Konfigurasi data spasial, unggahan, admin, dan Ollama |
| `database/migrations/` | Struktur database CoastAlert dan tabel bawaan Laravel |
| `public/css/` dan `public/js/` | Aset tampilan publik dan panel admin |
| `public/img/` | Logo dan citra pendukung |
| `public/img/gea/` | Citra raster Zona Bahaya GEA untuk peta |
| `public/uploads/` | Foto laporan masyarakat |
| `resources/views/public/` | Halaman publik |
| `resources/views/admin/` | Halaman panel administrator |
| `resources/views/layouts/` | Layout publik dan admin |
| `routes/web.php` | Rute halaman publik dan admin |
| `routes/api.php` | Endpoint API aplikasi |
| `storage/app/geo/` | GeoJSON batas Kota Bengkulu |
| `storage/app/gea/` | Data sumber dan statistik GEA |
| `tests/Feature/` | Pengujian fitur HTTP dan alur aplikasi |
| `tests/Unit/` | Pengujian unit layanan dan utilitas |
| `tests/bootstrap.php` | Pengelolaan database uji sementara |

## Fitur Publik

### Beranda

Halaman `/` memberikan pengenalan CoastAlert, navigasi ke fitur utama, dan ringkasan informasi pesisir.

### Peta Interaktif

Halaman `/peta` menampilkan peta Leaflet dengan:

- Sebaran titik rawan banjir rob dan abrasi.
- Filter berdasarkan jenis ancaman, kecamatan, dan tingkat kerawanan.
- Pencarian lokasi dan daftar titik.
- Layer laporan warga yang telah diverifikasi.
- Layer Zona Bahaya GEA yang dapat diaktifkan atau dinonaktifkan.
- Pembatasan tampilan pada area pesisir Kota Bengkulu.
- Legenda jenis ancaman, tingkat kerawanan, sumber data, dan Zona Bahaya.

### Dashboard Statistik

Halaman `/dashboard` menampilkan statistik titik rawan, jumlah titik per kecamatan, distribusi tingkat kerawanan, rekapitulasi per kecamatan, serta kartu luas Zona Bahaya GEA dalam satuan hektare.

### Lapor Kejadian

Halaman `/laporan` menyediakan formulir pelaporan masyarakat dengan data:

- Nama pelapor.
- Jenis kejadian: banjir rob atau abrasi.
- Deskripsi kejadian.
- Koordinat lokasi melalui peta.
- Kontak, alamat, kecamatan, dan tanggal kejadian sebagai data opsional.
- Foto dokumentasi opsional.

Ketentuan foto:

- Format JPG, JPEG, PNG, atau WebP.
- Ukuran maksimum 5 MB.
- Foto disimpan di `public/uploads/` dengan nama berawalan `laporan_`.

### Status Laporan

Halaman `/status` digunakan untuk melacak laporan menggunakan kode pelacakan berformat `CL-######`. Kode juga dapat diingat oleh browser pada perangkat yang sama. Status laporan yang digunakan adalah:

- `pending`: laporan sudah diterima dan menunggu verifikasi.
- `diverifikasi`: laporan telah diperiksa dan disetujui.
- `ditolak`: laporan tidak disetujui atau tidak dapat ditindaklanjuti.

Peta publik hanya menampilkan laporan yang berstatus `diverifikasi`.

### Layanan Informasi HARA

Widget HARA (High Automated Risk Abrasive and Coast) mengirim pertanyaan ke endpoint `/api/chat` dan memerlukan layanan Ollama yang aktif. Jika Ollama tidak tersedia atau model belum dipasang, aplikasi menampilkan pesan bahwa layanan informasi sedang tidak tersedia.

Pada Windows, jika model Ollama disimpan di drive lain (misalnya `D:\OllamaModels`), jalankan server dengan folder model tersebut:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ollama-serve.ps1
```

Skrip memakai `D:\OllamaModels` sebagai default, mencari `ollama.exe` di `%LOCALAPPDATA%\Programs\Ollama`, menjalankan `ollama serve`, lalu memeriksa ketersediaan model. Nilai default dapat diubah melalui parameter:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/ollama-serve.ps1 -ModelsPath "E:\OllamaModels" -Model "qwen2.5:7b"
```

Skrip yang sama dapat dijalankan dengan klik dua kali `scripts\start-ollama.bat`. Jika Ollama sudah dijalankan otomatis saat login dengan `OLLAMA_MODELS=D:\OllamaModels`, langkah ini dapat dilewati.

Pastikan `.env` berisi konfigurasi berikut:

```ini
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT=180
OLLAMA_NUM_CTX=16384
OLLAMA_TEMPERATURE=0.3
```

`OLLAMA_NUM_CTX` perlu cukup besar karena konteks layanan informasi memuat seluruh katalog titik rawan. Nilai default 16.384 mencegah daftar 57 titik terpotong saat model menjawab.

Periksa koneksi server dan ketersediaan model kapan saja dengan:

```bash
php artisan ollama:check
```

Endpoint `GET /api/chat/status` melaporkan kesiapan layanan, dan widget menampilkan indikator hijau saat Ollama beserta modelnya siap digunakan. Jika server tidak aktif atau model belum diunduh, unduh model dengan `ollama pull qwen2.5:7b`.

## Fitur Administrator

Panel administrator tersedia di `/admin` dan menggunakan autentikasi berbasis token. Password administrator diatur melalui `.env`; token sesi memiliki masa berlaku yang dapat dikonfigurasi. Endpoint login dilindungi pembatasan jumlah percobaan.

| Halaman | Fungsi |
|---|---|
| `/admin/login` | Login administrator |
| `/admin/dashboard` | Ringkasan statistik dan kondisi data |
| `/admin/peta` | Peta titik rawan untuk kebutuhan pengelolaan |
| `/admin/data-laporan` | Daftar, pencarian, filter, dan pengelolaan laporan |
| `/admin/verifikasi` | Verifikasi laporan, pemberian catatan, dan opsi menjadikan laporan sebagai titik baru |
| `/admin/titik` | Tambah, ubah, hapus, dan impor titik rawan |

Fitur pengelolaan titik mencakup penentuan koordinat melalui peta, pengaturan jenis ancaman, tingkat kerawanan, status koordinat, serta impor data GeoJSON dan CSV.

Laporan yang diverifikasi dapat dijadikan titik rawan baru jika koordinatnya berada di dalam batas Kota Bengkulu. Titik hasil laporan diberi status koordinat `perkiraan` dan tetap dapat diperbarui oleh administrator.

## Pemetaan 57 Titik Rawan

Katalog operasional CoastAlert saat ini berisi 57 titik rawan pesisir Kota Bengkulu. Sebaran berdasarkan data operasional adalah:

| Kecamatan | Jumlah titik |
|---|---:|
| Kampung Melayu | 27 |
| Ratu Agung | 7 |
| Ratu Samban | 6 |
| Sungai Serut | 7 |
| Teluk Segara | 10 |
| **Total** | **57** |

Berdasarkan jenis ancaman, terdapat 7 titik banjir rob dan 50 titik abrasi. Berdasarkan tingkat kerawanan, terdapat 3 titik kategori Rendah, 18 titik kategori Sedang, dan 36 titik kategori Tinggi.

Setiap titik memiliki atribut utama berupa nama, kecamatan, jenis ancaman, tingkat kerawanan, koordinat, status koordinat, deskripsi, sumber data, dan status verifikasi. Status koordinat yang digunakan adalah `perkiraan`, `referensi_lokasi`, dan `terverifikasi`. Titik yang berada di luar batas Kota Bengkulu tidak ditampilkan dalam katalog publik.

Data 57 titik merupakan data operasional yang sudah ada. Migration hanya membuat struktur tabel dan tidak membuat ulang data tersebut. Penambahan titik baru dapat dilakukan melalui panel administrator, termasuk melalui impor GeoJSON atau CSV dan melalui verifikasi laporan masyarakat.

## Visualisasi GEA

Dalam CoastAlert, GEA merupakan singkatan dari **Gelombang Ekstrem dan Abrasi**. Data GEA bersumber dari **InaRISK BNPB**.

Komponen visualisasi GEA:

- Statistik GEA dibaca dari `storage/app/gea/gea-stats.json`.
- Raster sumber disimpan di `storage/app/gea/` dengan metadata asli EPSG:32748 dan resolusi 30 meter.
- Citra overlay untuk peta tersedia di `public/img/gea/gea-kota-bengkulu.png`.
- Peta interaktif menyediakan layer Zona Bahaya GEA yang dapat diaktifkan pengguna.
- Dashboard menampilkan luas wilayah untuk kelas bahaya Rendah, Sedang, dan Tinggi.

Kelas bahaya GEA ditentukan dari nilai indeks raster:

- Rendah: nilai kurang dari atau sama dengan 1/3.
- Sedang: nilai lebih dari 1/3 sampai 2/3.
- Tinggi: nilai lebih dari 2/3 sampai 1.

Visualisasi GEA menunjukkan kelas kerawanan spasial, bukan prediksi waktu atau lokasi kejadian.

## Pelaporan Masyarakat

Alur pelaporan masyarakat:

1. Pengguna membuka `/laporan` dan mengisi data kejadian.
2. Pengguna memilih koordinat lokasi pada peta dan dapat menambahkan foto.
3. Sistem memvalidasi data, menyimpan laporan, dan menghasilkan kode `CL-######`.
4. Laporan masuk dengan status `pending`.
5. Administrator memeriksa laporan melalui `/admin/verifikasi`.
6. Administrator dapat mengubah status menjadi `diverifikasi` atau `ditolak`, menambahkan catatan, dan memilih opsi menjadikan laporan sebagai titik baru.
7. Laporan yang telah diverifikasi dapat muncul pada layer laporan warga di peta publik.
8. Pengguna dapat memeriksa status melalui `/status` menggunakan kode laporan.

Laporan yang ditolak tidak ditampilkan pada peta publik. Laporan dengan koordinat di luar batas Kota Bengkulu tidak dapat dijadikan titik rawan baru.

## Automated Tests

Jalankan seluruh pengujian dengan:

```bash
php artisan test
```

Alternatif melalui skrip Composer:

```bash
composer test
```

Pengujian menggunakan database terpisah bernama `coastalert_test`. Berkas `tests/bootstrap.php` membuat database uji tersebut sebelum pengujian dan menghapusnya setelah pengujian selesai. Karena itu, akun MySQL yang digunakan harus memiliki izin untuk membuat dan menghapus database.

Database utama `coastalert` tidak digunakan oleh pengujian. Bootstrap pengujian menolak nama database yang tidak berakhiran `_test` atau yang menunjuk ke database `coastalert`.

Cakupan pengujian mencakup halaman publik, autentikasi administrator, API titik rawan, API laporan, statistik, impor GeoJSON/CSV, layanan chat, validasi utilitas, layanan foto, dan pemeriksaan wilayah.

## Catatan Keamanan

- Jangan menyimpan berkas `.env` di repositori.
- Gunakan password administrator yang kuat dan pertimbangkan `ADMIN_PASSWORD_HASH` pada lingkungan produksi.
- Atur `APP_DEBUG=false` pada lingkungan produksi.
- Gunakan HTTPS untuk melindungi sesi administrator dan data laporan.
- Batasi akses panel administrator sesuai kebutuhan operasional.
- Jangan menghapus atau mengubah data titik rawan serta data GEA tanpa prosedur verifikasi.

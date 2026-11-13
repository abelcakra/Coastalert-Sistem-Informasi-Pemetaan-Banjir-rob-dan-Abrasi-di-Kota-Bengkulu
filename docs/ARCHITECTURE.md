# Dokumentasi Arsitektur Perangkat Lunak — CoastAlert

Dokumen ini menjelaskan arsitektur perangkat lunak, pola desain, alur data, dan keputusan teknis implementasi sistem informasi geografis **CoastAlert** berbasis framework Laravel.

---

## 1. Ikhtisar Arsitektur Sistem

CoastAlert dibangun dengan arsitektur **Model-View-Controller (MVC)** yang diperkaya dengan **Service Layer Pattern** pada platform Laravel.

```
+-----------------------------------------------------------------------+
|                            LAPISAN KLIEN                              |
|   +------------------------+             +------------------------+   |
|   |     Portal Publik      |             |     Panel Admin        |   |
|   | (Peta, Dashboard, DLL) |             | (CRUD Titik, Verif)    |   |
|   +-----------+------------+             +-----------+------------+   |
|               | (HTTP / Fetch / Blade)               | (Token Auth)   |
+---------------+--------------------------------------+----------------+
                |                                      |
                v                                      v
+-----------------------------------------------------------------------+
|                           ROUTING & MIDDLEWARE                        |
|   +-----------------------+              +------------------------+   |
|   |  routes/web.php       |              |  routes/api.php        |   |
|   |  - Named Routes       |              |  - Throttling          |   |
|   |  - Clean URLs         |              |  - AdminTokenMiddleware|   |
|   +-----------------------+              |  - NoStoreMiddleware   |   |
|                                          +------------------------+   |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                           CONTROLLER LAYER                            |
|   +------------------------+             +------------------------+   |
|   |    PageController      |             |   Api\*Controllers     |   |
|   |  (Render Blade Views)  |             | (JSON REST Endpoints)  |   |
|   +------------------------+             +-----------+------------+   |
+------------------------------------------------------|----------------+
                                                       v
+-----------------------------------------------------------------------+
|                            SERVICE LAYER                              |
|   +-----------------------+ +--------------------+ +----------------+ |
|   |   AdminAuthService    | |    ChatService     | |  ImportService | |
|   |  - Token Management   | |  - Local Ollama LLM| |  - GeoJSON/CSV | |
|   |  - hash_equals verify | |  - Fallback logic  | |  - Validation  | |
|   +-----------------------+ +--------------------+ +----------------+ |
+------------------------------------------------------|----------------+
                                                       v
+-----------------------------------------------------------------------+
|                      DATA ACCESS LAYER (ELOQUENT ORM)                 |
|   +-----------------------+ +--------------------+ +----------------+ |
|   |      Spot Model       | |    Report Model    | |AdminToken Model| |
|   |     (57 Titik)        | |  (Laporan Warga)   | | (Sesi Aktif)   | |
|   +-----------------------+ +--------------------+ +----------------+ |
+------------------------------------------------------|----------------+
                                                       v
+-----------------------------------------------------------------------+
|                         DATABASE & PERSISTENSI                        |
|   - MySQL / MariaDB (Tabel: spots, reports, admin_tokens, dll)        |
|   - File Storage: public/uploads/, public/img/gea/, storage/app/gea/  |
+-----------------------------------------------------------------------+
```

---

## 2. Struktur Modul & Tanggung Jawab Komponen

### A. Routing & Middleware
1. **Clean Web Routing (`routes/web.php`):**
   - Menggunakan URI semantik tanpa ekstensi file.
   - Mengelompokkan seluruh kebutuhan admin di bawah grup `Route::prefix('admin')->name('admin.')->group(...)`.
   - Menggunakan named routes konsisten (`home`, `peta`, `dashboard`, `laporan`, `status`, dan `admin.*`).
2. **RESTful API Routing (`routes/api.php`):**
   - Dilindungi middleware `api.nostore` untuk mencegah cache peramban terhadap respon JSON sensitif atau dinamis.
   - Dilindungi `throttle.legacy` untuk mitigasi serangan brute-force (login admin, kirim laporan, dan chat AI).
   - Membatasi akses mutasi data melalui `admin.token` (`AdminTokenMiddleware`).

### B. Controller & Service Layer
- **`PageController`:** Mengendalikan penyajian tampilan Blade publik dan admin. Menangani delegasi rute admin secara terstruktur.
- **`AdminAuthController` & `AdminAuthService`:** Menangani siklus autentikasi admin, penerbitan token acak berbasis kriptografi aman (`bin2hex(random_bytes(32))`), verifikasi kata sandi dengan perbandingan waktu-konstan (`hash_equals`), serta pembersihan token kedaluwarsa.
- **`SpotController`:** Menangani pembacaan katalog 57 titik rawan serta operasi penambahan, perubahan, dan penghapusan titik lokasi oleh admin.
- **`ReportController`:** Mengatur validasi kiriman laporan masyarakat, penyimpanan berkas gambar dengan penamaan aman dan acak, pencarian laporan berdasarkan kode unik, serta alur verifikasi status laporan.
- **`ChatController` & `ChatService`:** Mengelola integrasi dengan server inference Ollama lokal. Menyediakan respon instruksi kontekstual kebencanaan pesisir dengan mekanisme fallback otomatis jika Ollama tidak tersedia.
- **`ImportController`:** Mengimpor kumpulan data titik rawan massal dari dokumen GeoJSON atau CSV dengan validasi skema koordinat dan kolom.

---

## 3. Desain Antarmuka Pengguna & Frontend

Antarmuka CoastAlert mengadopsi pendekatan modular berbasis Vanilla ES6 JavaScript dan Blade template:
1. **Layout Bersama:**
   - `resources/views/layouts/app.blade.php`: Kerangka master publik yang mencakup navigasi semantik, sprite ikon SVG bersama, serta widget asisten informasi HARA.
   - `resources/views/layouts/admin.blade.php`: Kerangka master administrasi yang dihubungkan dengan modul `admin-common.js` untuk rendering bilah navigasi dan identitas dinamis.
2. **Pemetaan Geospasial (Leaflet.js):**
   - Rendering layer marker kustom berbasis SVG sprite (`#ikon-rob`, `#ikon-abrasi`, `#ikon-laporan`).
   - Layer switcher untuk peta jalan (OpenStreetMap), citra satelit (ESRI World Imagery), dan overlay raster GEA.
   - Filtering real-time tanpa memicu reload halaman.
3. **Animasi Transisi Halaman (`public/js/transisi.js`):**
   - Transisi visual halus antarhalaman publik tanpa beban framework SPA berat.
   - Dilengkapi deteksi selektif untuk mengabaikan aset statis, dokumen unduhan, dan modifier click (`Ctrl+Click`, klik tengah).

---

## 4. Alur Data Penting (Key Data Flows)

### A. Alur Pelaporan Kejadian oleh Masyarakat
1. Warga membuka halaman `/laporan`.
2. Memilih titik lokasi di peta interaktif Leaflet untuk menetapkan koordinat Latitude dan Longitude secara presisi.
3. Mengisi nama pelapor, kontak, jenis ancaman (rob/abrasi), alamat, deskripsi kejadian, dan melampirkan foto bukti.
4. Permintaan dikirim via `POST /api/reports` dengan payload `multipart/form-data`.
5. Backend memvalidasi berkas foto (tipe MIME: jpeg, png, jpg, webp; maks 5MB) dan menyimpan foto ke direktori aman publik.
6. Backend menghasilkan kode pelacakan acak unik dengan prefiks `CL-` diikuti enam digit (contoh: `CL-123456`).
7. Data disimpan dengan status awal `pending`.
8. Warga menerima kode unik untuk melacak proses verifikasi di halaman `/status`.

### B. Alur Verifikasi Laporan oleh Admin
1. Admin masuk melalui `/admin/login` dan memperoleh token sesi.
2. Membuka halaman `/admin/verifikasi`.
3. Mengakses tab *Menunggu Verifikasi* (`pending`).
4. Memeriksa kesesuaian koordinat, foto dokumentasi, dan keterangan kejadian.
5. Memilih aksi:
   - **Verifikasi (`diverifikasi`):** Laporan disetujui, dapat diberi catatan tindakan petugas, dan tampil pada layer peta publik (`/peta`).
   - **Tolak (`ditolak`):** Laporan ditolak dengan menyertakan catatan penolakan. Catatan tersebut disimpan untuk pengelolaan administrator; halaman `/status` menampilkan status laporan.

---

## 5. Keputusan Desain (Architectural Decisions)

| Keputusan | Alternatif yang Dipertimbangkan | Alasan Pemilihan |
|---|---|---|
| **Clean URLs & Named Routes** | URL statis dengan ekstensi `.html` | Mengikuti konvensi RESTful Laravel dan standar web modern tanpa ekstensi file pada URL publik maupun admin. |
| **Token-based DB Auth** | Laravel Sanctum / JWT | Menjaga keselarasan dengan arsitektur REST klien lama yang ringan, independen dari konfigurasi sesi cookie lintas domain, dan mudah dikelola tanpa tabel vendor berlebih. |
| **Vanilla JS + Blade** | Vue.js / React SPA | Mempertahankan kecepatan pemuatan halaman tinggi, struktur aset asli yang stabil, kemudahan pemeliharaan bagi tim, dan performa tinggi pada perangkat seluler di lapangan. |
| **Local LLM via Ollama** | OpenAI API Cloud | Menjamin privasi data, meniadakan biaya konsumsi token berbayar per panggilan, serta dapat beroperasi di lingkungan intranet instansi daerah. |


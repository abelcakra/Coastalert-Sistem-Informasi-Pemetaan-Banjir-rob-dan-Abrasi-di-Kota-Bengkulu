# Dokumentasi Database & Skema Data — CoastAlert

Dokumen ini mendokumentasikan skema database MySQL/MariaDB, kamus data lengkap, indeks, konvensi penamaan, dan penjelasan integritas data 57 titik rawan pesisir Kota Bengkulu.

---

## 1. Ikhtisar Skema Database

Sistem CoastAlert menggunakan database relasional dengan engine InnoDB dan karakter set `utf8mb4_unicode_ci`.

Terdapat 3 tabel inti yang mengelola data operasional sistem:
1. `spots`: Menyimpan katalog inventarisasi titik rawan banjir rob dan abrasi di pesisir Kota Bengkulu.
2. `reports`: Menyimpan laporan kejadian yang dikirim oleh masyarakat melalui formulir publik.
3. `admin_tokens`: Menyimpan hash token sesi autentikasi panel administrasi untuk verifikasi stateless yang aman.

```
+------------------------------------+
|               spots                |
+------------------------------------+
| PK  id             VARCHAR(40)     |
| U   seq            BIGINT UNSIGNED |
|     nama           VARCHAR(150)    |
|     kecamatan      VARCHAR(100)    |
|     jenis          ENUM(rob/abrasi)|
|     kategori       ENUM(R/S/T)     |
|     statusKoordinatENUM(...)       |
|     lat            DOUBLE          |
|     lng            DOUBLE          |
|     tinggiRob      DOUBLE          |
|     lajuAbrasi     DOUBLE          |
|     luasTerdampakHaDOUBLE          |
|     kkTerdampak    INT             |
|     tahun          INT             |
|     sumber         VARCHAR(200)    |
+------------------------------------+

+------------------------------------+
|              reports               |
+------------------------------------+
| PK  id             VARCHAR(40)     |
| U   seq            BIGINT UNSIGNED |
| U   kode           VARCHAR(20)     |
|     jenis          ENUM(rob/abrasi)|
|     namaPelapor    VARCHAR(150)    |
|     kontak         VARCHAR(100)    |
|     alamat         VARCHAR(255)    |
|     kecamatan      VARCHAR(100)    |
|     lat            DOUBLE          |
|     lng            DOUBLE          |
|     foto           VARCHAR(255)    |
|     status         ENUM(...)       |
|     catatanAdmin   TEXT            |
+------------------------------------+

+------------------------------------+
|            admin_tokens            |
+------------------------------------+
| PK  id             BIGINT UNSIGNED |
| U   token_hash     CHAR(64)        |
|     expires_at     DATETIME        |
|     created_at     DATETIME        |
+------------------------------------+
```

---

## 2. Kamus Data (Data Dictionary)

### A. Tabel `spots` (Katalog Titik Rawan)
Tabel ini merepresentasikan data spasial titik kerawanan di wilayah pesisir Kota Bengkulu.

| Kolom | Tipe Data | Nullable | Nilai Bawaan | Deskripsi |
|---|---|---|---|---|
| `id` | `VARCHAR(40)` | NO | — | Kunci primer berupa pengenal unik (UUID/slug unik). |
| `seq` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | Urutan numerik unik data. |
| `nama` | `VARCHAR(150)` | NO | — | Nama lokasi atau penanda kawasan rawan (misal: "Kelurahan Malabero"). |
| `kecamatan` | `VARCHAR(100)` | NO | `''` | Nama kecamatan administratif di Kota Bengkulu. |
| `jenis` | `ENUM('rob','abrasi')` | NO | — | Jenis ancaman utama kebencanaan pesisir. |
| `jenisAncaman` | `VARCHAR(100)` | NO | `''` | Keterangan tambahan jenis ancaman (misal: "Abrasi dan Gelombang Ekstrim"). |
| `kategori` | `ENUM('Rendah','Sedang','Tinggi')` | YES | `NULL` | Tingkat kerawanan bencana berdasarkan kajian teknis. |
| `statusKoordinat` | `ENUM('perkiraan','referensi_lokasi','terverifikasi')` | NO | `'perkiraan'` | Tingkat akurasi titik koordinat GPS. |
| `lat` | `DOUBLE` | NO | — | Titik koordinat Latitude (Garis Lintang WGS84). |
| `lng` | `DOUBLE` | NO | — | Titik koordinat Longitude (Garis Bujur WGS84). |
| `tinggiRob` | `DOUBLE` | YES | `NULL` | Estimasi tinggi genangan banjir rob dalam satuan sentimeter (cm). |
| `lajuAbrasi` | `DOUBLE` | YES | `NULL` | Estimasi laju pengikisan pantai dalam satuan meter/tahun (m/thn). |
| `luasTerdampakHa`| `DOUBLE` | YES | `NULL` | Estimasi luas area terdampak dalam satuan hektar (ha). |
| `kkTerdampak` | `INT` | YES | `NULL` | Estimasi jumlah Kepala Keluarga (KK) yang rentan terdampak. |
| `tahun` | `INT` | YES | `NULL` | Tahun kejadian atau tahun pendataan data titik. |
| `tanggal` | `VARCHAR(40)` | YES | `NULL` | Tanggal catatan pendataan. |
| `deskripsi` | `TEXT` | YES | `NULL` | Narasi penjelasan dampak, kondisi fisik, atau riwayat di lokasi. |
| `sumber` | `VARCHAR(200)` | YES | `''` | Instansi atau dokumen sumber rujukan data (misal: BPBD, Bappeda). |
| `terverifikasi` | `TINYINT(1)` | NO | `0` | Flag penanda status verifikasi data (`1` = terverifikasi, `0` = belum). |
| `createdAt` | `DATETIME` | YES | `NULL` | Waktu pencatatan baris data dibuat. |
| `updatedAt` | `DATETIME` | YES | `NULL` | Waktu pencatatan baris data terakhir diubah. |

**Indeks:**
- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `seq` (`seq`)`
- `KEY `idx_spots_jenis` (`jenis`)`
- `KEY `idx_spots_kecamatan` (`kecamatan`)`

---

### B. Tabel `reports` (Laporan Kejadian Masyarakat)
Tabel ini menampung kiriman laporan masyarakat atas kejadian banjir rob atau abrasi di sekitarnya.

| Kolom | Tipe Data | Nullable | Nilai Bawaan | Deskripsi |
|---|---|---|---|---|
| `id` | `VARCHAR(40)` | NO | — | Kunci primer laporan (UUID unik). |
| `seq` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | Urutan numerik unik laporan. |
| `kode` | `VARCHAR(20)` | YES | `NULL` | Kode pelacakan unik warga (format: `CL-######`). |
| `jenis` | `ENUM('rob','abrasi')` | NO | `'rob'` | Jenis bencana yang dilaporkan oleh warga. |
| `namaPelapor` | `VARCHAR(150)` | NO | — | Nama lengkap warga yang mengirimkan laporan. |
| `kontak` | `VARCHAR(100)` | YES | `''` | Nomor telepon atau WhatsApp pelapor untuk verifikasi. |
| `alamat` | `VARCHAR(255)` | YES | `''` | Alamat lokasi kejadian secara tekstual. |
| `kecamatan` | `VARCHAR(100)` | YES | `''` | Kecamatan lokasi kejadian. |
| `lat` | `DOUBLE` | NO | — | Koordinat lintang lokasi kejadian dari pemilihan peta. |
| `lng` | `DOUBLE` | NO | — | Koordinat bujur lokasi kejadian dari pemilihan peta. |
| `deskripsi` | `TEXT` | YES | `NULL` | Kronologi atau penjelasan detail kondisi dari pelapor. |
| `tanggal` | `DATE` | YES | `NULL` | Tanggal terjadinya peristiwa yang dilaporkan. |
| `foto` | `VARCHAR(255)` | YES | `NULL` | Path relatif berkas foto dokumentasi (`/uploads/laporan_...`). |
| `status` | `ENUM('pending','diverifikasi','ditolak')` | NO | `'pending'` | Status proses verifikasi laporan oleh petugas admin. |
| `catatanAdmin` | `TEXT` | YES | `NULL` | Catatan tindak lanjut petugas atau alasan apabila laporan ditolak. |
| `createdAt` | `DATETIME` | YES | `NULL` | Waktu pengiriman laporan. |
| `updatedAt` | `DATETIME` | YES | `NULL` | Waktu verifikasi atau perubahan status laporan. |

**Indeks:**
- `PRIMARY KEY (`id`)`
- `UNIQUE KEY `seq` (`seq`)`
- `UNIQUE KEY `kode` (`kode`)`
- `KEY `idx_reports_status` (`status`)`

---

### C. Tabel `admin_tokens` (Sesi Autentikasi Admin)
Tabel ini menyimpan hash token autentikasi admin untuk validasi akses endpoint terproteksi.

| Kolom | Tipe Data | Nullable | Nilai Bawaan | Deskripsi |
|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | NO | AUTO_INCREMENT | Kunci primer identitas token. |
| `token_hash` | `CHAR(64)` | NO | — | Hash SHA-256 dari token acak bearer yang dipegang klien. |
| `expires_at` | `DATETIME` | NO | — | Batas waktu kedaluwarsa sesi token. |
| `created_at` | `DATETIME` | YES | `NULL` | Waktu penerbitan token sesi. |

**Indeks:**
- `PRIMARY KEY (`id`)`
- `UNIQUE KEY (`token_hash`)`
- `KEY (`expires_at`)`

---

## 3. Integritas Data 57 Titik Rawan Pesisir

Database operasional `coastalert` menyimpan **57 titik rawan** yang merupakan data observasi dan inventarisasi resmi di sepanjang garis pantai Kota Bengkulu:

### Sebaran Titik per Kecamatan:

Berdasarkan data operasional saat ini:

| Kecamatan | Jumlah titik |
|---|---:|
| Kampung Melayu | 27 |
| Ratu Agung | 7 |
| Ratu Samban | 6 |
| Sungai Serut | 7 |
| Teluk Segara | 10 |
| **Total** | **57** |

> [!IMPORTANT]
> **Prosedur Pemeliharaan Data:**
> - Seluruh pengujian otomatis dan operasi pengujian TIDAK BOLEH memodifikasi atau menghapus data 57 titik rawan ini.
> - Database pengujian sementara (`coastalert_test`) dibuat dan dihapus otomatis melalui `tests/bootstrap.php`, sehingga database operasional `coastalert` tetap terjaga integritasnya.


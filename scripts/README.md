# Panduan Script CoastAlert

Folder ini berisi script operasional dan pemeliharaan. **Script di sini bukan
bagian dari runtime aplikasi.** Sebagian script dapat mengubah database atau
berkas data aktif, sehingga tidak boleh dijalankan terhadap data produksi tanpa
backup, persetujuan eksplisit, dan pemahaman dampaknya.

## Ringkasan risiko

| Script | Fungsi | Menyentuh database? | Risiko | Mode aman |
|---|---|---|---|---|
| `setup-db.mjs` | Membuat database/tabel dan migrasi data JSON | **Ya** (DDL + tulis) | **Tinggi** | Tanpa `--force`; `--force` wajib `--yes` |
| `import-dataset.mjs` | Validasi dan impor `data/spots.json` + `data/reports.json` | **Ya** (upsert/replace) | **Tinggi** | `--dry-run` |
| `convert-titik-rawan.mjs` | Mengubah CSV titik rawan menjadi `data/spots.json` | Tidak | **Sedang** | Tanpa `--write` (pratinjau) |
| `audit-batas-kota.mjs` | Audit titik terhadap batas Kota Bengkulu | **Baca saja** | **Rendah** | Mode bawaan; hanya menulis laporan audit ke `backup/` |
| `hapus-arsip-luar-batas.mjs` | Menghapus titik arsip di luar batas kota | **Ya** (hapus) | **Tinggi** | Pratinjau bawaan tanpa `--execute` |
| `migrasi-kode.mjs` | Menambah kolom `kode` dan mengisi kode laporan lama | **Ya** (DDL + tulis) | **Tinggi** | Tidak ada mode pratinjau; jalankan sekali setelah backup |
| `uji-api.mjs` | Uji alur API dan CRUD | **Ya** (buat/hapus data uji) | **Sedang–Tinggi** | Hanya terhadap server/database uji |
| `process_gea.py` | Mengolah raster InaRISK GEA menjadi aset peta | Tidak | **Sedang** | Jalankan offline; backup aset lama lebih dulu |

> **Aturan penting:** jangan arahkan `DB_NAME` ke database produksi saat
> menjalankan tes, impor, atau script yang menghapus data. Gunakan database uji
> dengan nama yang mengandung `_test` bila memungkinkan.

---

## Script database dan impor

### `setup-db.mjs` — risiko tinggi

Membuat database MySQL, tabel `spots` dan `reports`, lalu memindahkan data dari
`data/spots.json` dan `data/reports.json` bila tabel masih kosong.

```bash
npm run db:setup
```

Mode `--force` menghapus tabel lama dan membuat ulang tabel. Mode ini destruktif
dan wajib disertai `--yes`:

```bash
npm run db:setup -- --force --yes
```

Jika database berisi laporan tetapi `data/reports.json` kosong, `--force`
dibatalkan. Jangan memakai `--discard-reports` kecuali laporan sudah diekspor
dan penghapusannya disetujui secara sadar.

**Jangan dijalankan terhadap database produksi tanpa backup dan persetujuan.**

### `import-dataset.mjs` — risiko tinggi

Memvalidasi dan mengimpor data dari `data/spots.json` + `data/reports.json`.
Mode bawaan menambah/mengubah baris berdasarkan `id` tanpa menghapus baris lain.

```bash
npm run dataset:check                         # validasi tanpa menulis database
npm run dataset:import                        # upsert data aktif
```

Di PowerShell, arahkan ke database uji secara eksplisit:

```powershell
$env:DB_NAME="coastalert_phase1_test"; node scripts/import-dataset.mjs
```

Mode `--replace` mengganti baris aktif yang tidak ada di JSON. Baris arsip dan
laporan lama tetap dipertahankan, dan isi tabel lama disimpan ke folder
`backup/` sebelum penggantian:

```powershell
$env:DB_NAME="coastalert_phase1_test"; node scripts/import-dataset.mjs --replace --yes
```

`--replace` wajib memakai `--yes`. Database produksi memerlukan
`--allow-production` secara sadar. Jangan memakai opsi itu tanpa backup dan
persetujuan.

### `migrasi-kode.mjs` — risiko tinggi, sekali pakai

Menambahkan kolom `kode` pada tabel `reports` (jika belum ada) dan mengisi kode
pelacakan untuk laporan lama. Script langsung mengubah skema dan data; tidak ada
mode pratinjau.

```bash
node scripts/migrasi-kode.mjs
```

Jalankan hanya pada database lama yang membutuhkan migrasi, setelah backup, dan
bukan sebagai bagian dari operasi rutin.

### `hapus-arsip-luar-batas.mjs` — risiko tinggi, sekali pakai

Script historis untuk menghapus **hanya** titik arsip di luar batas kota.
Mode bawaan adalah pratinjau dan tidak menghapus apa pun:

```bash
node --env-file-if-exists=.env scripts/hapus-arsip-luar-batas.mjs
```

Eksekusi memerlukan `--execute --yes`. Pada database produksi juga memerlukan
`--allow-production` dan folder backup terverifikasi:

```bash
node --env-file-if-exists=.env scripts/hapus-arsip-luar-batas.mjs \
  --execute --yes --allow-production \
  --backup backup/20261102-before-hapus-arsip-luar-batas
```

Script ini memverifikasi baseline dan checksum backup, menghapus baris dalam
transaksi, lalu mengosongkan JSON arsip setelah commit. **Jangan dijalankan ulang
tanpa memahami baseline dan isi backup.**

---

## Script audit dan konversi

### `audit-batas-kota.mjs` — risiko rendah

Membaca `data/*.json`, dataset, contoh data, dan database untuk memeriksa titik
di dalam/luar batas Kota Bengkulu. Script tidak mengubah tabel aktif; hasilnya
ditulis ke:

```text
backup/20261101-before-batas-kota/audit-sebelum.json
```

Jalankan:

```bash
npm run audit:batas
# atau, bila koneksi DB berasal dari .env:
node --env-file-if-exists=.env scripts/audit-batas-kota.mjs
```

Pastikan folder `backup/` dapat ditulis. Script ini membutuhkan akses baca ke
database sesuai konfigurasi `DB_*`.

### `convert-titik-rawan.mjs` — risiko sedang

Mengubah CSV titik rawan menjadi struktur `data/spots.json`. Tanpa `--write`,
script hanya menampilkan pratinjau:

```bash
node scripts/convert-titik-rawan.mjs --csv "path/titik_rawan.csv"
node scripts/convert-titik-rawan.mjs --csv "path/titik_rawan.csv" --write
node scripts/convert-titik-rawan.mjs --csv "path/titik_rawan.csv" --write \
  --arsip-out "data/arsip/spots-di-luar-batas.json"
```

Script tidak menyentuh database, tetapi `--write` dapat menimpa
`data/spots.json`. Backup data aktif sebelum memakai `--write`. Titik di luar
batas hanya ditulis ke arsip bila `--arsip-out` diberikan.

---

## Pengujian API

### `uji-api.mjs` — risiko sedang–tinggi

Uji manual alur API: laporan, verifikasi, CRUD titik, import GeoJSON/CSV, lalu
membersihkan data uji. Script membuat dan menghapus data, sehingga **hanya boleh
dijalankan terhadap server dan database uji**.

```bash
# jalankan server uji lebih dulu, lalu:
node --env-file-if-exists=.env scripts/uji-api.mjs
```

`ADMIN_PASSWORD` wajib tersedia secara eksplisit. `BASE_URL` dapat diarahkan ke
server uji, misalnya `http://127.0.0.1:3100`. Jangan menjalankan script ini
terhadap server produksi.

Untuk tes otomatis yang memakai database uji terpisah, gunakan:

```bash
npm test
```

---

## Pengolahan GEA

### `process_gea.py` — risiko sedang

Mengolah raster InaRISK BNPB GEA menjadi raster klasifikasi, statistik JSON,
visualisasi, dan overlay Leaflet. Script ini offline dan tidak menyentuh database,
tetapi dapat menimpa aset di `data/gea/` dan `public/img/gea/`.

Dependensi Python (offline, bukan dependensi runtime aplikasi):

```bash
python -m pip install numpy rasterio shapely pyproj geopandas matplotlib pillow
```

Contoh:

```powershell
python scripts/process_gea.py `
  --raster "C:\path\inarisk_gea_kota_bengkulu_clip_utm48s.tif" `
  --batas "C:\path\batas_kota_bengkulu.geojson"
```

Backup aset GEA lama sebelum menjalankan ulang. Script ini tidak boleh dianggap
sebagai proses rutin aplikasi web.

---

## Checklist sebelum menjalankan script berisiko

1. Pastikan target `DB_NAME` benar; gunakan database uji untuk percobaan.
2. Buat backup database dan data/aset terkait.
3. Jalankan mode pratinjau (`--dry-run`, tanpa `--write`, atau tanpa `--execute`)
   terlebih dahulu.
4. Baca output dan cocokkan jumlah data dengan baseline.
5. Dapatkan persetujuan eksplisit sebelum menyentuh produksi.
6. Setelah eksekusi, periksa jumlah titik, laporan, serta checksum data penting.

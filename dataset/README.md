# Format Dataset Kejadian Rob & Abrasi

Folder ini **hanya berisi format** untuk mengisi data kejadian dari dokumen BPBD dan jurnal
yang sudah diverifikasi. **Belum ada satu pun data kejadian atau koordinat di sini.**

File:

- `template-kejadian.csv` — header saja, belum ada baris data.

Catatan: `data/spots.json` dan `data/reports.json` yang dipakai aplikasi saat ini adalah
data contoh/demo, bukan dataset kejadian terverifikasi.

## Aturan pengisian

1. **Satu baris = satu kejadian** yang tercatat di sumber. Jangan menggabungkan beberapa
   kejadian berbeda menjadi satu baris.
2. **Sumber wajib jelas.** Isi `sumber` (judul dokumen/jurnal), `tahun`, dan `halaman` atau
   `url_sumber`. Baris tanpa sumber yang bisa ditelusuri jangan dimasukkan.
3. **Koordinat hanya diisi jika sumber menyebut lokasi spesifik** (nama pantai, kelurahan,
   jalan, bangunan, atau titik yang bisa diverifikasi). Koordinat harus diturunkan dari lokasi
   tersebut, bukan dari pusat kecamatan.
4. **Catatan tingkat kecamatan/kelurahan saja tetap disimpan, tetapi bukan marker.**
   Biarkan `lat` dan `lng` kosong, isi `koordinat_dari_sumber=tidak`, dan
   `tampil_di_peta=tidak`. Data ini tetap berguna untuk rekap, tetapi tidak akan muncul
   sebagai titik di peta.
5. **Jangan memakai titik tengah kecamatan** atau koordinat perkiraan sebagai koordinat
   kejadian.
6. **Pisahkan dari zona bahaya BNPB.** Zona bahaya gelombang ekstrem & abrasi dari InaRISK
   BNPB adalah layer raster (bukan kejadian). Jangan mencampur zona bahaya dengan tabel
   kejadian historis.
7. **Verifikasi.** Isi `status_verifikasi=terverifikasi` hanya jika sumber sudah dicek
   (misalnya dokumen BPBD dan/atau jurnal). Jika masih perlu dicek, gunakan `perlu_cek`.
8. **Jangan mengarang nilai.** Kolom yang tidak disebutkan sumbernya boleh dikosongkan.
   Kosong lebih baik daripada angka yang tidak berdasar.

## Kolom

| Kolom | Keterangan |
|---|---|
| `id_kejadian` | Kode unik untuk pelacakan, mis. `ROB-YYYY-001`. Boleh dikosongkan saat pengisian awal. |
| `jenis` | `rob` atau `abrasi`. |
| `nama_kejadian` | Nama/lokasi kejadian seperti di sumber. |
| `tanggal` | Format `YYYY-MM-DD`. Kosongkan jika sumber hanya menyebut bulan/tahun. |
| `tahun` | Tahun kejadian (4 digit). |
| `kecamatan` | Kecamatan di Kota Bengkulu. |
| `kelurahan` | Kelurahan, jika disebut sumber. |
| `lokasi_spesifik` | Nama pantai/titik/patokan yang disebut sumber. |
| `alamat` | Alamat/deskripsi lokasi tambahan. |
| `lat` | Lintang (desimal). Hanya jika lokasi spesifik dan bisa diverifikasi. |
| `lng` | Bujur (desimal). Hanya jika lokasi spesifik dan bisa diverifikasi. |
| `kategori` | `Rendah`, `Sedang`, atau `Tinggi` jika sumber menyebutkan; jika tidak, kosongkan. |
| `tinggi_rob_cm` | Tinggi genangan rob dalam cm, jika ada. |
| `laju_abrasi_m_th` | Laju abrasi dalam m/tahun, jika ada. |
| `luas_terdampak_ha` | Luas terdampak dalam hektare, jika ada. |
| `kk_terdampak` | Jumlah KK terdampak, jika ada. |
| `korban_jiwa` | Jumlah korban jiwa, jika ada. |
| `sumber` | Judul dokumen BPBD/jurnal/laporan. |
| `jenis_sumber` | `dokumen_bpbd`, `jurnal`, `berita`, atau `laporan_lapangan`. |
| `url_sumber` | Tautan sumber, jika ada. |
| `halaman` | Halaman/gambar/tabel di sumber, jika ada. |
| `koordinat_dari_sumber` | `ya` hanya jika koordinat berasal dari lokasi spesifik di sumber; selain itu `tidak`. |
| `tampil_di_peta` | `ya` hanya jika baris boleh menjadi marker (koordinat terverifikasi). Selain itu `tidak`. |
| `tingkat_keyakinan` | `tinggi`, `sedang`, atau `rendah` sesuai kualitas sumber. |
| `status_verifikasi` | `terverifikasi` atau `perlu_cek`. |
| `catatan` | Catatan tambahan, termasuk alasan koordinat dikosongkan. |

## Hubungan dengan aplikasi

- File ini **belum diimpor** ke database dan belum dibaca oleh aplikasi.
- Import titik yang sudah ada (`contoh-data/`) mewajibkan `lat`/`lng`. Karena itu, baris
  tingkat kecamatan tanpa koordinat **tidak boleh** dipaksakan ke import tersebut.
- Integrasi berikutnya perlu memisahkan dua kelompok: kejadian bertitik (marker) dan
  kejadian tanpa titik (rekap/tabel), lalu menambahkan validator agar baris tanpa
  koordinat tidak menjadi marker.

# Arsip Batas Kota Bengkulu

Dipisahkan dari `data/spots.json` dan `data/reports.json` menggunakan uji point-in-polygon
terhadap `data/gea/sumber/batas_kota_bengkulu.geojson`.

Titik yang tepat di garis batas tetap dianggap berada di dalam kota.
Tidak ada koordinat yang diubah dan tidak ada data yang dihapus permanen.

- `spots-di-luar-batas.json`: titik rawan di luar batas kota; tidak dipakai sebagai data aktif.
- `reports-di-luar-batas.json`: laporan warga di luar batas kota; tetap disimpan sebagai arsip.
- `titik-perlu-pemeriksaan-manual.json`: koordinat kosong/tidak valid/tidak dapat diperiksa.

Jumlah saat ini: 0 titik luar, 0 laporan luar, 0 manual. File JSON dipertahankan
sebagai kanal arsip; data historis 16 titik sebelum pembersihan arsip tersimpan
di `backup/20261102-before-hapus-arsip-luar-batas/`.
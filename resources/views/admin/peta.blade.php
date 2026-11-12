@extends('layouts.admin')

@section('title', 'Peta Interaktif - Admin CoastAlert')
@section('body-class', 'db-body')

@section('styles')
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
@endsection

@section('content')
  <!-- ===== KONTEN UTAMA ===== -->
  <div class="db-wrapper">

    <!-- Page Header -->
    <div class="db-page-header">
      <div>
        <h1 class="db-page-title">Peta Interaktif</h1>
        <p class="db-page-sub">Sebaran data kejadian rob &amp; abrasi pesisir Kota Bengkulu</p>
      </div>
    </div>

    <!-- Kotak Khusus Peta & Filter -->
    <div class="db-card db-card-peta-kotak">
      <div class="admin-peta-layout">

        <!-- Panel Filter Samping -->
        <aside class="panel-peta-admin">
          <div class="kartu" style="box-shadow:none;padding:0">
            <h2>Filter Peta</h2>

            <div class="baris">
              <label for="filterJenis">Jenis bencana</label>
              <select id="filterJenis">
                <option value="">Semua kategori</option>
                <option value="rob">Banjir Rob</option>
                <option value="abrasi">Abrasi dan Gelombang Ekstrim</option>
              </select>
            </div>

            <div class="baris">
              <label for="filterKecamatan">Kecamatan</label>
              <select id="filterKecamatan">
                <option value="">Semua kecamatan</option>
              </select>
            </div>

            <div class="baris">
              <label>Tingkat kerawanan</label>
              <label class="cek"><input type="checkbox" class="filter-kategori" value="Rendah" checked /> <span class="dot dot-risiko-rendah"></span> Rendah</label>
              <label class="cek"><input type="checkbox" class="filter-kategori" value="Sedang" checked /> <span class="dot dot-risiko-sedang"></span> Sedang</label>
              <label class="cek"><input type="checkbox" class="filter-kategori" value="Tinggi" checked /> <span class="dot dot-risiko-tinggi"></span> Tinggi</label>
            </div>

            <div class="baris">
              <label for="cariTitik">Cari nama lokasi</label>
              <input type="text" id="cariTitik" placeholder="contoh: Penurunan, Jakat..." />
            </div>

            <button class="tombol sekunder penuh" id="resetFilter">Reset filter</button>
          </div>

          <div class="kartu" style="box-shadow:none;padding:0">
            <h3>Layer peta</h3>
            <label class="cek"><input type="checkbox" id="layerRob" checked /> <span class="legenda-penanda legenda-penanda-rob" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-rob"></use></svg></span> Banjir Rob</label>
            <label class="cek"><input type="checkbox" id="layerAbrasi" checked /> <span class="legenda-penanda legenda-penanda-abrasi" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-abrasi"></use></svg></span> Abrasi & Gelombang Ekstrim</label>
            <label class="cek"><input type="checkbox" id="layerLaporan" checked /> <span class="legenda-bentuk laporan" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-laporan"></use></svg></span> Laporan warga</label>
            <label class="cek"><input type="checkbox" id="layerGea" /> <span class="dot dot-gea"></span> Tampilkan Zona Bahaya</label>
          </div>

          <div class="kartu" style="box-shadow:none;padding:0">
            <h3>Zona Bahaya</h3>
            <div class="legenda-gradien" role="img" aria-label="Zona Bahaya: hijau rendah, kuning sedang, merah tinggi"></div>
            <div class="legenda-kelas">
              <div class="legenda-baris">
                <span class="legenda-bentuk legenda-gea-rendah" aria-hidden="true"></span>
                <span><strong>Rendah</strong><small>&le; 1/3</small></span>
              </div>
              <div class="legenda-baris">
                <span class="legenda-bentuk legenda-gea-sedang" aria-hidden="true"></span>
                <span><strong>Sedang</strong><small>&gt; 1/3 &ndash; &le; 2/3</small></span>
              </div>
              <div class="legenda-baris">
                <span class="legenda-bentuk legenda-gea-tinggi" aria-hidden="true"></span>
                <span><strong>Tinggi</strong><small>&gt; 2/3 &ndash; &le; 1</small></span>
              </div>
            </div>
          </div>

          <div class="kartu" style="box-shadow:none;padding:0">
            <h3>Daftar titik <span class="tag-kecil" id="jumlahTitik"></span></h3>
            <div id="daftarTitik"></div>
          </div>
        </aside>

        <!-- Wadah Peta (Kotak Khusus) -->
        <div class="peta-admin-wadah">
          <div id="petaAdmin" class="peta-admin"></div>
        </div>

      </div>
    </div>

  </div>
@endsection

@section('scripts')
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script type="module" src="{{ asset('admin/js/admin-peta.js?v=23') }}"></script>
@endsection

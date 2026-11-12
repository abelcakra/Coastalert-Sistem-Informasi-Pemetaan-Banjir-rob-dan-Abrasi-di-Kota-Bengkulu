@extends('layouts.app')

@section('title', 'Peta Interaktif - CoastAlert')
@section('description', 'Web GIS pemetaan banjir rob dan abrasi pesisir Kota Bengkulu')
@section('body-class', 'halaman-peta-publik')

@section('styles')
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="{{ asset('css/map-publik.css?v=18') }}" />
@endsection

@section('content')
  <!-- ===== AREA PETA FULLSCREEN ===== -->
  <div class="peta-fullscreen">

    <!-- TOMBOL BUKA SIDEBAR -->
    <button class="btn-sidebar-toggle" id="btnBukaSidebar" title="Buka filter & daftar lokasi" aria-label="Filter peta">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <span>Filter</span>
    </button>

    <!-- SIDEBAR FILTER -->
    <aside class="peta-sidebar" id="petaSidebar" aria-label="Panel filter">
      <!-- Header sidebar -->
      <div class="sidebar-header">
        <span class="sidebar-judul">Filter & Lokasi</span>
        <button class="sidebar-tutup" id="btnTutupSidebar" title="Tutup panel" aria-label="Tutup">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Cari lokasi -->
      <div class="sidebar-blok">
        <label class="sidebar-label" for="cariTitik">Cari lokasi</label>
        <div class="sidebar-input-ikon">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#627983" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ikon-input">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="text" id="cariTitik" placeholder="contoh: Malabero, Pantai Jakat…" />
        </div>
      </div>

      <!-- Filter jenis -->
      <div class="sidebar-blok">
        <label class="sidebar-label" for="filterJenis">Jenis ancaman</label>
        <select id="filterJenis">
          <option value="">Semua jenis</option>
          <option value="rob">Banjir Rob</option>
          <option value="abrasi">Abrasi dan Gelombang Ekstrim</option>
        </select>
      </div>

      <!-- Filter kecamatan -->
      <div class="sidebar-blok">
        <label class="sidebar-label" for="filterKecamatan">Kecamatan</label>
        <select id="filterKecamatan">
          <option value="">Semua kecamatan</option>
        </select>
      </div>

      <!-- Tingkat kerawanan -->
      <div class="sidebar-blok">
        <span class="sidebar-label">Tingkat kerawanan</span>
        <div class="sidebar-cek-grup">
          <label class="sidebar-cek"><input type="checkbox" class="filter-kategori" value="Rendah" checked /> <span class="dot dot-risiko-rendah"></span> Rendah</label>
          <label class="sidebar-cek"><input type="checkbox" class="filter-kategori" value="Sedang" checked /> <span class="dot dot-risiko-sedang"></span> Sedang</label>
          <label class="sidebar-cek"><input type="checkbox" class="filter-kategori" value="Tinggi" checked /> <span class="dot dot-risiko-tinggi"></span> Tinggi</label>
        </div>
      </div>

      <!-- Toggle layer -->
      <div class="sidebar-blok">
        <span class="sidebar-label">Layer peta</span>

        <div class="layer-grup">
          <span class="layer-subjudul">Data kejadian</span>
          <div class="sidebar-cek-grup">
            <label class="sidebar-cek"><input type="checkbox" id="layerRob" checked /> <span class="mini-penanda mini-penanda-rob" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-rob"></use></svg></span> Banjir Rob</label>
            <label class="sidebar-cek"><input type="checkbox" id="layerAbrasi" checked /> <span class="mini-penanda mini-penanda-abrasi" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-abrasi"></use></svg></span> Abrasi & Gelombang Ekstrim</label>
          </div>
        </div>

        <div class="layer-grup">
          <span class="layer-subjudul">Laporan warga</span>
          <label class="sidebar-cek"><input type="checkbox" id="layerLaporan" checked /> <span class="mini-penanda mini-penanda-laporan" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-laporan"></use></svg></span> Laporan warga</label>
        </div>

        <div class="layer-grup">
          <span class="layer-subjudul">Zona Bahaya</span>
          <label class="sidebar-cek"><input type="checkbox" id="layerGea" /> <span class="dot dot-gea"></span> Tampilkan Zona Bahaya</label>
        </div>
      </div>

      <!-- Tombol reset -->
      <button class="sidebar-reset" id="resetFilter">Reset semua filter</button>

      <!-- Divider -->
      <div class="sidebar-divider"></div>

      <!-- Daftar titik -->
      <div class="sidebar-blok sidebar-daftar">
        <span class="sidebar-label">Daftar lokasi <span id="jumlahTitik" class="sidebar-count"></span></span>
        <div id="daftarTitik" class="sidebar-list"></div>
      </div>
    </aside>

    <!-- OVERLAY gelap saat sidebar terbuka di mobile -->
    <div class="sidebar-overlay" id="sidebarOverlay"></div>

    <!-- PETA -->
    <div id="peta" class="peta-canvas"></div>

    <!-- LEGENDA KECIL di pojok kanan bawah peta -->
    <div class="peta-legenda" id="petaLegenda">
      <button class="legenda-toggle" id="btnLegenda" title="Tampilkan/sembunyikan legenda">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Legenda
      </button>
      <div class="legenda-isi" id="legendaIsi">
        <section class="legenda-grup">
          <p class="legenda-subjudul">Jenis ancaman</p>
          <div class="legenda-baris">
            <span class="legenda-penanda legenda-penanda-rob" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-rob"></use></svg></span>
            <span><strong>Banjir Rob</strong></span>
          </div>
          <div class="legenda-baris">
            <span class="legenda-penanda legenda-penanda-abrasi" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-abrasi"></use></svg></span>
            <span><strong>Abrasi & Gelombang Ekstrim</strong></span>
          </div>
        </section>

        <section class="legenda-grup">
          <p class="legenda-subjudul">Sumber data</p>
          <div class="legenda-baris">
            <span class="legenda-bentuk legenda-bentuk-kejadian" aria-hidden="true"></span>
            <span><strong>Data kejadian</strong></span>
          </div>
          <div class="legenda-baris">
            <span class="legenda-bentuk legenda-bentuk-laporan" aria-hidden="true"><svg viewBox="0 0 24 24"><use href="#ikon-laporan"></use></svg></span>
            <span><strong>Laporan warga</strong></span>
          </div>
        </section>

        <section class="legenda-grup">
          <p class="legenda-subjudul">Tingkat kerawanan</p>
          <div class="legenda-risiko">
            <span class="legenda-risiko-item"><span class="legenda-cincin legenda-cincin-rendah"></span>Rendah</span>
            <span class="legenda-risiko-item"><span class="legenda-cincin legenda-cincin-sedang"></span>Sedang</span>
            <span class="legenda-risiko-item"><span class="legenda-cincin legenda-cincin-tinggi"></span>Tinggi</span>
          </div>
        </section>

        <section class="legenda-grup">
          <p class="legenda-subjudul">Zona Bahaya</p>
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
        </section>
      </div>
    </div>

  </div><!-- /peta-fullscreen -->
@endsection

@section('scripts')
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <script type="module" src="{{ asset('js/map.js?v=28') }}"></script>
@endsection

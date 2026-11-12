@extends('layouts.admin')

@section('title', 'Dashboard - Admin CoastAlert')
@section('body-class', 'db-body')

@section('styles')
  <link rel="stylesheet" href="{{ asset('css/gea.css?v=2') }}" />
@endsection

@section('content')
  <!-- ===== KONTEN UTAMA ===== -->
  <div class="db-wrapper">

    <!-- Page header -->
    <div class="db-page-header">
      <div>
        <h1 class="db-page-title">Dashboard</h1>
        <p class="db-page-sub">Sistem Informasi Geografis Pesisir Kota Bengkulu</p>
      </div>
    </div>

    <!-- ===== KARTU RINGKASAN ===== -->
    <div class="db-stat-grid" id="kartuRingkasan"></div>

    <!-- ===== STATISTIK ZONA BAHAYA ===== -->
    <div class="db-card" style="margin-bottom:1rem">
      <div class="db-card-header">
        <h2 class="db-card-title">Zona Bahaya</h2>
      </div>
      <div class="gea-grid" id="kartuGeaAdmin">
        <p class="gea-kosong">Memuat statistik Zona Bahaya...</p>
      </div>
    </div>

    <!-- ===== BARIS GRAFIK UTAMA ===== -->
    <div class="db-chart-row">

      <!-- Sebaran Kategori Bencana -->
      <div class="db-card db-card-donut">
        <div class="db-card-header">
          <h2 class="db-card-title">Sebaran Jenis Catatan</h2>
          <p class="db-card-sub">Jumlah catatan sumber berdasarkan jenis potensi bencana</p>
        </div>
        <div class="db-donut-body">
          <div class="db-donut-wrap">
            <canvas id="grafikKategori"></canvas>
            <div class="db-donut-center" id="donutCenter">
              <span class="db-donut-pct" id="donutPct">—</span>
              <span class="db-donut-label" id="donutLabel">—</span>
            </div>
          </div>
          <div class="db-donut-legend" id="donutLegend"></div>
        </div>
      </div>

      <!-- Tingkat Kerawanan Wilayah -->
      <div class="db-card db-card-risiko">
        <div class="db-card-header">
          <h2 class="db-card-title">Tingkat Kerawanan Wilayah</h2>
        </div>
        <div class="db-risiko-list" id="risikoList"></div>
      </div>

    </div>

    <!-- ===== BARIS GRAFIK LANJUTAN ===== -->
    <div class="db-chart-row">
      <div class="db-card">
        <div class="db-card-header">
          <h2 class="db-card-title">Catatan Sumber per Kecamatan</h2>
        </div>
        <div class="grafik-kotak sedang"><canvas id="grafikKecamatan"></canvas></div>
      </div>
      <div class="db-card">
        <div class="db-card-header">
          <h2 class="db-card-title">Tren Laporan per Bulan</h2>
        </div>
        <div class="grafik-kotak sedang"><canvas id="grafikTrenLaporan"></canvas></div>
      </div>
    </div>

    <!-- ===== TABEL LAPORAN TERVERIFIKASI ===== -->
    <div class="db-card">
      <div class="db-card-header db-card-header-flex">
        <div>
          <h2 class="db-card-title">Pelaporan yang Sudah Diverifikasi</h2>
        </div>
        <a class="tombol sekunder kecil" href="{{ route('admin.data-laporan') }}">Lihat semua →</a>
      </div>
      <div class="tabel-bungkus">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Pelapor</th>
              <th>Jenis</th>
              <th>Lokasi</th>
              <th>Deskripsi</th>
            </tr>
          </thead>
          <tbody id="tabelTerverifikasi">
            <tr><td colspan="5" class="kosong">Memuat data...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ===== TABEL LAPORAN TERBARU ===== -->
    <div class="db-card">
      <div class="db-card-header db-card-header-flex">
        <div>
          <h2 class="db-card-title">Laporan Terbaru Masuk</h2>
        </div>
        <a class="tombol sekunder kecil" href="{{ route('admin.verifikasi') }}">Buka verifikasi →</a>
      </div>
      <div class="tabel-bungkus">
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Pelapor</th>
              <th>Jenis</th>
              <th>Lokasi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="tabelTerbaru">
            <tr><td colspan="5" class="kosong">Memuat data...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

  </div><!-- /db-wrapper -->
@endsection

@section('scripts')
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script type="module" src="{{ asset('admin/js/admin-dashboard.js?v=12') }}"></script>
@endsection

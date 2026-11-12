@extends('layouts.app')

@section('title', 'Dashboard Statistik - CoastAlert')
@section('description', 'Statistik dan visualisasi data banjir rob dan abrasi di wilayah pesisir Kota Bengkulu.')

@section('styles')
  <link rel="stylesheet" href="{{ asset('css/map-publik.css?v=10') }}" />
  <link rel="stylesheet" href="{{ asset('css/gea.css?v=2') }}" />
@endsection

@section('content')
  <main class="halaman">
    <div class="halaman-header">
      <h1>Dashboard Statistik</h1>
      <p>Ringkasan kondisi banjir rob dan abrasi di pesisir Kota Bengkulu berdasarkan data titik rawan yang tersedia.</p>
    </div>

    <!-- Kartu ringkasan -->
    <section class="grid-4" id="kartuRingkasan" style="margin-bottom:1.5rem"></section>

    <!-- Statistik Zona Bahaya -->
    <section class="kartu gea-panel">
      <h2>Zona Bahaya</h2>
      <div class="gea-grid" id="kartuGea">
        <p class="gea-kosong">Memuat statistik Zona Bahaya...</p>
      </div>
    </section>

    <!-- Grafik -->
    <section class="grid-2" style="margin-bottom:1.5rem">
      <div class="kartu">
        <h2>Jumlah titik per kecamatan</h2>
        <div class="grafik-kotak sedang"><canvas id="grafikKecamatan"></canvas></div>
      </div>
      <div class="kartu">
        <h2>Distribusi tingkat kerawanan</h2>
        <div class="grafik-kotak sedang"><canvas id="grafikKategori"></canvas></div>
      </div>
    </section>

    <!-- Tabel rekap -->
    <section class="kartu">
      <h2>Rekapitulasi per kecamatan</h2>
      <div class="tabel-bungkus">
        <table>
          <thead>
            <tr>
              <th>Kecamatan</th>
              <th>Titik Banjir Rob</th>
              <th>Titik Abrasi & Gelombang Ekstrim</th>
              <th>Total Titik</th>
            </tr>
          </thead>
          <tbody id="tabelKecamatan">
            <tr><td colspan="4" class="kosong">Memuat data...</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
@endsection

@section('footer')
  <footer>
    <p>&copy; {{ date('Y') }} CoastAlert — Sistem Informasi Geografis Pesisir Kota Bengkulu.</p>
  </footer>
@endsection

@section('scripts')
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script type="module" src="{{ asset('js/dashboard.js?v=10') }}"></script>
@endsection

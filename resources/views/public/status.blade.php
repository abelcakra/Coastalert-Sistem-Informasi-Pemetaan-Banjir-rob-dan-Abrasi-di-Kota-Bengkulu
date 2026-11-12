@extends('layouts.app')

@section('title', 'Status Laporan - CoastAlert')
@section('description', 'Lacak status laporan banjir rob dan abrasi yang Anda kirim melalui CoastAlert.')

@section('styles')
  <link rel="stylesheet" href="{{ asset('css/map-publik.css?v=10') }}" />
  <link rel="stylesheet" href="{{ asset('css/status.css?v=2') }}" />
@endsection

@section('content')
  <main class="halaman" style="max-width:900px">
    <div class="halaman-header">
      <h1>Status Laporan</h1>
      <p>Lihat laporan yang dikirim melalui browser ini.</p>
    </div>

    <!-- Pencarian kode laporan -->
    <form class="kartu status-cari" id="formCari" novalidate>
      <div class="baris">
        <label for="kodeLaporan">Cari Kode Laporan</label>
        <input
          type="text"
          id="kodeLaporan"
          name="kodeLaporan"
          placeholder="Contoh: CL-123456"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <button type="submit" class="tombol" id="tombolCari">Cari</button>
    </form>

    <!-- Riwayat laporan dari browser ini -->
    <h2 class="status-judul">Riwayat Laporan Anda</h2>
    <div class="kartu status-tabel">
      <div class="tabel-bungkus">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Lokasi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="tabelStatus">
            <tr><td colspan="5" class="kosong">Memuat data...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </main>
@endsection

@section('footer')
  <footer>
    <p>&copy; {{ date('Y') }} CoastAlert — Sistem Informasi Geografis Pesisir Kota Bengkulu.</p>
  </footer>
@endsection

@section('scripts')
  <script type="module" src="{{ asset('js/status.js') }}"></script>
@endsection

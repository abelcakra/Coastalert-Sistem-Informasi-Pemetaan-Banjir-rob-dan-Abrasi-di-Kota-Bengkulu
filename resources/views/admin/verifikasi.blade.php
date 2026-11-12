@extends('layouts.admin')

@section('title', 'Verifikasi Laporan - Admin CoastAlert')

@section('styles')
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
@endsection

@section('content')
  <div class="admin-tata">
    <div class="admin-utama">
      <main class="admin-isi">
        <!-- Pilihan tab -->
        <section class="tab-admin">
          <button class="tombol" id="tabMenunggu">Menunggu verifikasi <span id="jumlahMenunggu"></span></button>
          <button class="tombol sekunder" id="tabRiwayat">Riwayat diproses</button>
          <button class="tombol sekunder" id="muatUlang" style="margin-left:auto">Muat ulang</button>
        </section>

        <section id="wadahLaporan" class="grid-verifikasi">
          <p class="kosong">Memuat laporan...</p>
        </section>
      </main>
    </div>
  </div>
@endsection

@section('scripts')
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script type="module" src="{{ asset('admin/js/admin-verifikasi.js?v=7') }}"></script>
@endsection

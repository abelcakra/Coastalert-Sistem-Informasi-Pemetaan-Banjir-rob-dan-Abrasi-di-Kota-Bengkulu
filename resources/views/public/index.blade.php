@extends('layouts.app')

@section('title', 'CoastAlert - Pantau Pesisir Bengkulu')
@section('description', 'Sistem informasi geografis pemantauan banjir rob dan abrasi pesisir Kota Bengkulu.')
@section('body-class', 'landing-body')

@section('styles')
  <link rel="stylesheet" href="{{ asset('css/landing.css?v=9') }}" />
@endsection

@section('navbar')
  <!-- ===== NAVBAR ===== -->
  <header class="landing-nav">
    <a class="landing-brand" href="{{ route('home') }}">
      <img src="{{ asset('img/logo-coastalert.png') }}" alt="CoastAlert" class="landing-logo-img" />
    </a>
    <a class="landing-nav-admin" href="{{ route('admin.dashboard') }}">Panel Admin</a>
  </header>
@endsection

@section('content')
  <!-- ===== HERO dengan foto background ===== -->
  <main class="landing-main">

    <!-- Background foto Pantai Panjang -->
    <div class="landing-bg" role="img" aria-label="Pantai Panjang, Kota Bengkulu">
      <img src="{{ asset('img/pantai-panjang.jpg') }}" alt="Pantai Panjang, Kota Bengkulu" class="landing-bg-img" />
    </div>

    <!-- Overlay gelap agar teks terbaca -->
    <div class="landing-overlay"></div>

    <!-- Konten hero -->
    <div class="landing-hero">
      <div class="landing-badge">Kota Bengkulu</div>

      <h1 class="landing-judul">
        COAST<span class="landing-aksen">ALERT</span>
      </h1>

      <p class="landing-tagline">
        COASTALERT merupakan website pemetaan wilayah pesisir Kota Bengkulu yang membantu
        masyarakat melihat lokasi rawan banjir rob dan abrasi, mulai dari kawasan Pelabuhan
        Pulau Baai hingga Pantai Zakat.
      </p>

      <!-- 4 Kartu navigasi -->
      <div class="landing-kartu-grid">

        <a class="landing-kartu landing-kartu-peta" href="{{ route('peta') }}">
          <div class="landing-kartu-ikon biru">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/>
              <path d="M9 3v15"/><path d="M15 6v15"/>
            </svg>
          </div>
          <div class="landing-kartu-body">
            <h2>Peta Interaktif</h2>
            <p>Lihat sebaran titik rawan banjir rob dan abrasi di pesisir Bengkulu. Klik titiknya untuk melihat detail.</p>
          </div>
          <span class="landing-kartu-arrow">→</span>
        </a>

        <a class="landing-kartu" href="{{ route('dashboard') }}">
          <div class="landing-kartu-ikon hijau">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
          </div>
          <div class="landing-kartu-body">
            <h2>Statistik</h2>
            <p>Cek jumlah titik rawan, rata-rata tinggi rob, dan sebaran titik per kecamatan.</p>
          </div>
          <span class="landing-kartu-arrow">→</span>
        </a>

        <a class="landing-kartu landing-kartu-cta" href="{{ route('laporan') }}">
          <div class="landing-kartu-ikon biru">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="landing-kartu-body">
            <h2>Lapor Kejadian</h2>
            <p>Ada banjir rob atau abrasi di sekitar rumah? Laporkan di sini dengan foto dan titik lokasi.</p>
          </div>
          <span class="landing-kartu-arrow">→</span>
        </a>

        <a class="landing-kartu" href="{{ route('status') }}">
          <div class="landing-kartu-ikon status">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z"/>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
              <path d="m9 13 2 2 4-4"/>
            </svg>
          </div>
          <div class="landing-kartu-body">
            <h2>Status Laporan</h2>
            <p>Cek status laporan yang sudah dikirim lewat kode laporan atau riwayat di browser.</p>
          </div>
          <span class="landing-kartu-arrow">→</span>
        </a>

      </div>
    </div>
  </main>
@endsection

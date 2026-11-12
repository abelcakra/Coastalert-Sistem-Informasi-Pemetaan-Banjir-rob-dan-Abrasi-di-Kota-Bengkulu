<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="csrf-token" content="{{ csrf_token() }}">
  <title>@yield('title', 'CoastAlert - Pantau Pesisir Bengkulu')</title>
  <meta name="description" content="@yield('description', 'Sistem informasi geografis pemantauan banjir rob dan abrasi pesisir Kota Bengkulu.')" />
  <link rel="icon" type="image/png" href="{{ asset('img/logo-mark.png') }}" />
  <link rel="stylesheet" href="{{ asset('css/style.css?v=12') }}" />
  <link rel="stylesheet" href="{{ asset('css/chat.css?v=7') }}" />
  @yield('styles')
  @stack('styles')
</head>
<body class="@yield('body-class')">

  <!-- Ikon SVG bersama untuk marker, filter, dan legenda -->
  <svg class="svg-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <symbol id="ikon-rob" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9c2.2 0 2.2-2 4.5-2S9.8 9 12 9s2.2-2 4.5-2S18.8 9 21 9" />
        <path d="M3 15c2.2 0 2.2-2 4.5-2S9.8 15 12 15s2.2-2 4.5-2S18.8 15 21 15" />
      </g>
    </symbol>
    <symbol id="ikon-abrasi" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M7 3.5c3.2 3 3.2 5.2 1 8.2s-2.2 5.2 1 8.2" />
        <path d="M14 7.5c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4" />
        <path d="M14 12.5c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4" />
        <path d="M14 17.5c1.6 0 1.6-1.4 3.2-1.4s1.6 1.4 3.2 1.4" />
      </g>
    </symbol>
    <symbol id="ikon-laporan" viewBox="0 0 24 24">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 5.5h16v10H8l-4 3z" />
        <path d="M8 9h8M8 12h5" />
      </g>
    </symbol>
  </svg>

  @section('navbar')
  <!-- ===== NAVBAR ===== -->
  <header class="navbar">
    <a class="brand" href="{{ route('home') }}">
      <img src="{{ asset('img/logo-coastalert.png') }}" alt="CoastAlert" class="logo-img" />
    </a>
    <nav>
      <a href="{{ route('peta') }}" class="{{ request()->is('peta*') ? 'aktif' : '' }}">Peta</a>
      <a href="{{ route('dashboard') }}" class="{{ request()->is('dashboard*') ? 'aktif' : '' }}">Statistik</a>
      <a href="{{ route('status') }}" class="{{ request()->is('status*') ? 'aktif' : '' }}">Status Laporan</a>
      <a href="{{ route('laporan') }}" class="nav-cta {{ request()->is('laporan*') ? 'aktif' : '' }}">Lapor Kejadian</a>
    </nav>
  </header>
  @show

  @yield('content')

  @yield('footer')

  <!-- Widget Chatbot CS -->
  <script type="module" src="{{ asset('js/chat.js?v=6') }}"></script>
  @yield('scripts')
  @stack('scripts')
</body>
</html>


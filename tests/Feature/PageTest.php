<?php

namespace Tests\Feature;

use Tests\TestCase;

class PageTest extends TestCase
{
    public function test_semua_halaman_publik_dapat_diakses(): void
    {
        foreach ([
            '/',
            '/peta',
            '/dashboard',
            '/laporan',
            '/status',
        ] as $path) {
            $this->get($path)->assertOk();
        }
    }

    public function test_semua_halaman_admin_dapat_diakses(): void
    {
        foreach ([
            '/admin/login',
            '/admin/dashboard',
            '/admin/peta',
            '/admin/data-laporan',
            '/admin/verifikasi',
            '/admin/titik',
        ] as $path) {
            $this->get($path)->assertOk();
        }
    }

    public function test_route_bernama_mengarah_ke_url_yang_sesuai(): void
    {
        $this->assertSame(url('/'), route('home'));
        $this->assertSame(url('/peta'), route('peta'));
        $this->assertSame(url('/dashboard'), route('dashboard'));
        $this->assertSame(url('/laporan'), route('laporan'));
        $this->assertSame(url('/status'), route('status'));

        $this->assertSame(url('/admin'), route('admin.index'));
        $this->assertSame(url('/admin/login'), route('admin.login'));
        $this->assertSame(url('/admin/dashboard'), route('admin.dashboard'));
        $this->assertSame(url('/admin/peta'), route('admin.peta'));
        $this->assertSame(url('/admin/data-laporan'), route('admin.data-laporan'));
        $this->assertSame(url('/admin/verifikasi'), route('admin.verifikasi'));
        $this->assertSame(url('/admin/titik'), route('admin.titik'));
    }

    public function test_halaman_awal_admin_diarahkan_ke_dashboard_admin(): void
    {
        $this->get('/admin')->assertRedirect(route('admin.dashboard'));
        $this->get('/admin/')->assertRedirect(route('admin.dashboard'));
    }

    public function test_aset_dan_folder_upload_tersedia(): void
    {
        foreach ([
            public_path('css/style.css'),
            public_path('js/common.js'),
            public_path('js/map.js'),
            public_path('js/chat.js'),
            public_path('img/logo-coastalert.png'),
            public_path('admin/css/admin.css'),
            public_path('admin/js/admin-common.js'),
        ] as $path) {
            $this->assertFileExists($path);
        }

        $this->assertDirectoryExists(public_path('uploads'));
    }

    public function test_halaman_publik_menampilkan_tata_letak_dan_elemen_utama(): void
    {
        $response = $this->get('/');
        $response->assertSee('COAST');
        $response->assertSee('ALERT');
        $response->assertSee('Peta Interaktif');
        $response->assertSee('js/chat.js');

        $response = $this->get('/peta');
        $response->assertSee('peta-fullscreen');
        $response->assertSee('petaSidebar');
        $response->assertSee('petaLegenda');
        $response->assertSee('js/map.js');

        $response = $this->get('/dashboard');
        $response->assertSee('kartuRingkasan');
        $response->assertSee('kartuGea');
        $response->assertSee('grafikKecamatan');
        $response->assertSee('js/dashboard.js');

        $response = $this->get('/laporan');
        $response->assertSee('formLaporan');
        $response->assertSee('petaPilih');
        $response->assertSee('js/laporan.js');

        $response = $this->get('/status');
        $response->assertSee('formCari');
        $response->assertSee('tabelStatus');
        $response->assertSee('js/status.js');
    }

    public function test_halaman_admin_menampilkan_tata_letak_dan_elemen_utama(): void
    {
        $response = $this->get('/admin/login');
        $response->assertSee('formLogin');
        $response->assertSee('admin-common.js');

        $response = $this->get('/admin/dashboard');
        $response->assertSee('db-stat-grid');
        $response->assertSee('kartuRingkasan');
        $response->assertSee('admin-dashboard.js');

        $response = $this->get('/admin/titik');
        $response->assertSee('formTitik');
        $response->assertSee('petaAdmin');
        $response->assertSee('admin-titik.js');

        $response = $this->get('/admin/verifikasi');
        $response->assertSee('tabMenunggu');
        $response->assertSee('wadahLaporan');
        $response->assertSee('admin-verifikasi.js');

        $response = $this->get('/admin/data-laporan');
        $response->assertSee('tabelLaporan');
        $response->assertSee('modalDetail');
        $response->assertSee('admin-data-laporan.js');

        $response = $this->get('/admin/peta');
        $response->assertSee('petaAdmin');
        $response->assertSee('panel-peta-admin');
        $response->assertSee('admin-peta.js');
    }
}

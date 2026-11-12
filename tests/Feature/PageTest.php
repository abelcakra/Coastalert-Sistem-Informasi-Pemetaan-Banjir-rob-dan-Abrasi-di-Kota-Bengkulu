<?php

namespace Tests\Feature;

use Tests\TestCase;

class PageTest extends TestCase
{
    public function test_all_public_pages_are_available(): void
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

    public function test_all_admin_pages_are_available(): void
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

    public function test_named_routes_resolve_to_canonical_urls(): void
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

    public function test_admin_entry_redirects_to_admin_dashboard(): void
    {
        $this->get('/admin')->assertRedirect(route('admin.dashboard'));
        $this->get('/admin/')->assertRedirect(route('admin.dashboard'));
    }

    public function test_assets_and_upload_directory_are_present(): void
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

    public function test_public_pages_render_layout_and_key_elements(): void
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

    public function test_admin_pages_render_layout_and_key_elements(): void
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

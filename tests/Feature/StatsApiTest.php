<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesCoastAlertData;
use Tests\TestCase;

class StatsApiTest extends TestCase
{
    use MakesCoastAlertData;
    use RefreshDatabase;

    public function test_public_stats_aggregate_spots_without_private_report_fields(): void
    {
        $this->makeSpot([
            'id' => 'sp_rob_tinggi',
            'jenis' => 'rob',
            'kategori' => 'Tinggi',
            'statusKoordinat' => 'terverifikasi',
            'tinggiRob' => 60,
            'kkTerdampak' => 10,
            'luasTerdampakHa' => 2.5,
            'tahun' => 2024,
            'terverifikasi' => true,
        ]);
        $this->makeSpot([
            'id' => 'sp_abrasi_rendah',
            'jenis' => 'abrasi',
            'kategori' => 'Rendah',
            'statusKoordinat' => 'perkiraan',
            'tinggiRob' => null,
            'lajuAbrasi' => 1.5,
            'kkTerdampak' => 5,
            'luasTerdampakHa' => 1.5,
            'tahun' => 2024,
            'terverifikasi' => false,
        ]);
        $this->makeReport([
            'id' => 'rp_public',
            'status' => 'diverifikasi',
            'namaPelapor' => 'Nama Rahasia',
            'kontak' => '081200000000',
            'alamat' => 'Alamat Rahasia',
        ]);

        $stats = $this->getJson('/api/stats')->assertOk();

        $stats->assertJsonPath('ringkasan.totalTitik', 2)
            ->assertJsonPath('ringkasan.totalCatatan', 2)
            ->assertJsonPath('ringkasan.totalRob', 1)
            ->assertJsonPath('ringkasan.totalAbrasi', 1)
            ->assertJsonPath('ringkasan.totalKejadianTerverifikasi', 1)
            ->assertJsonPath('ringkasan.totalBelumVerifikasi', 1)
            ->assertJsonPath('ringkasan.totalLaporan', 1)
            ->assertJsonPath('ringkasan.laporanTerverifikasi', 1)
            ->assertJsonPath('ringkasan.totalKK', 15)
            ->assertJsonPath('ringkasan.totalLuasHa', 4)
            ->assertJsonPath('ringkasan.rataTinggiRob', 60)
            ->assertJsonPath('ringkasan.rataLajuAbrasi', 1.5)
            ->assertJsonPath('perKategori.Tinggi', 1)
            ->assertJsonPath('perKategori.Rendah', 1)
            ->assertJsonPath('perJenis.rob', 1)
            ->assertJsonPath('perJenis.abrasi', 1)
            ->assertJsonPath('sebaranKategori.rob.Tinggi', 1)
            ->assertJsonPath('sebaranKategori.abrasi.Rendah', 1)
            ->assertJsonPath('perStatusKoordinat.terverifikasi', 1)
            ->assertJsonPath('perStatusKoordinat.perkiraan', 1)
            ->assertJsonPath('perStatusVerifikasi.terverifikasi', 1)
            ->assertJsonPath('perStatusVerifikasi.belum_verifikasi', 1);

        $this->assertArrayNotHasKey('laporanDitolak', $stats->json('ringkasan'));
        $this->assertArrayNotHasKey('terbaru', $stats->json('laporan'));
        $this->assertArrayNotHasKey('menunggu', $stats->json('laporan'));
        $this->assertArrayNotHasKey('terverifikasi', $stats->json('laporan'));
    }

    public function test_admin_stats_include_rejected_counts_and_report_details(): void
    {
        $this->makeReport(['id' => 'rp_pending', 'status' => 'pending', 'createdAt' => now()->subMinutes(2)]);
        $this->makeReport(['id' => 'rp_verified', 'status' => 'diverifikasi', 'createdAt' => now()->subMinute()]);
        $this->makeReport(['id' => 'rp_rejected', 'status' => 'ditolak', 'createdAt' => now()]);

        $stats = $this->withHeaders($this->adminHeaders())->getJson('/api/stats/admin')->assertOk();

        $stats->assertJsonPath('ringkasan.totalLaporan', 3)
            ->assertJsonPath('ringkasan.laporanPending', 1)
            ->assertJsonPath('ringkasan.laporanTerverifikasi', 1)
            ->assertJsonPath('ringkasan.laporanDitolak', 1)
            ->assertJsonCount(1, 'laporan.terverifikasi')
            ->assertJsonCount(1, 'laporan.menunggu')
            ->assertJsonCount(3, 'laporan.terbaru')
            ->assertJsonPath('laporan.terbaru.0.id', 'rp_rejected');
    }

    public function test_meta_returns_legacy_filter_options(): void
    {
        $this->makeSpot([
            'id' => 'sp_meta_a',
            'kecamatan' => 'Sungai Serut',
            'tahun' => 2023,
            'jenisAncaman' => 'Banjir Rob',
        ]);
        $this->makeSpot([
            'id' => 'sp_meta_b',
            'kecamatan' => 'Teluk Segara',
            'tahun' => 2025,
            'jenisAncaman' => 'Abrasi',
            'jenis' => 'abrasi',
        ]);

        $this->getJson('/api/stats/meta')->assertOk()
            ->assertJsonPath('kecamatan', ['Sungai Serut', 'Teluk Segara'])
            ->assertJsonPath('tahun', [2023, 2025])
            ->assertJsonPath('jenis', ['rob', 'abrasi'])
            ->assertJsonPath('jenisAncaman', ['Abrasi', 'Banjir Rob'])
            ->assertJsonPath('kategori', ['Rendah', 'Sedang', 'Tinggi'])
            ->assertJsonPath('statusKoordinat', ['perkiraan', 'referensi_lokasi', 'terverifikasi'])
            ->assertJsonPath('statusVerifikasi', ['terverifikasi', 'perlu_verifikasi']);
    }

    public function test_gea_statistics_are_served_from_the_copied_source_file(): void
    {
        $stats = $this->getJson('/api/stats')->assertOk();
        $this->assertIsArray($stats->json('gea'));
        $this->assertNotEmpty($stats->json('gea'));
    }
}

<?php

namespace Tests\Feature;

use App\Models\Report;
use App\Models\Spot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\Concerns\MakesCoastAlertData;
use Tests\TestCase;

class ReportApiTest extends TestCase
{
    use MakesCoastAlertData;
    use RefreshDatabase;

    private string $uploadDir = '';

    protected function setUp(): void
    {
        parent::setUp();

        $this->uploadDir = storage_path('framework/testing/uploads-'.uniqid());
        config(['coastalert.upload_dir' => $this->uploadDir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->uploadDir);

        parent::tearDown();
    }

    /**
     * @return array<string, mixed>
     */
    private function validReport(array $overrides = []): array
    {
        return array_merge([
            'namaPelapor' => 'Warga Uji',
            'jenis' => 'rob',
            'deskripsi' => 'Air laut masuk ke permukiman.',
            'lat' => -3.772786,
            'lng' => 102.262581,
            'kontak' => '08123456789',
            'alamat' => 'Jalan Uji Nomor 1',
            'kecamatan' => 'Sungai Serut',
            'tanggal' => '2025-03-04',
        ], $overrides);
    }

    public function test_public_report_submission_tracking_and_verification_flow(): void
    {
        $created = $this->postJson('/api/reports', $this->validReport());

        $created->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('diarsipkan', false)
            ->assertJsonStructure(['data' => ['id', 'kode'], 'pesan']);

        $id = (string) $created->json('data.id');
        $kode = (string) $created->json('data.kode');
        $this->assertMatchesRegularExpression('/^CL-\d{6}$/', $kode);

        $this->getJson('/api/reports/publik')
            ->assertOk()
            ->assertJsonPath('jumlah', 0);

        $tracked = $this->getJson('/api/reports/lacak/'.$kode)->assertOk();
        $tracked->assertJsonPath('data.kode', $kode)
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.kecamatan', 'Sungai Serut');
        $this->assertArrayNotHasKey('alamat', $tracked->json('data'));
        $this->assertArrayNotHasKey('namaPelapor', $tracked->json('data'));
        $this->assertArrayNotHasKey('kontak', $tracked->json('data'));

        $this->getJson('/api/reports/lacak/'.substr($kode, 3))
            ->assertOk()
            ->assertJsonPath('data.kode', $kode);

        $admin = $this->withHeaders($this->adminHeaders())->getJson('/api/reports');
        $admin->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.status', 'pending');

        $verified = $this->withHeaders($this->adminHeaders())
            ->patchJson('/api/reports/'.$id, [
                'status' => 'diverifikasi',
                'catatanAdmin' => 'Sudah dicek petugas.',
                'jadikanTitik' => true,
            ]);

        $verified->assertOk()
            ->assertJsonPath('data.status', 'diverifikasi')
            ->assertJsonPath('spotDibuat', true)
            ->assertJsonPath('spot.id', 'lpr_'.$id);

        $spotId = (string) $verified->json('spot.id');
        $this->assertDatabaseHas('spots', ['id' => $spotId, 'jenis' => 'rob', 'terverifikasi' => 1]);

        $second = $this->withHeaders($this->adminHeaders())
            ->patchJson('/api/reports/'.$id, [
                'status' => 'diverifikasi',
                'jadikanTitik' => true,
            ]);

        $second->assertOk()
            ->assertJsonPath('spotDibuat', false)
            ->assertJsonPath('spot.id', $spotId)
            ->assertJsonPath('pesan', 'Laporan sudah memiliki titik; tidak ada titik baru yang dibuat.');

        $this->assertSame(1, Spot::query()->where('id', $spotId)->count());

        $this->getJson('/api/reports/publik')
            ->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', $id);

        $stats = $this->getJson('/api/stats')->assertOk();
        $stats->assertJsonPath('ringkasan.totalLaporan', 1)
            ->assertJsonPath('ringkasan.laporanTerverifikasi', 1)
            ->assertJsonPath('ringkasan.laporanPending', 0);
    }

    public function test_public_stats_and_report_list_exclude_rejected_reports(): void
    {
        $this->makeReport(['id' => 'rp_pending', 'status' => 'pending']);
        $this->makeReport(['id' => 'rp_verified', 'status' => 'diverifikasi']);
        $this->makeReport(['id' => 'rp_rejected', 'status' => 'ditolak']);

        $this->getJson('/api/reports/publik')
            ->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', 'rp_verified');

        $publicStats = $this->getJson('/api/stats')->assertOk();
        $publicStats->assertJsonPath('ringkasan.totalLaporan', 2)
            ->assertJsonPath('ringkasan.laporanPending', 1)
            ->assertJsonPath('ringkasan.laporanTerverifikasi', 1);
        $this->assertArrayNotHasKey('laporanDitolak', $publicStats->json('ringkasan'));
        $this->assertArrayNotHasKey('terverifikasi', $publicStats->json('laporan'));
        $this->assertArrayNotHasKey('menunggu', $publicStats->json('laporan'));

        $adminStats = $this->withHeaders($this->adminHeaders())->getJson('/api/stats/admin')->assertOk();
        $adminStats->assertJsonPath('ringkasan.totalLaporan', 3)
            ->assertJsonPath('ringkasan.laporanDitolak', 1);
        $adminStats->assertJsonCount(1, 'laporan.terverifikasi')
            ->assertJsonCount(1, 'laporan.menunggu')
            ->assertJsonCount(3, 'laporan.terbaru');
    }

    public function test_report_photo_is_validated_and_saved_only_for_valid_images(): void
    {
        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Z7sAAAAASUVORK5CYII=',
            true,
        );

        $valid = $this->post('/api/reports', $this->validReport([
            'foto' => UploadedFile::fake()->createWithContent('foto.png', (string) $png),
        ]), ['Accept' => 'application/json']);

        $valid->assertCreated();
        $foto = (string) $valid->json('data.foto');
        $this->assertMatchesRegularExpression('#^/uploads/laporan_[^/]+\.png$#', $foto);
        $this->assertFileExists($this->uploadDir.DIRECTORY_SEPARATOR.basename($foto));

        $this->post('/api/reports', $this->validReport([
            'foto' => UploadedFile::fake()->createWithContent('foto.png', 'bukan gambar'),
        ]), ['Accept' => 'application/json'])
            ->assertStatus(400)
            ->assertJsonPath('error', 'Isi berkas tidak sesuai dengan tipe gambar yang diunggah.');

        $this->assertCount(1, File::files($this->uploadDir));
    }

    public function test_outside_boundary_reports_are_archived_and_hidden_from_public_endpoints(): void
    {
        $created = $this->postJson('/api/reports', $this->validReport([
            'lat' => -6.2,
            'lng' => 106.8,
            'kecamatan' => 'Di luar kota',
        ]));

        $created->assertCreated()
            ->assertJsonPath('diarsipkan', true)
            ->assertJsonPath('data.statusLokasi', 'luar');
        $id = (string) $created->json('data.id');
        $kode = (string) $created->json('data.kode');

        $this->getJson('/api/reports/publik')->assertOk()->assertJsonPath('jumlah', 0);
        $this->getJson('/api/stats')->assertOk()->assertJsonPath('ringkasan.totalLaporan', 0);

        $this->withHeaders($this->adminHeaders())
            ->getJson('/api/reports')
            ->assertOk()
            ->assertJsonPath('jumlah', 0);

        $this->withHeaders($this->adminHeaders())
            ->getJson('/api/reports?arsip=1')
            ->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', $id);

        $this->getJson('/api/reports/lacak/'.$kode)
            ->assertOk()
            ->assertJsonPath('data.status', 'pending');

        $this->withHeaders($this->adminHeaders())
            ->patchJson('/api/reports/'.$id, ['status' => 'diverifikasi'])
            ->assertStatus(404);

        $this->withHeaders($this->adminHeaders())
            ->deleteJson('/api/reports/'.$id)
            ->assertStatus(404);
    }

    public function test_report_validation_and_tracking_error_envelopes(): void
    {
        $this->postJson('/api/reports', [])
            ->assertStatus(400)
            ->assertJsonStructure(['error']);

        $this->postJson('/api/reports', $this->validReport([
            'lat' => 10,
            'lng' => 200,
        ]))->assertStatus(400);

        $this->getJson('/api/reports/lacak/BAD')->assertStatus(400)
            ->assertJsonPath('error', 'Format kode laporan tidak valid. Contoh: CL-123456.');

        $this->getJson('/api/reports/lacak/CL-000000')->assertStatus(404)
            ->assertJsonPath('error', 'Kode laporan tidak ditemukan.');
    }

    public function test_admin_can_reject_and_delete_an_active_report(): void
    {
        $report = $this->makeReport(['id' => 'rp_delete']);
        $headers = $this->adminHeaders();

        $this->withHeaders($headers)->patchJson('/api/reports/rp_delete', [
            'status' => 'ditolak',
            'catatanAdmin' => 'Bukan kejadian rob.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'ditolak')
            ->assertJsonPath('data.catatanAdmin', 'Bukan kejadian rob.');

        $this->withHeaders($headers)->patchJson('/api/reports/rp_delete', [
            'status' => 'status-tidak-valid',
        ])->assertStatus(400)
            ->assertJsonPath('error', 'Status tidak valid.');

        $this->withHeaders($headers)->deleteJson('/api/reports/'.$report->id)
            ->assertOk()
            ->assertExactJson(['ok' => true]);

        $this->assertDatabaseMissing('reports', ['id' => 'rp_delete']);
    }

    public function test_verification_to_spot_requires_valid_inside_coordinates(): void
    {
        $this->makeReport([
            'id' => 'rp_outside',
            'lat' => -6.2,
            'lng' => 106.8,
        ]);

        $this->withHeaders($this->adminHeaders())
            ->patchJson('/api/reports/rp_outside', [
                'status' => 'diverifikasi',
                'jadikanTitik' => true,
            ])->assertStatus(404);
    }
}

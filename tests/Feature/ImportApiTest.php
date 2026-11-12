<?php

namespace Tests\Feature;

use App\Models\Spot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\Concerns\MakesCoastAlertData;
use Tests\TestCase;

class ImportApiTest extends TestCase
{
    use MakesCoastAlertData;
    use RefreshDatabase;

    /**
     * @return array<string, mixed>
     */
    private function feature(array $properties = [], float $lat = -3.772786, float $lng = 102.262581): array
    {
        return [
            'type' => 'Feature',
            'properties' => array_merge([
                'nama' => 'Titik Impor',
                'jenis' => 'rob',
                'kecamatan' => 'Sungai Serut',
                'kategori' => 'Sedang',
                'statusKoordinat' => 'perkiraan',
                'tahun' => 2025,
                'terverifikasi' => true,
            ], $properties),
            'geometry' => ['type' => 'Point', 'coordinates' => [$lng, $lat]],
        ];
    }

    public function test_import_requires_admin_token(): void
    {
        $this->postJson('/api/import/geojson', ['type' => 'FeatureCollection', 'features' => []])
            ->assertStatus(401);
        $this->postJson('/api/import/csv', ['csv' => "nama,jenis\nX,rob"])
            ->assertStatus(401);
    }

    public function test_dry_run_does_not_write_and_repeat_import_updates_the_same_row(): void
    {
        $body = [
            'type' => 'FeatureCollection',
            'features' => [$this->feature(['id' => 'sp_import_fixed'])],
        ];

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson?dryRun=1', $body)
            ->assertOk()
            ->assertJsonPath('berhasil', 1)
            ->assertJsonPath('diperbarui', 0)
            ->assertJsonPath('dryRun', true)
            ->assertJsonPath('gagal', 0);

        $this->assertDatabaseMissing('spots', ['id' => 'sp_import_fixed']);

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson', $body)
            ->assertOk()
            ->assertJsonPath('berhasil', 1)
            ->assertJsonPath('diperbarui', 0)
            ->assertJsonPath('dryRun', false);

        $this->assertDatabaseHas('spots', [
            'id' => 'sp_import_fixed',
            'nama' => 'Titik Impor',
            'kecamatan' => 'Sungai Serut',
            'jenis' => 'rob',
        ]);

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson', $body)
            ->assertOk()
            ->assertJsonPath('berhasil', 0)
            ->assertJsonPath('diperbarui', 1);

        $this->assertSame(1, Spot::query()->where('id', 'sp_import_fixed')->count());
    }

    public function test_invalid_features_are_reported_without_writing(): void
    {
        $body = [
            'type' => 'FeatureCollection',
            'features' => [
                ['type' => 'Feature', 'properties' => ['nama' => 'Tanpa Koordinat'], 'geometry' => null],
                [
                    'type' => 'Feature',
                    'properties' => ['nama' => 'Tanpa Jenis', 'lat' => -3.772786, 'lng' => 102.262581],
                    'geometry' => null,
                ],
            ],
        ];

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson', $body)
            ->assertOk()
            ->assertJsonPath('berhasil', 0)
            ->assertJsonPath('gagal', 2)
            ->assertJsonCount(2, 'errors');

        $this->assertSame(0, Spot::query()->count());
    }

    public function test_outside_boundary_import_is_archived_and_active_points_cannot_be_archived(): void
    {
        $outside = $this->feature(['id' => 'sp_outside'], -6.2, 106.8);

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson', [
                'type' => 'FeatureCollection',
                'features' => [$outside],
            ])
            ->assertOk()
            ->assertJsonPath('berhasil', 1)
            ->assertJsonPath('diarsipkan', 1);

        $this->getJson('/api/spots')->assertOk()->assertJsonPath('jumlah', 0);

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson', [
                'type' => 'FeatureCollection',
                'features' => [$this->feature(['id' => 'sp_outside'], -3.772786, 102.262581)],
            ])
            ->assertOk()
            ->assertJsonPath('berhasil', 0)
            ->assertJsonPath('diperbarui', 1)
            ->assertJsonPath('diarsipkan', 0);

        $this->getJson('/api/spots')->assertOk()->assertJsonPath('jumlah', 1);

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson', [
                'type' => 'FeatureCollection',
                'features' => [$outside],
            ])
            ->assertOk()
            ->assertJsonPath('berhasil', 0)
            ->assertJsonPath('gagal', 1)
            ->assertJsonPath('diarsipkan', 0);

        $this->assertStringContainsString(
            'Titik aktif yang sudah ada tidak boleh dipindahkan ke arsip oleh impor.',
            (string) $this->withHeaders($this->adminHeaders())
                ->postJson('/api/import/geojson', [
                    'type' => 'FeatureCollection',
                    'features' => [$outside],
                ])
                ->json('errors.0'),
        );
    }

    public function test_csv_import_accepts_text_and_uploaded_file(): void
    {
        $csv = "nama,jenis,lat,lng,kecamatan,kategori,tahun\n"
            ."Titik CSV,rob,-3.772786,102.262581,Sungai Serut,Tinggi,2025\n";

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/csv', ['csv' => $csv])
            ->assertOk()
            ->assertJsonPath('berhasil', 1)
            ->assertJsonPath('gagal', 0)
            ->assertJsonPath('dryRun', false);

        $this->assertDatabaseHas('spots', ['nama' => 'Titik CSV', 'kategori' => 'Tinggi']);

        $csv2 = "nama,jenis,lat,lng\n"
            ."Titik CSV File,abrasi,-3.772786,102.262581\n";

        $this->withHeaders($this->adminHeaders())
            ->post('/api/import/csv', [
                'file' => UploadedFile::fake()->createWithContent('titik.csv', $csv2),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('berhasil', 1)
            ->assertJsonPath('gagal', 0);

        $this->assertDatabaseHas('spots', ['nama' => 'Titik CSV File', 'jenis' => 'abrasi']);
    }

    public function test_import_rejects_invalid_json_and_empty_csv(): void
    {
        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/geojson', ['not' => 'geojson'])
            ->assertOk()
            ->assertJsonPath('gagal', 0)
            ->assertJsonPath('berhasil', 0);

        $this->withHeaders($this->adminHeaders())
            ->post('/api/import/csv', ['csv' => ''])
            ->assertStatus(400)
            ->assertJsonPath('error', 'Isi berisi CSV tidak ditemukan.');

        $this->withHeaders($this->adminHeaders())
            ->postJson('/api/import/csv', ['csv' => 'nama,jenis'])
            ->assertStatus(400)
            ->assertJsonPath('error', 'CSV minimal berisi baris judul dan satu data.');
    }
}

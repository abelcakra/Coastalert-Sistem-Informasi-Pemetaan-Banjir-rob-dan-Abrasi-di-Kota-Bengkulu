<?php

namespace Tests\Feature;

use App\Models\Spot;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MakesCoastAlertData;
use Tests\TestCase;

class SpotApiTest extends TestCase
{
    use MakesCoastAlertData;
    use RefreshDatabase;

    public function test_public_spot_list_and_filters_match_legacy_contract(): void
    {
        $this->makeSpot([
            'id' => 'sp_rob',
            'nama' => 'Pantai Berkas Rob',
            'jenis' => 'rob',
            'kecamatan' => 'Sungai Serut',
            'kategori' => 'Tinggi',
            'terverifikasi' => true,
        ]);
        $this->makeSpot([
            'id' => 'sp_abrasi',
            'nama' => 'Pantai Panjang Abrasi',
            'jenis' => 'abrasi',
            'kecamatan' => 'Teluk Segara',
            'kategori' => null,
            'terverifikasi' => false,
        ]);

        $this->getJson('/api/spots')
            ->assertOk()
            ->assertJsonPath('jumlah', 2)
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/spots?jenis=abrasi')
            ->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', 'sp_abrasi');

        $this->getJson('/api/spots?kecamatan=Teluk%20Segara')
            ->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', 'sp_abrasi');

        $this->getJson('/api/spots?kategori=Tinggi')
            ->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', 'sp_rob');

        $this->getJson('/api/spots?q=panjang')
            ->assertOk()
            ->assertJsonPath('jumlah', 1)
            ->assertJsonPath('data.0.id', 'sp_abrasi');
    }

    public function test_admin_can_create_update_and_delete_a_spot(): void
    {
        $headers = $this->adminHeaders();

        $created = $this->withHeaders($headers)->postJson('/api/spots', [
            'nama' => 'Titik Baru',
            'kecamatan' => 'Sungai Serut',
            'jenis' => 'rob',
            'jenisAncaman' => 'Banjir Rob',
            'kategori' => 'Sedang',
            'statusKoordinat' => 'terverifikasi',
            'lat' => -3.772786,
            'lng' => 102.262581,
            'tinggiRob' => 50,
            'luasTerdampakHa' => 2.5,
            'kkTerdampak' => 20,
            'tahun' => 2025,
            'tanggal' => '2025-02-03',
            'deskripsi' => 'Titik baru dari pengujian.',
            'sumber' => 'Pengujian',
            'terverifikasi' => true,
        ]);

        $created->assertCreated()->assertJsonPath('data.nama', 'Titik Baru');
        $id = (string) $created->json('data.id');
        $this->assertNotSame('', $id);
        $this->assertDatabaseHas('spots', ['id' => $id, 'nama' => 'Titik Baru']);

        $this->withHeaders($headers)->putJson('/api/spots/'.$id, [
            'nama' => 'Titik Diperbarui',
            'kecamatan' => 'Sungai Serut',
            'jenis' => 'abrasi',
            'jenisAncaman' => 'Abrasi',
            'kategori' => 'Rendah',
            'statusKoordinat' => 'referensi_lokasi',
            'lat' => -3.772786,
            'lng' => 102.262581,
            'lajuAbrasi' => 1.2,
            'terverifikasi' => false,
        ])->assertOk()
            ->assertJsonPath('data.nama', 'Titik Diperbarui')
            ->assertJsonPath('data.jenis', 'abrasi')
            ->assertJsonPath('data.tinggiRob', null)
            ->assertJsonPath('data.lajuAbrasi', 1.2);

        $this->withHeaders($headers)->deleteJson('/api/spots/'.$id)
            ->assertOk()
            ->assertExactJson(['ok' => true]);

        $this->assertDatabaseMissing('spots', ['id' => $id]);
    }

    public function test_spot_validation_rejects_missing_values_and_outside_coordinates(): void
    {
        $headers = $this->adminHeaders();

        $this->withHeaders($headers)->postJson('/api/spots', [])
            ->assertStatus(400)
            ->assertJsonStructure(['error']);

        $this->withHeaders($headers)->postJson('/api/spots', [
            'nama' => 'Di Luar Kota',
            'jenis' => 'rob',
            'lat' => -6.2,
            'lng' => 106.8,
        ])->assertStatus(400)
            ->assertJsonFragment(['error' => 'Koordinat berada di luar batas administrasi Kota Bengkulu.']);
    }

    public function test_archived_spots_are_hidden_from_public_endpoints(): void
    {
        $this->makeSpot([
            'id' => 'sp_arsip',
            'nama' => 'Titik Luar Batas',
            'lat' => -6.2,
            'lng' => 106.8,
        ]);

        $this->getJson('/api/spots')->assertOk()->assertJsonPath('jumlah', 0);
        $this->getJson('/api/spots/sp_arsip')->assertStatus(404);

        $this->withHeaders($this->adminHeaders())
            ->deleteJson('/api/spots/sp_arsip')
            ->assertStatus(404);
    }

    public function test_spot_show_returns_normalised_status_fields(): void
    {
        $this->makeSpot(['id' => 'sp_show']);
        $response = $this->getJson('/api/spots/sp_show')->assertOk();

        $response->assertJsonPath('data.id', 'sp_show')
            ->assertJsonPath('data.statusLokasi', 'dalam')
            ->assertJsonPath('data.statusVerifikasi', 'terverifikasi');
    }
}

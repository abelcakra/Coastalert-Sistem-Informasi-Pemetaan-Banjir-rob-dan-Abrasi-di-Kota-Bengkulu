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

    public function test_daftar_titik_publik_dan_filter_sesuai_dengan_kontrak_api_lama(): void
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

    public function test_admin_dapat_menambah_memperbarui_dan_menghapus_titik(): void
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

    public function test_validasi_titik_menolak_nilai_yang_kosong_dan_koordinat_di_luar_wilayah(): void
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

    public function test_titik_yang_diarsipkan_disembunyikan_dari_endpoint_publik(): void
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

    public function test_detail_titik_mengembalikan_field_status_yang_terstandarisasi(): void
    {
        $this->makeSpot(['id' => 'sp_show']);
        $response = $this->getJson('/api/spots/sp_show')->assertOk();

        $response->assertJsonPath('data.id', 'sp_show')
            ->assertJsonPath('data.statusLokasi', 'dalam')
            ->assertJsonPath('data.statusVerifikasi', 'terverifikasi');
    }
}

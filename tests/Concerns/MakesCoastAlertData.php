<?php

namespace Tests\Concerns;

use App\Models\Report;
use App\Models\Spot;
use Illuminate\Support\Str;

trait MakesCoastAlertData
{
    /**
     * @param  array<string, mixed>  $attributes
     */
    protected function makeSpot(array $attributes = []): Spot
    {
        $now = now();

        return Spot::query()->create(array_merge([
            'id' => 'sp_test_'.Str::lower(Str::random(10)),
            'nama' => 'Titik Uji',
            'kecamatan' => 'Sungai Serut',
            'jenis' => 'rob',
            'jenisAncaman' => 'Banjir Rob',
            'kategori' => 'Sedang',
            'statusKoordinat' => 'perkiraan',
            'lat' => -3.772786,
            'lng' => 102.262581,
            'tinggiRob' => 45,
            'lajuAbrasi' => null,
            'luasTerdampakHa' => 1.5,
            'kkTerdampak' => 10,
            'tahun' => 2025,
            'tanggal' => '2025-01-10',
            'deskripsi' => 'Data uji titik rawan.',
            'sumber' => 'Pengujian',
            'terverifikasi' => true,
            'createdAt' => $now,
            'updatedAt' => $now,
        ], $attributes));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    protected function makeReport(array $attributes = []): Report
    {
        return Report::query()->create(array_merge([
            'id' => 'rp_test_'.Str::lower(Str::random(10)),
            'kode' => 'CL-'.random_int(100000, 999999),
            'jenis' => 'rob',
            'namaPelapor' => 'Pelapor Uji',
            'kontak' => '08123456789',
            'alamat' => 'Alamat uji',
            'kecamatan' => 'Sungai Serut',
            'lat' => -3.772786,
            'lng' => 102.262581,
            'deskripsi' => 'Laporan uji.',
            'tanggal' => '2025-01-10',
            'foto' => null,
            'status' => 'pending',
            'catatanAdmin' => '',
            'createdAt' => now(),
            'updatedAt' => null,
        ], $attributes));
    }
}

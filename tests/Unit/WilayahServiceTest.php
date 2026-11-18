<?php

namespace Tests\Unit;

use App\Services\WilayahService;
use Tests\TestCase;

class WilayahServiceTest extends TestCase
{
    public function test_titik_diklasifikasikan_berdasarkan_batas_wilayah_kota(): void
    {
        $wilayah = app(WilayahService::class);

        $this->assertSame('dalam', $wilayah->klasifikasi(-3.772786, 102.262581)->status);
        $this->assertTrue($wilayah->titikDiDalamKota(-3.772786, 102.262581));
        $this->assertSame('luar', $wilayah->klasifikasi(-6.2, 106.8)->status);
        $this->assertFalse($wilayah->titikDiDalamKota(-6.2, 106.8));
    }

    public function test_koordinat_kosong_atau_tidak_valid_memerlukan_pemeriksaan_manual(): void
    {
        $wilayah = app(WilayahService::class);

        $this->assertSame('manual', $wilayah->klasifikasi(null, null)->status);
        $this->assertSame('manual', $wilayah->klasifikasi('', 102.26)->status);
        $this->assertSame('manual', $wilayah->klasifikasi(100, 102.26)->status);
        $this->assertSame('manual', $wilayah->klasifikasi(-3.77, 200)->status);
        $this->assertSame('manual', $wilayah->klasifikasi('abc', 102.26)->status);
    }
}
<?php

namespace Tests\Unit;

use App\Services\WilayahService;
use Tests\TestCase;

class WilayahServiceTest extends TestCase
{
    public function test_points_are_classified_against_the_copied_city_boundary(): void
    {
        $wilayah = app(WilayahService::class);

        $this->assertSame('dalam', $wilayah->klasifikasi(-3.772786, 102.262581)->status);
        $this->assertTrue($wilayah->titikDiDalamKota(-3.772786, 102.262581));
        $this->assertSame('luar', $wilayah->klasifikasi(-6.2, 106.8)->status);
        $this->assertFalse($wilayah->titikDiDalamKota(-6.2, 106.8));
    }

    public function test_empty_or_invalid_coordinates_are_manual_checks(): void
    {
        $wilayah = app(WilayahService::class);

        $this->assertSame('manual', $wilayah->klasifikasi(null, null)->status);
        $this->assertSame('manual', $wilayah->klasifikasi('', 102.26)->status);
        $this->assertSame('manual', $wilayah->klasifikasi(100, 102.26)->status);
        $this->assertSame('manual', $wilayah->klasifikasi(-3.77, 200)->status);
        $this->assertSame('manual', $wilayah->klasifikasi('abc', 102.26)->status);
    }
}

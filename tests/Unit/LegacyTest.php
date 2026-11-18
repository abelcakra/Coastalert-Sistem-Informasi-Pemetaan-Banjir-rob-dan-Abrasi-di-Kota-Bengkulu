<?php

namespace Tests\Unit;

use App\Support\Legacy;
use Tests\TestCase;

class LegacyTest extends TestCase
{
    public function test_angka_dinormalisasi_seperti_api_lama(): void
    {
        $this->assertSame(1.5, Legacy::angka('1,5'));
        $this->assertSame(12, Legacy::angka('12'));
        $this->assertSame(0, Legacy::angka('0'));
        $this->assertNull(Legacy::angka(''));
        $this->assertNull(Legacy::angka('bukan angka'));
        $this->assertNull(Legacy::angka(null));
    }

    public function test_boolean_dan_teks_mengikuti_logika_api_lama(): void
    {
        $this->assertTrue(Legacy::boolean(true));
        $this->assertTrue(Legacy::boolean('true'));
        $this->assertTrue(Legacy::boolean('1'));
        $this->assertTrue(Legacy::boolean(1));
        $this->assertFalse(Legacy::boolean('0'));
        $this->assertFalse(Legacy::boolean('false'));
        $this->assertTrue(Legacy::boolean(null, true));

        $this->assertSame('teks', Legacy::teks('  teks  '));
        $this->assertSame('', Legacy::teks(null));
    }

    public function test_id_titik_laporan_konsisten_dan_sesuai_panjang_kolom(): void
    {
        $this->assertSame('lpr_rp_123', Legacy::idTitikLaporan('rp_123'));

        $long = str_repeat('x', 100);
        $id = Legacy::idTitikLaporan($long);
        $this->assertSame($id, Legacy::idTitikLaporan($long));
        $this->assertStringStartsWith('lpr_', $id);
        $this->assertLessThanOrEqual(40, strlen($id));
    }

    public function test_id_baru_menggunakan_awalan_yang_diminta(): void
    {
        $this->assertStringStartsWith('sp_', Legacy::newId('sp'));
        $this->assertStringStartsWith('rp_', Legacy::newId('rp'));
    }
}

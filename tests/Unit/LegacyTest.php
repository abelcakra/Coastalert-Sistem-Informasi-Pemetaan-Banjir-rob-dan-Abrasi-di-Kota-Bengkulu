<?php

namespace Tests\Unit;

use App\Support\Legacy;
use Tests\TestCase;

class LegacyTest extends TestCase
{
    public function test_numbers_are_normalised_like_the_legacy_api(): void
    {
        $this->assertSame(1.5, Legacy::angka('1,5'));
        $this->assertSame(12, Legacy::angka('12'));
        $this->assertSame(0, Legacy::angka('0'));
        $this->assertNull(Legacy::angka(''));
        $this->assertNull(Legacy::angka('bukan angka'));
        $this->assertNull(Legacy::angka(null));
    }

    public function test_booleans_and_text_follow_legacy_truthiness(): void
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

    public function test_report_generated_spot_ids_are_deterministic_and_fit_the_column(): void
    {
        $this->assertSame('lpr_rp_123', Legacy::idTitikLaporan('rp_123'));

        $long = str_repeat('x', 100);
        $id = Legacy::idTitikLaporan($long);
        $this->assertSame($id, Legacy::idTitikLaporan($long));
        $this->assertStringStartsWith('lpr_', $id);
        $this->assertLessThanOrEqual(40, strlen($id));
    }

    public function test_new_id_uses_the_requested_prefix(): void
    {
        $this->assertStringStartsWith('sp_', Legacy::newId('sp'));
        $this->assertStringStartsWith('rp_', Legacy::newId('rp'));
    }
}

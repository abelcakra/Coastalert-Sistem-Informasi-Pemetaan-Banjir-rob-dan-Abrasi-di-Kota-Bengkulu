<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class ExampleTest extends TestCase
{
    /**
     * Pengujian dasar untuk memastikan nilai true bernilai benar.
     */
    public function test_nilai_true_dinyatakan_benar(): void
    {
        $this->assertTrue(true);
    }
}

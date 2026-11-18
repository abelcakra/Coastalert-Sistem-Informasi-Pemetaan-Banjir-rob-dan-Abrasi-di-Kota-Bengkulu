<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * Pengujian dasar untuk memastikan aplikasi memberikan respons berhasil.
     */
    public function test_aplikasi_mengembalikan_respons_berhasil(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
    }
}

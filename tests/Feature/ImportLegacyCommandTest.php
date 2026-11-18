<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImportLegacyCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_perintah_menolak_import_jika_database_sumber_dan_target_sama(): void
    {
        $this->artisan('coastalert:import-legacy', [
            '--source' => (string) config('database.connections.mysql.database'),
        ])
            ->expectsOutput('Database sumber dan target sama. Impor dibatalkan agar tidak menimpa data.')
            ->assertFailed();
    }
}
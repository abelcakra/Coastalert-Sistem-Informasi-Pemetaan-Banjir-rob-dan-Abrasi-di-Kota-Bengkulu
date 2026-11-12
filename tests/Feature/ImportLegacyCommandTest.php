<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImportLegacyCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_refuses_to_import_when_source_and_target_are_the_same(): void
    {
        $this->artisan('coastalert:import-legacy', [
            '--source' => (string) config('database.connections.mysql.database'),
        ])
            ->expectsOutput('Database sumber dan target sama. Impor dibatalkan agar tidak menimpa data.')
            ->assertFailed();
    }
}

<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        $target = $_ENV['DB_DATABASE']
            ?? $_SERVER['DB_DATABASE']
            ?? getenv('DB_DATABASE');

        if (! is_string($target) || $target === 'coastalert' || ! str_ends_with($target, '_test')) {
            throw new RuntimeException(
                'Pengujian ditolak karena DB_DATABASE harus menggunakan database khusus dengan akhiran *_test.'
            );
        }

        parent::setUp();

        $configured = (string) config('database.connections.mysql.database');

        if ($configured !== $target || $configured === 'coastalert' || ! str_ends_with($configured, '_test')) {
            throw new RuntimeException('Pengamanan database pengujian gagal: database aktif tidak sesuai dengan target.');
        }
    }

    protected function adminToken(): string
    {
        $response = $this->postJson('/api/admin/login', [
            'password' => (string) config('coastalert.admin_password'),
        ]);

        $response->assertOk();

        return (string) $response->json('token');
    }

    /**
     * Menghasilkan header autentikasi admin.
     *
     * @return array<string, string>
     */
    protected function adminHeaders(?string $token = null): array
    {
        return ['Authorization' => 'Bearer '.($token ?? $this->adminToken())];
    }
}

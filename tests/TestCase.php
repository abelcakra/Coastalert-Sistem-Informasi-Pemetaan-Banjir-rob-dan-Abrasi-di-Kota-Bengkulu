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
                'Refusing to run tests unless DB_DATABASE points to a dedicated *_test database.'
            );
        }

        parent::setUp();

        $configured = (string) config('database.connections.mysql.database');

        if ($configured !== $target || $configured === 'coastalert' || ! str_ends_with($configured, '_test')) {
            throw new RuntimeException('Test database guard failed: unexpected active database target.');
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
     * @return array<string, string>
     */
    protected function adminHeaders(?string $token = null): array
    {
        return ['Authorization' => 'Bearer '.($token ?? $this->adminToken())];
    }
}

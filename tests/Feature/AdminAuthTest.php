<?php

namespace Tests\Feature;

use App\Models\AdminToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_admin_menghasilkan_token_dan_endpoint_terlindungi_menerimanya(): void
    {
        $response = $this->postJson('/api/admin/login', [
            'password' => (string) config('coastalert.admin_password'),
        ]);

        $response->assertOk()->assertJsonStructure(['token']);
        $token = (string) $response->json('token');
        $this->assertSame(48, strlen($token));
        $this->assertDatabaseCount('admin_tokens', 1);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/cek')
            ->assertOk()
            ->assertExactJson(['ok' => true]);
    }

    public function test_login_admin_menerima_password_yang_diberi_tanda_kutip(): void
    {
        $response = $this->postJson('/api/admin/login', [
            'password' => '"'.config('coastalert.admin_password').'"',
        ]);

        $response->assertOk()->assertJsonStructure(['token']);
    }

    public function test_password_yang_salah_ditolak(): void
    {
        $this->postJson('/api/admin/login', ['password' => 'not-the-password'])
            ->assertStatus(401)
            ->assertJsonPath('error', 'Password salah.');

        $this->assertDatabaseCount('admin_tokens', 0);
    }

    public function test_endpoint_terlindungi_memerlukan_token_bearer(): void
    {
        $this->getJson('/api/admin/cek')->assertStatus(401);
        $this->getJson('/api/reports')->assertStatus(401);
        $this->postJson('/api/spots', [])->assertStatus(401);
    }

    public function test_logout_membatalkan_token(): void
    {
        $token = $this->adminToken();

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->postJson('/api/admin/logout')
            ->assertOk()
            ->assertExactJson(['ok' => true]);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/cek')
            ->assertStatus(401);

        $this->assertDatabaseCount('admin_tokens', 0);
    }

    public function test_token_kedaluwarsa_ditolak_dan_dibersihkan_saat_login_berikutnya(): void
    {
        $token = 'expired-token';
        AdminToken::query()->create([
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->subMinute(),
            'created_at' => now()->subHour(),
        ]);

        $this->withHeaders(['Authorization' => 'Bearer '.$token])
            ->getJson('/api/admin/cek')
            ->assertStatus(401);

        $this->postJson('/api/admin/login', [
            'password' => (string) config('coastalert.admin_password'),
        ])->assertOk();

        $this->assertDatabaseMissing('admin_tokens', ['token_hash' => hash('sha256', $token)]);
    }

    public function test_login_tidak_tersedia_jika_password_admin_belum_dikonfigurasi(): void
    {
        config([
            'coastalert.admin_password' => '',
            'coastalert.admin_password_hash' => '',
        ]);

        $this->postJson('/api/admin/login', ['password' => 'anything'])
            ->assertStatus(503)
            ->assertJsonPath(
                'error',
                'Login admin belum dikonfigurasi. Atur ADMIN_PASSWORD pada .env/environment server sesuai kebijakan.',
            );
    }

    public function test_percobaan_login_berlebihan_dibatasi(): void
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/admin/login', ['password' => 'wrong-'.$i]);
        }

        $this->postJson('/api/admin/login', ['password' => 'wrong-again'])
            ->assertStatus(429)
            ->assertJsonStructure(['error', 'retryAfter']);
    }
}

<?php

namespace App\Services;

use App\Models\AdminToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminAuthService
{
    public function siap(): bool
    {
        $hash = (string) config('coastalert.admin_password_hash');
        if ($hash !== '') {
            return true;
        }

        $password = (string) config('coastalert.admin_password');
        if (strlen($password) < 8) {
            return false;
        }

        if (in_array((string) config('app.env'), ['local', 'development'], true)) {
            return true;
        }

        return strlen($password) >= 12
            && preg_match('/[a-z]/', $password) === 1
            && preg_match('/[A-Z]/', $password) === 1
            && preg_match('/[0-9]/', $password) === 1
            && preg_match('/[^A-Za-z0-9]/', $password) === 1;
    }

    public function login(string $password): ?string
    {
        if (! $this->siap() || ! $this->passwordCocok($password)) {
            return null;
        }

        $token = bin2hex(random_bytes(24));
        $now = now();

        AdminToken::query()->where('expires_at', '<=', $now)->delete();
        AdminToken::query()->create([
            'token_hash' => hash('sha256', $token),
            'expires_at' => $now->copy()->addMinutes((int) config('coastalert.admin_token_ttl_minutes', 480)),
            'created_at' => $now,
        ]);

        return $token;
    }

    public function logout(?string $token): bool
    {
        if (! $token) {
            return false;
        }

        return AdminToken::query()
            ->where('token_hash', hash('sha256', $token))
            ->delete() > 0;
    }

    public function tokenValid(?string $token): bool
    {
        if (! $token) {
            return false;
        }

        return AdminToken::query()
            ->where('token_hash', hash('sha256', $token))
            ->where('expires_at', '>', now())
            ->exists();
    }

    public function tokenDariRequest(Request $request): ?string
    {
        $header = (string) $request->header('Authorization', '');

        if (preg_match('/^Bearer\s+(.+)$/i', $header, $cocok) !== 1) {
            return null;
        }

        return trim($cocok[1]);
    }

    private function passwordCocok(string $input): bool
    {
        $hash = (string) config('coastalert.admin_password_hash');
        if ($hash !== '') {
            return Hash::check($input, $hash);
        }

        $expected = (string) config('coastalert.admin_password');
        if ($expected === '') {
            return false;
        }

        // Jika password di ADMIN_PASSWORD berformat hash bcrypt atau argon2
        if (str_starts_with($expected, '$2y$') || str_starts_with($expected, '$2a$') || str_starts_with($expected, '$argon2')) {
            return Hash::check($input, $expected);
        }

        // Perbandingan constant-time dengan password tunggal dari .env
        if (hash_equals($expected, $input)) {
            return true;
        }

        // Tangani kasus toleransi bila input tidak sengaja menyertakan tanda petik pembungkus
        $unquoted = trim($input, "\"' \t\n\r\0\x0B");

        return $unquoted !== $input && hash_equals($expected, $unquoted);
    }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

/**
 * Legacy-compatible rate limiter with the same response envelope and headers.
 */
class ApiRateLimiter
{
    /** @var array<string, string> */
    private const PESAN = [
        'login-admin' => 'Terlalu banyak percobaan login. Silakan coba lagi beberapa saat lagi.',
        'kirim-laporan' => 'Terlalu banyak pengiriman laporan. Silakan coba lagi beberapa saat lagi.',
        'lacak-laporan' => 'Terlalu banyak permintaan pelacakan laporan. Silakan coba lagi nanti.',
        'chat' => 'Terlalu banyak permintaan ke layanan informasi. Silakan coba lagi nanti.',
    ];

    public function handle(
        Request $request,
        Closure $next,
        string $nama,
        int $max = 60,
        int $detik = 60,
    ): Response {
        $kunci = $nama.'|'.$request->ip();
        $jumlah = RateLimiter::hit($kunci, $detik);
        $sisa = max(0, $max - $jumlah);
        $pulih = max(1, RateLimiter::availableIn($kunci));

        $headers = [
            'X-RateLimit-Limit' => (string) $max,
            'X-RateLimit-Remaining' => (string) $sisa,
            'X-RateLimit-Reset' => (string) (time() + $pulih),
        ];

        if ($jumlah > $max) {
            return response()->json([
                'error' => self::PESAN[$nama] ?? 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
                'retryAfter' => $pulih,
            ], 429, $headers + ['Retry-After' => (string) $pulih]);
        }

        $response = $next($request);
        foreach ($headers as $key => $value) {
            $response->headers->set($key, $value);
        }

        return $response;
    }
}

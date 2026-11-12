<?php

use App\Http\Middleware\ApiNoStore;
use App\Http\Middleware\ApiRateLimiter;
use App\Http\Middleware\EnsureAdminToken;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin.token' => EnsureAdminToken::class,
            'api.nostore' => ApiNoStore::class,
            'throttle.legacy' => ApiRateLimiter::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            if ($e instanceof ValidationException) {
                return response()->json([
                    'error' => implode(' ', array_map('strval', Arr::flatten($e->errors()))),
                ], 400);
            }

            if ($e instanceof AuthenticationException) {
                return response()->json([
                    'error' => 'Akses ditolak. Silakan login sebagai admin.',
                ], 401);
            }

            if ($e instanceof PostTooLargeException) {
                return response()->json([
                    'error' => 'Ukuran permintaan terlalu besar.',
                ], 413);
            }

            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $pesan = trim($e->getMessage());

                return response()->json([
                    'error' => $pesan !== '' ? $pesan : 'Terjadi kesalahan pada permintaan.',
                ], $status);
            }

            return response()->json([
                'error' => app()->environment('production')
                    ? 'Terjadi kesalahan pada server.'
                    : $e->getMessage(),
            ], 500);
        });
    })->create();

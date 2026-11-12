<?php

namespace App\Http\Middleware;

use App\Services\AdminAuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdminToken
{
    public function __construct(private readonly AdminAuthService $auth)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = $this->auth->tokenDariRequest($request);

        if (! $this->auth->tokenValid($token)) {
            return response()->json(
                ['error' => 'Akses ditolak. Silakan login sebagai admin.'],
                401,
            );
        }

        $request->attributes->set('admin_token', $token);

        return $next($request);
    }
}

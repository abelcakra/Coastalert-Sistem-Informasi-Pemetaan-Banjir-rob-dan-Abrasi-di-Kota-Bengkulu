<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AdminAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminAuthController extends Controller
{
    public function __construct(private readonly AdminAuthService $auth)
    {
    }

    public function login(Request $request): JsonResponse
    {
        if (! $this->auth->siap()) {
            return response()->json([
                'error' => 'Login admin belum dikonfigurasi. Atur ADMIN_PASSWORD pada .env/environment server sesuai kebijakan.',
            ], 503);
        }

        $token = $this->auth->login((string) $request->input('password', ''));

        if ($token === null) {
            return response()->json(['error' => 'Password salah.'], 401);
        }

        return response()->json(['token' => $token]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout($request->attributes->get('admin_token'));

        return response()->json(['ok' => true]);
    }

    public function cek(): JsonResponse
    {
        return response()->json(['ok' => true]);
    }
}

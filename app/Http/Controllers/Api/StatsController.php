<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StatsService;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function __construct(private readonly StatsService $stats)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json($this->stats->bangun(true));
    }

    public function admin(): JsonResponse
    {
        return response()->json($this->stats->bangun(false));
    }

    public function meta(): JsonResponse
    {
        return response()->json($this->stats->meta());
    }
}

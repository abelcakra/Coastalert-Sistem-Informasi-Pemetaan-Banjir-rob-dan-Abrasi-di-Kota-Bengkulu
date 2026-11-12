<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SpotRequest;
use App\Services\SpotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SpotController extends Controller
{
    public function __construct(private readonly SpotService $spots)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $rows = $this->spots->daftar([
            'jenis' => $request->query('jenis'),
            'kategori' => $request->query('kategori'),
            'kecamatan' => $request->query('kecamatan'),
            'q' => $request->query('q'),
        ]);

        return response()->json([
            'jumlah' => $rows->count(),
            'data' => $rows->values(),
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $spot = $this->spots->cari($id);
        if ($spot === null) {
            return response()->json(['error' => 'Titik tidak ditemukan.'], 404);
        }

        return response()->json(['data' => $spot]);
    }

    public function store(SpotRequest $request): JsonResponse
    {
        $normal = $this->spots->normalisasi($request->all());
        if ($normal['errors'] !== []) {
            return response()->json(['error' => implode(' ', $normal['errors'])], 400);
        }

        $spot = $this->spots->buat($normal['data']);

        return response()->json(['data' => $spot], 201);
    }

    public function update(SpotRequest $request, string $id): JsonResponse
    {
        $existing = $this->spots->cari($id);
        if ($existing === null) {
            return response()->json(['error' => 'Titik tidak ditemukan.'], 404);
        }

        $normal = $this->spots->normalisasi($request->all(), $existing);
        if ($normal['errors'] !== []) {
            return response()->json(['error' => implode(' ', $normal['errors'])], 400);
        }

        return response()->json(['data' => $this->spots->ubah($existing, $normal['data'])]);
    }

    public function destroy(string $id): JsonResponse
    {
        $spot = $this->spots->cari($id);
        if ($spot === null || ! $this->spots->hapus($spot)) {
            return response()->json(['error' => 'Titik tidak ditemukan.'], 404);
        }

        return response()->json(['ok' => true]);
    }
}

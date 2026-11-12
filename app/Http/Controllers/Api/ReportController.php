<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreReportRequest;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private readonly ReportService $reports)
    {
    }

    public function store(StoreReportRequest $request): JsonResponse
    {
        $hasil = $this->reports->buat($request->all(), $request->file('foto'));

        if ($hasil['errors'] !== []) {
            return response()->json(['error' => implode(' ', $hasil['errors'])], 400);
        }

        return response()->json($hasil['hasil'], 201);
    }

    public function publik(): JsonResponse
    {
        return response()->json($this->reports->publik());
    }

    public function lacak(string $kode): JsonResponse
    {
        return response()->json(['data' => $this->reports->lacak($kode)]);
    }

    public function index(Request $request): JsonResponse
    {
        $arsip = $request->query('arsip') === '1';
        $status = $request->query('status');
        $rows = $this->reports->daftarAdmin(is_string($status) ? $status : null, $arsip);

        return response()->json([
            'jumlah' => $rows->count(),
            'arsip' => $arsip,
            'data' => $rows->values(),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $hasil = $this->reports->ubahStatus($id, $request->all());
        $body = [
            'data' => $hasil['laporan'],
            'spot' => $hasil['spot'],
            'spotDibuat' => $hasil['spotDibuat'],
        ];

        if ($hasil['spot'] !== null && ! $hasil['spotDibuat']) {
            $body['pesan'] = 'Laporan sudah memiliki titik; tidak ada titik baru yang dibuat.';
        }

        return response()->json($body);
    }

    public function destroy(string $id): JsonResponse
    {
        if (! $this->reports->hapus($id)) {
            return response()->json(['error' => 'Laporan tidak ditemukan.'], 404);
        }

        return response()->json(['ok' => true]);
    }
}

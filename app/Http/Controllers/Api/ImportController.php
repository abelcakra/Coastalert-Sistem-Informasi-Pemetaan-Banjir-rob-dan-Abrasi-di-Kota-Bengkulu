<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportRequest;
use App\Services\ImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImportController extends Controller
{
    public function __construct(private readonly ImportService $import)
    {
    }

    public function geojson(ImportRequest $request): JsonResponse
    {
        try {
            if ($request->hasFile('file')) {
                $teks = (string) file_get_contents($request->file('file')->getRealPath());
            } else {
                $teks = (string) json_encode($request->all());
            }

            $gj = json_decode($teks, true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return response()->json(['error' => 'Berkas bukan GeoJSON/JSON yang valid.'], 400);
        }

        $features = [];
        if (is_array($gj)) {
            if (($gj['type'] ?? null) === 'FeatureCollection') {
                $features = is_array($gj['features'] ?? null) ? $gj['features'] : [];
            } elseif (($gj['type'] ?? null) === 'Feature') {
                $features = [$gj];
            }
        }

        return $this->kirimHasil($request, $features, count($features).' feature');
    }

    public function csv(ImportRequest $request): JsonResponse
    {
        $teks = $request->hasFile('file')
            ? (string) file_get_contents($request->file('file')->getRealPath())
            : (string) $request->input('csv', '');

        if (trim($teks) === '') {
            return response()->json(['error' => 'Isi berisi CSV tidak ditemukan.'], 400);
        }

        $baris = $this->import->parseCsv($teks);
        if (count($baris) < 2) {
            return response()->json(['error' => 'CSV minimal berisi baris judul dan satu data.'], 400);
        }

        $header = array_map(fn ($h) => trim((string) $h), $baris[0]);
        $features = [];
        foreach (array_slice($baris, 1) as $barisData) {
            $obj = [];
            foreach ($header as $i => $h) {
                $obj[$h] = $barisData[$i] ?? null;
            }
            $features[] = ['properties' => $obj, 'geometry' => null];
        }

        return $this->kirimHasil($request, $features, 'CSV');
    }

    /**
     * @param  array<int, array<string, mixed>>  $features
     */
    private function kirimHasil(Request $request, array $features, string $sumber): JsonResponse
    {
        $dryRun = $this->mintaDryRun($request);
        $ringkasan = $this->import->imporFeatures($features, $dryRun);

        return response()->json([
            'pesan' => $this->import->pesanImpor($ringkasan, $sumber),
            ...$ringkasan,
        ]);
    }

    private function mintaDryRun(Request $request): bool
    {
        $nilai = $request->query('dryRun')
            ?? $request->query('dry-run')
            ?? $request->input('dryRun');

        return $nilai === true || $nilai === 1 || $nilai === '1' || $nilai === 'true';
    }
}

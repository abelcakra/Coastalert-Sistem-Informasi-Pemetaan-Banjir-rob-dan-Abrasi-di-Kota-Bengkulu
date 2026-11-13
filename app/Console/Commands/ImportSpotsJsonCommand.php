<?php

namespace App\Console\Commands;

use App\Services\ImportService;
use Illuminate\Console\Command;
use JsonException;

class ImportSpotsJsonCommand extends Command
{
    protected $signature = 'coastalert:import-spots-json
                            {berkas : Path ke berkas JSON berisi array titik rawan}
                            {--dry-run : Simulasikan impor tanpa menulis ke database}';

    protected $description = 'Impor titik rawan dari berkas JSON warisan CoastAlert (mis. data/spots.json).';

    public function handle(ImportService $import): int
    {
        $berkas = (string) $this->argument('berkas');

        if (! is_file($berkas)) {
            $this->error('Berkas tidak ditemukan: '.$berkas);

            return self::FAILURE;
        }

        try {
            $isi = json_decode((string) file_get_contents($berkas), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            $this->error('Berkas JSON tidak valid: '.$e->getMessage());

            return self::FAILURE;
        }

        if (! is_array($isi) || ! array_is_list($isi)) {
            $this->error('Isi berkas harus berupa array JSON berisi objek titik rawan.');

            return self::FAILURE;
        }

        $features = [];
        foreach ($isi as $baris) {
            if (! is_array($baris)) {
                continue;
            }

            $lat = $baris['lat'] ?? null;
            $lng = $baris['lng'] ?? null;
            $geometry = is_numeric($lat) && is_numeric($lng)
                ? ['type' => 'Point', 'coordinates' => [(float) $lng, (float) $lat]]
                : null;

            $features[] = [
                'type' => 'Feature',
                'geometry' => $geometry,
                'properties' => $baris,
            ];
        }

        $this->line('Berkas     : '.$berkas);
        $this->line('Jumlah titik: '.count($features));

        $dryRun = (bool) $this->option('dry-run');
        $ringkasan = $import->imporFeatures($features, $dryRun);

        $this->newLine();
        $this->info($import->pesanImpor($ringkasan, basename($berkas)));

        foreach ($ringkasan['errors'] as $galat) {
            $this->warn('- '.$galat);
        }

        if ($ringkasan['gagal'] > 0) {
            $this->warn('Sebagian titik gagal diimpor. Periksa pesan di atas.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}

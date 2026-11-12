<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class ImportLegacyCommand extends Command
{
    protected $signature = 'coastalert:import-legacy
                            {--source= : Nama database sumber (default: coastalert)}
                            {--dry-run : Hanya tampilkan jumlah data tanpa menulis}';

    protected $description = 'Impor data spots & reports lama ke database CoastAlert Laravel tanpa mengubah database sumber.';

    public function handle(): int
    {
        $target = (string) DB::connection()->getDatabaseName();
        $source = (string) ($this->option('source') ?: config('database.connections.legacy.database'));

        if ($target === 'coastalert') {
            $this->error('Target adalah database produksi `coastalert`. Impor dibatalkan.');

            return self::FAILURE;
        }

        if ($source === $target) {
            $this->error('Database sumber dan target sama. Impor dibatalkan agar tidak menimpa data.');

            return self::FAILURE;
        }

        config(['database.connections.legacy.database' => $source]);
        DB::purge('legacy');

        try {
            $sumber = DB::connection('legacy');
            $sumber->select('SELECT 1');
        } catch (Throwable $e) {
            $this->error('Tidak dapat terhubung ke database sumber: '.$e->getMessage());

            return self::FAILURE;
        }

        $spots = DB::connection('legacy')->table('spots')->orderBy('seq')->get()
            ->map(fn ($row) => (array) $row)->all();
        $reports = DB::connection('legacy')->table('reports')->orderBy('seq')->get()
            ->map(fn ($row) => (array) $row)->all();

        $this->line('Database sumber: '.$source);
        $this->line('Database target: '.$target);
        $this->line('Jumlah spots: '.count($spots));
        $this->line('Jumlah reports: '.count($reports));

        if ($this->option('dry-run')) {
            $this->info('Dry-run: tidak ada data yang ditulis.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($spots, $reports) {
            foreach ($spots as $row) {
                DB::table('spots')->updateOrInsert(['id' => $row['id']], $row);
            }

            foreach ($reports as $row) {
                DB::table('reports')->updateOrInsert(['id' => $row['id']], $row);
            }
        });

        $targetSpots = DB::table('spots')->count();
        $targetReports = DB::table('reports')->count();

        $this->info('Impor selesai.');
        $this->line('Spots di target: '.$targetSpots);
        $this->line('Reports di target: '.$targetReports);

        if ($targetSpots < count($spots) || $targetReports < count($reports)) {
            $this->warn('Jumlah target lebih kecil dari sumber. Periksa kembali sebelum melanjutkan.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}

<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Throwable;

class OllamaCheckCommand extends Command
{
    protected $signature = 'ollama:check';

    protected $description = 'Periksa koneksi server Ollama dan ketersediaan model layanan informasi CoastAlert.';

    public function handle(): int
    {
        $url = rtrim((string) config('coastalert.ollama_url'), '/');
        $model = (string) config('coastalert.ollama_model');

        $this->line('URL Ollama : '.$url);
        $this->line('Model      : '.$model);

        try {
            $respons = Http::timeout((int) config('coastalert.ollama_status_timeout', 5))
                ->connectTimeout(3)
                ->acceptJson()
                ->get($url.'/api/tags');
        } catch (Throwable $e) {
            $this->newLine();
            $this->error('Server Ollama tidak dapat dihubungi: '.$e->getMessage());
            $this->petunjukMenjalankan();

            return self::FAILURE;
        }

        if (! $respons->successful()) {
            $this->newLine();
            $this->error('Server Ollama menolak permintaan (HTTP '.$respons->status().').');
            $this->petunjukMenjalankan();

            return self::FAILURE;
        }

        $data = $respons->json('models', []);
        $modelTerpasang = collect(is_array($data) ? $data : [])
            ->pluck('name')
            ->filter(fn ($nama) => is_string($nama))
            ->values();

        $this->info('Server Ollama aktif.');
        $this->line('Model terpasang: '.($modelTerpasang->isEmpty() ? '(tidak ada)' : $modelTerpasang->implode(', ')));

        $target = str_contains($model, ':') ? $model : $model.':latest';

        if (! $modelTerpasang->contains($target)) {
            $this->newLine();
            $this->error('Model "'.$model.'" belum terpasang di server Ollama.');
            $this->line('Unduh model dengan: ollama pull '.$model);

            return self::FAILURE;
        }

        $this->info('Model "'.$model.'" siap digunakan oleh layanan informasi.');
        $this->line('Uji cepat: php artisan serve, lalu buka widget layanan informasi di situs.');

        return self::SUCCESS;
    }

    private function petunjukMenjalankan(): void
    {
        $this->line('Jalankan server Ollama dengan folder model yang benar:');
        $this->line('  powershell -ExecutionPolicy Bypass -File scripts/ollama-serve.ps1');
        $this->line('Atau periksa apakah OLLAMA_MODELS sudah menunjuk ke folder model yang berisi qwen2.5:7b.');
    }
}

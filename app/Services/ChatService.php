<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Spot;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatService
{
    public function __construct(
        private readonly SpotService $spots,
        private readonly ReportService $reports,
    ) {}

    /**
     * @param  array<int, array{role?: mixed, content?: mixed}>  $riwayat
     */
    public function balas(string $pesan, array $riwayat = []): StreamedResponse|JsonResponse
    {
        $maxPesan = (int) config('coastalert.chat_max_message', 2000);
        $maxRiwayat = (int) config('coastalert.chat_max_history', 8);
        $pesan = trim(mb_substr($pesan, 0, $maxPesan));

        if ($pesan === '') {
            return response()->json(['error' => 'Pesan tidak boleh kosong.'], 400);
        }

        $riwayat = array_slice(array_values(array_filter(
            $riwayat,
            fn ($m) => is_array($m)
                && in_array($m['role'] ?? null, ['user', 'assistant'], true)
                && is_string($m['content'] ?? null)
                && trim($m['content']) !== '',
        )), -$maxRiwayat);

        $messages = [
            ['role' => 'system', 'content' => $this->promptSistem()],
            ...array_map(fn (array $m) => [
                'role' => $m['role'],
                'content' => mb_substr($m['content'], 0, $maxPesan),
            ], $riwayat),
            ['role' => 'user', 'content' => $pesan],
        ];

        $url = (string) config('coastalert.ollama_url');
        $model = (string) config('coastalert.ollama_model');

        try {
            $ollama = Http::withOptions(['stream' => true])
                ->timeout((int) config('coastalert.ollama_timeout', 120))
                ->connectTimeout(10)
                ->acceptJson()
                ->post($url.'/api/chat', [
                    'model' => $model,
                    'messages' => $messages,
                    'stream' => true,
                    'keep_alive' => '30m',
                    'options' => [
                        'temperature' => (float) config('coastalert.ollama_temperature', 0.3),
                        'num_ctx' => (int) config('coastalert.ollama_num_ctx', 16384),
                        'num_predict' => (int) config('coastalert.ollama_num_predict', 512),
                    ],
                ]);
        } catch (ConnectionException $e) {
            Log::error('[chat] Gagal menghubungi Ollama di '.$url.': '.$e->getMessage());

            return response()->json(['error' => $this->pesanTidakTersedia()], 503);
        }

        if (! $ollama->successful()) {
            $teks = (string) $ollama->body();
            $pesanOllama = trim($teks);
            $json = json_decode($teks, true);
            if (is_array($json) && isset($json['error'])) {
                $pesanOllama = (string) $json['error'];
            }

            if ($ollama->status() === 404 || preg_match('/model .* not found/i', $pesanOllama) === 1) {
                Log::error('[chat] Model "'.$model.'" belum tersedia. Jalankan: ollama pull '.$model);

                return response()->json(['error' => $this->pesanTidakTersedia()], 503);
            }

            Log::error('[chat] Ollama menolak permintaan ('.$ollama->status().'): '.$pesanOllama);

            return response()->json(['error' => $this->pesanTidakTersedia()], 502);
        }

        $body = $ollama->toPsrResponse()->getBody();

        return response()->stream(function () use ($body): void {
            try {
                while (! $body->eof()) {
                    $bagian = $body->read(8192);
                    if ($bagian === '') {
                        break;
                    }
                    echo $bagian;
                    if (ob_get_level() > 0) {
                        @ob_flush();
                    }
                    flush();
                }
            } catch (\Throwable) {
                // Browser or Ollama closed the connection; nothing else to do.
            }
        }, 200, [
            'Content-Type' => 'application/x-ndjson; charset=utf-8',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Periksa ketersediaan server Ollama dan model yang dikonfigurasi.
     */
    public function status(): JsonResponse
    {
        $url = (string) config('coastalert.ollama_url');
        $model = (string) config('coastalert.ollama_model');

        try {
            $respons = Http::timeout((int) config('coastalert.ollama_status_timeout', 5))
                ->connectTimeout(3)
                ->acceptJson()
                ->get($url.'/api/tags');
        } catch (ConnectionException $e) {
            Log::warning('[chat] Server Ollama tidak dapat dihubungi saat pemeriksaan status: '.$e->getMessage());

            return $this->statusTidakTersedia($model);
        } catch (\Throwable $e) {
            Log::warning('[chat] Pemeriksaan status Ollama gagal: '.$e->getMessage());

            return $this->statusTidakTersedia($model);
        }

        if (! $respons->successful()) {
            Log::warning('[chat] Ollama menolak pemeriksaan status ('.$respons->status().').');

            return $this->statusTidakTersedia($model);
        }

        $modelTerpasang = collect($respons->json('models', []))
            ->pluck('name')
            ->filter(fn ($nama) => is_string($nama))
            ->values();

        $modelSiap = $modelTerpasang->contains($this->namaModelLengkap($model));

        return response()->json([
            'tersedia' => true,
            'model' => $model,
            'model_siap' => $modelSiap,
            'pesan' => $modelSiap
                ? 'HARA siap digunakan.'
                : 'Model '.$model.' belum tersedia di server Ollama.',
        ]);
    }

    private function statusTidakTersedia(string $model): JsonResponse
    {
        return response()->json([
            'tersedia' => false,
            'model' => $model,
            'model_siap' => false,
            'pesan' => $this->pesanTidakTersedia(),
        ]);
    }

    private function namaModelLengkap(string $model): string
    {
        return str_contains($model, ':') ? $model : $model.':latest';
    }

    private function promptSistem(): string
    {
        return <<<PROMPT
Kamu adalah "HARA" (High Automated Risk Abrasive and Coast), asisten layanan informasi untuk situs CoastAlert - Web GIS pemetaan banjir rob dan abrasi pesisir Kota Bengkulu.

Tugasmu membantu pengunjung: menjelaskan fitur situs, menceritakan titik rawan berdasarkan DATA di bawah, dan mengarahkan cara melaporkan kejadian.

Halaman situs:
- Beranda (/): ringkasan informasi dan navigasi utama CoastAlert.
- Peta Interaktif (/peta): sebaran titik rawan banjir rob & abrasi di pesisir Bengkulu; bisa difilter berdasarkan jenis bencana, kecamatan, dan tingkat kerawanan.
- Statistik (/dashboard): grafik ringkasan titik per kecamatan, status verifikasi, dan data dampak.
- Lapor Kejadian (/laporan): formulir laporan warga lengkap dengan penanda lokasi di peta dan unggah foto bukti kejadian.
- Status Laporan (/status): pelacakan status penanganan laporan warga menggunakan kode laporan.
- Panel Admin (/admin): panel khusus petugas untuk memverifikasi laporan warga dan mengelola katalog titik rawan.

Aturan menjawab:
- Selalu gunakan bahasa Indonesia yang ramah, sopan, dan ringkas (maksimal sekitar 120 kata).
- Tampil sebagai HARA, asisten layanan informasi CoastAlert. Jangan menyebut diri sebagai AI, model bahasa, chatbot, atau sistem otomatis.
- Jika pengguna meminta daftar, periksa SELURUH data dengan teliti dan sebutkan semua yang cocok, jangan sampai ada yang terlewat.
- Untuk pertanyaan jumlah atau agregat, gunakan angka pada bagian RINGKASAN ANGKA dan "Sebaran catatan per kecamatan". Jangan menghitung ulang daftar secara manual.
- Jawab HANYA berdasarkan DATA di bawah dan informasi halaman di atas. Jangan mengarang angka, lokasi, atau koordinat.
- Jika informasi tidak ada pada data, katakan belum tersedia lalu arahkan ke halaman yang relevan.
- Untuk kondisi darurat, anjurkan menghubungi 112 (darurat) atau BPBD Kota Bengkulu.
- Jangan membahas topik di luar CoastAlert, rob/abrasi pesisir, dan kebencanaan pesisir Bengkulu; tolak dengan sopan dan arahkan kembali ke topik situs.

DATA SAAT INI:
{$this->konteksData()}
PROMPT;
    }

    private function konteksData(): string
    {
        $spots = $this->spots->semua();
        $reports = $this->reports->semua();

        $rob = $spots->filter(fn (Spot $spot) => $spot->jenis === 'rob');
        $abrasi = $spots->filter(fn (Spot $spot) => $spot->jenis === 'abrasi');

        $perKecamatan = [];
        foreach ($spots as $spot) {
            $k = $spot->kecamatan ?: 'Tidak diketahui';
            $perKecamatan[$k] = ($perKecamatan[$k] ?? 0) + 1;
        }

        $labelKoordinat = [
            'perkiraan' => 'pin perkiraan',
            'referensi_lokasi' => 'referensi lokasi',
            'terverifikasi' => 'koordinat terverifikasi',
        ];

        $barisTitik = $spots->map(function (Spot $spot) use ($labelKoordinat) {
            $detail = $spot->jenis === 'rob'
                ? ($spot->tinggiRob === null ? 'tinggi rob belum tersedia' : 'tinggi rob '.$spot->tinggiRob.' cm')
                : ($spot->lajuAbrasi === null ? 'laju abrasi belum tersedia' : 'laju abrasi '.$spot->lajuAbrasi.' m/tahun');
            $status = $spot->terverifikasi ? 'terverifikasi' : 'belum diverifikasi';
            $koordinat = $labelKoordinat[$spot->statusKoordinat] ?? 'status koordinat belum diketahui';

            return '- '.$spot->nama.' — '.$spot->jenis.' — tanggal '.($spot->tanggal ?: 'belum tersedia')
                .' — kategori '.($spot->kategori ?: 'belum ditetapkan').' — '.$status.' — '.$koordinat
                .' — Kec. '.($spot->kecamatan ?: '—').' — '.$detail.' — sumber: '.($spot->sumber ?: '—');
        })->implode("\n");

        $terverifikasi = $spots->filter(fn (Spot $spot) => $spot->terverifikasi)->count();
        $sebaran = collect($perKecamatan)
            ->map(fn (int $n, string $k) => $k.'='.$n)
            ->implode(', ');

        $perKategori = collect(['Rendah', 'Sedang', 'Tinggi'])
            ->map(fn (string $k) => $k.'='.$spots->where('kategori', $k)->count())
            ->implode(', ');
        $tanpaKategori = $spots->whereNull('kategori')->count();

        return implode("\n", [
            'Total catatan sumber: '.$spots->count().' ('.$rob->count().' rob, '.$abrasi->count()
                .' abrasi); kejadian terverifikasi: '.$terverifikasi.'; belum diverifikasi: '
                .($spots->count() - $terverifikasi).'.',
            'Sebaran catatan per kecamatan: '.$sebaran.'.',
            'Sebaran kategori kerawanan: '.$perKategori.'; belum ditetapkan='.$tanpaKategori.'.',
            'Laporan warga: '.$reports->count().' total, '
                .$reports->filter(fn (Report $r) => $r->status === 'diverifikasi')->count()
                .' terverifikasi, '
                .$reports->filter(fn (Report $r) => $r->status === 'pending')->count()
                .' menunggu verifikasi.',
            '',
            'Daftar catatan sumber:',
            $barisTitik !== '' ? $barisTitik : '(belum ada data)',
            '',
            'RINGKASAN ANGKA (gunakan untuk pertanyaan jumlah): total '.$spots->count()
                .' catatan; '.$rob->count().' rob; '.$abrasi->count().' abrasi; '
                .$terverifikasi.' terverifikasi; '.($spots->count() - $terverifikasi)
                .' belum diverifikasi; kategori '.$perKategori.'.',
        ]);
    }

    private function pesanTidakTersedia(): string
    {
        return 'Layanan informasi HARA sedang tidak tersedia. Silakan coba lagi beberapa saat lagi, '
            .'atau hubungi petugas CoastAlert lewat menu Panel Admin.';
    }
}

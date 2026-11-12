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
                    'options' => ['temperature' => 0.4, 'num_predict' => 512],
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

    private function promptSistem(): string
    {
        return <<<PROMPT
Kamu adalah "CoastAlert CS", layanan informasi (customer service) untuk situs CoastAlert - Web GIS pemetaan banjir rob dan abrasi pesisir Kota Bengkulu.

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
- Tampil sebagai petugas layanan informasi CoastAlert. Jangan menyebut diri sebagai AI, model bahasa, chatbot, atau sistem otomatis.
- Jika pengguna meminta daftar, periksa SELURUH data dengan teliti dan sebutkan semua yang cocok, jangan sampai ada yang terlewat.
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

        return implode("\n", [
            'Total catatan sumber: '.$spots->count().' ('.$rob->count().' rob, '.$abrasi->count()
                .' abrasi); kejadian terverifikasi: '.$terverifikasi.'; belum diverifikasi: '
                .($spots->count() - $terverifikasi).'.',
            'Sebaran catatan per kecamatan: '.$sebaran.'.',
            'Laporan warga: '.$reports->count().' total, '
                .$reports->filter(fn (Report $r) => $r->status === 'diverifikasi')->count()
                .' terverifikasi, '
                .$reports->filter(fn (Report $r) => $r->status === 'pending')->count()
                .' menunggu verifikasi.',
            '',
            'Daftar catatan sumber:',
            $barisTitik !== '' ? $barisTitik : '(belum ada data)',
        ]);
    }

    private function pesanTidakTersedia(): string
    {
        return 'Layanan informasi sedang tidak tersedia. Silakan coba lagi beberapa saat lagi, '
            .'atau hubungi petugas CoastAlert lewat menu Panel Admin.';
    }
}

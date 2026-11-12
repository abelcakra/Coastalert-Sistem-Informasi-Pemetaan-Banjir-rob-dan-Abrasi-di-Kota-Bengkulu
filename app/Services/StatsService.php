<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Spot;
use App\Support\Legacy;
use Illuminate\Support\Collection;

class StatsService
{
    public function __construct(
        private readonly SpotService $spots,
        private readonly ReportService $reports,
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function bangun(bool $publik = true): array
    {
        $spots = $this->spots->semua();
        $reports = $this->reports->semua();
        $gea = $this->bacaStatsGea();

        $rob = $spots->filter(fn (Spot $spot) => $spot->jenis === 'rob')->values();
        $abrasi = $spots->filter(fn (Spot $spot) => $spot->jenis === 'abrasi')->values();
        $terverifikasi = $spots->filter(fn (Spot $spot) => (bool) $spot->terverifikasi)->values();
        $belumVerifikasi = $spots->filter(fn (Spot $spot) => ! $spot->terverifikasi)->values();

        $perJenisAncaman = [];
        foreach ($spots as $spot) {
            $nama = $spot->jenisAncaman ?: ($spot->jenis === 'abrasi' ? 'Abrasi' : 'Banjir Rob');
            $perJenisAncaman[$nama] = ($perJenisAncaman[$nama] ?? 0) + 1;
        }

        $kecamatan = [];
        foreach ($spots as $spot) {
            $nama = $spot->kecamatan ?: 'Tidak diketahui';
            $kecamatan[$nama] ??= [
                'kecamatan' => $nama,
                'rob' => 0,
                'abrasi' => 0,
                'total' => 0,
                'terverifikasi' => 0,
                'belumVerifikasi' => 0,
            ];

            $jenis = $spot->jenis === 'abrasi' ? 'abrasi' : 'rob';
            $kecamatan[$nama][$jenis] += 1;
            $kecamatan[$nama]['total'] += 1;
            if ($spot->terverifikasi) {
                $kecamatan[$nama]['terverifikasi'] += 1;
            } else {
                $kecamatan[$nama]['belumVerifikasi'] += 1;
            }
        }

        $perKategori = array_fill_keys(Legacy::KATEGORI, 0);
        $sebaranKategori = $this->sebaranKosong();
        foreach ($spots as $spot) {
            if (! in_array($spot->kategori, Legacy::KATEGORI, true)) {
                continue;
            }
            $perKategori[$spot->kategori] += 1;
            if (isset($sebaranKategori[$spot->jenis])) {
                $sebaranKategori[$spot->jenis][$spot->kategori] += 1;
            }
        }

        $perStatusKoordinat = [
            'perkiraan' => 0,
            'referensi_lokasi' => 0,
            'terverifikasi' => 0,
            'tidak_diketahui' => 0,
        ];
        foreach ($spots as $spot) {
            if (array_key_exists($spot->statusKoordinat, $perStatusKoordinat)) {
                $perStatusKoordinat[$spot->statusKoordinat] += 1;
            } else {
                $perStatusKoordinat['tidak_diketahui'] += 1;
            }
        }

        $tahun = [];
        foreach ($spots as $spot) {
            $t = $spot->tahun ?: 'Tidak diketahui';
            $tahun[$t] ??= ['tahun' => $t, 'rob' => 0, 'abrasi' => 0, 'tinggiRob' => [], 'lajuAbrasi' => []];
            $jenis = $spot->jenis === 'abrasi' ? 'abrasi' : 'rob';
            $tahun[$t][$jenis] += 1;
            $tahun[$t]['tinggiRob'][] = $spot->tinggiRob;
            $tahun[$t]['lajuAbrasi'][] = $spot->lajuAbrasi;
        }

        usort($tahun, fn (array $a, array $b) => strcmp((string) $a['tahun'], (string) $b['tahun']));
        $tren = array_map(fn (array $t) => [
            'tahun' => $t['tahun'],
            'rob' => $t['rob'],
            'abrasi' => $t['abrasi'],
            'rataTinggiRob' => $this->rata($t['tinggiRob']),
            'rataLajuAbrasi' => $this->rata($t['lajuAbrasi']),
        ], $tahun);

        $laporan = $this->statistikLaporan($reports, $publik);

        $ringkasan = [
            'totalTitik' => $spots->count(),
            'totalCatatan' => $spots->count(),
            'totalRob' => $rob->count(),
            'totalAbrasi' => $abrasi->count(),
            'totalKejadianTerverifikasi' => $terverifikasi->count(),
            'totalBelumVerifikasi' => $belumVerifikasi->count(),
            'totalKoordinatPerkiraan' => $perStatusKoordinat['perkiraan'],
            'totalKoordinatReferensi' => $perStatusKoordinat['referensi_lokasi'],
            'totalKoordinatTerverifikasi' => $perStatusKoordinat['terverifikasi'],
            'totalLaporan' => $laporan['total'],
            'laporanPending' => $laporan['perStatus']['pending'],
            'laporanTerverifikasi' => $laporan['perStatus']['diverifikasi'],
            'totalKK' => $this->totalAtauNull($spots->pluck('kkTerdampak')->all()),
            'totalLuasHa' => $this->totalAtauNull($spots->pluck('luasTerdampakHa')->all()),
            'rataTinggiRob' => $this->rata($rob->pluck('tinggiRob')->all()),
            'rataLajuAbrasi' => $this->rata($abrasi->pluck('lajuAbrasi')->all()),
        ];

        if (! $publik) {
            $ringkasan['laporanDitolak'] = $laporan['perStatus']['ditolak'];
        }

        return [
            'ringkasan' => $ringkasan,
            'perKategori' => $perKategori,
            'perJenis' => ['rob' => $rob->count(), 'abrasi' => $abrasi->count()],
            'perJenisAncaman' => $perJenisAncaman,
            'perStatusVerifikasi' => [
                'terverifikasi' => $terverifikasi->count(),
                'belum_verifikasi' => $belumVerifikasi->count(),
            ],
            'perStatusKoordinat' => $perStatusKoordinat,
            'perKecamatan' => collect($kecamatan)->sortByDesc('total')->values()->all(),
            'sebaranKategori' => $sebaranKategori,
            'trenPerTahun' => $tren,
            'laporan' => $laporan,
            'gea' => $gea,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function meta(): array
    {
        $spots = $this->spots->semua();

        return [
            'kecamatan' => $this->unik($spots, 'kecamatan'),
            'tahun' => $this->unik($spots, 'tahun'),
            'jenis' => ['rob', 'abrasi'],
            'jenisAncaman' => $this->unik($spots, 'jenisAncaman'),
            'kategori' => Legacy::KATEGORI,
            'statusKoordinat' => ['perkiraan', 'referensi_lokasi', 'terverifikasi'],
            'statusVerifikasi' => ['terverifikasi', 'perlu_verifikasi'],
        ];
    }

    /**
     * @param  Collection<int, Report>  $reports
     * @return array<string, mixed>
     */
    private function statistikLaporan(Collection $reports, bool $publik): array
    {
        $sumber = $publik
            ? $reports->filter(fn (Report $report) => $report->status !== 'ditolak')->values()
            : $reports->values();

        $perStatus = $publik
            ? ['pending' => 0, 'diverifikasi' => 0]
            : ['pending' => 0, 'diverifikasi' => 0, 'ditolak' => 0];
        $perJenis = ['rob' => 0, 'abrasi' => 0];
        $perBulan = [];

        foreach ($sumber as $report) {
            $perStatus[$report->status] = ($perStatus[$report->status] ?? 0) + 1;
            $perJenis[$report->jenis] = ($perJenis[$report->jenis] ?? 0) + 1;

            $bulan = substr((string) ($report->createdAt ?: $report->tanggal ?: ''), 0, 7);
            if (preg_match('/^\d{4}-\d{2}$/', $bulan) !== 1) {
                continue;
            }

            $perBulan[$bulan] ??= ['bulan' => $bulan, 'rob' => 0, 'abrasi' => 0, 'total' => 0];
            $perBulan[$bulan][$report->jenis] += 1;
            $perBulan[$bulan]['total'] += 1;
        }

        $urutTerbaru = $sumber
            ->sortByDesc(fn (Report $report) => (string) ($report->createdAt ?: ''))
            ->values();

        $ringkas = fn (Report $report) => [
            'id' => $report->id,
            'jenis' => $report->jenis,
            'namaPelapor' => $report->namaPelapor,
            'kontak' => $report->kontak,
            'alamat' => $report->alamat,
            'kecamatan' => $report->kecamatan,
            'lat' => $report->lat,
            'lng' => $report->lng,
            'deskripsi' => $report->deskripsi,
            'tanggal' => $report->tanggal,
            'foto' => $report->foto,
            'status' => $report->status,
            'createdAt' => $report->createdAt,
        ];

        $hasil = [
            'total' => $sumber->count(),
            'perStatus' => $perStatus,
            'perJenis' => $perJenis,
            'trenPerBulan' => collect($perBulan)->sortBy('bulan')->values()->all(),
        ];

        if (! $publik) {
            $hasil['terverifikasi'] = $urutTerbaru
                ->filter(fn (Report $report) => $report->status === 'diverifikasi')
                ->map($ringkas)->values()->all();
            $hasil['menunggu'] = $urutTerbaru
                ->filter(fn (Report $report) => $report->status === 'pending')
                ->map($ringkas)->values()->all();
            $hasil['terbaru'] = $urutTerbaru->take(5)->map($ringkas)->values()->all();
        }

        return $hasil;
    }

    private function bacaStatsGea(): ?array
    {
        $path = (string) config('coastalert.gea_stats_path');

        if (! is_file($path)) {
            return null;
        }

        try {
            $data = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        return is_array($data) ? $data : null;
    }

    private function sebaranKosong(): array
    {
        return [
            'rob' => ['Rendah' => 0, 'Sedang' => 0, 'Tinggi' => 0],
            'abrasi' => ['Rendah' => 0, 'Sedang' => 0, 'Tinggi' => 0],
        ];
    }

    /**
     * @param  array<int, mixed>  $angka
     */
    private function rata(array $angka): ?float
    {
        $valid = array_values(array_filter($angka, fn ($n) => is_int($n) || is_float($n)));
        if ($valid === []) {
            return null;
        }

        return round(array_sum($valid) / count($valid), 1);
    }

    /**
     * @param  array<int, mixed>  $angka
     */
    private function totalAtauNull(array $angka): int|float|null
    {
        $valid = array_values(array_filter($angka, fn ($n) => is_int($n) || is_float($n)));
        if ($valid === []) {
            return null;
        }

        return round(array_sum($valid), 1);
    }

    /**
     * @return array<int, mixed>
     */
    private function unik(Collection $spots, string $key): array
    {
        $nilai = $spots
            ->pluck($key)
            ->filter(fn ($item) => (bool) $item)
            ->unique()
            ->values()
            ->all();

        usort($nilai, fn ($a, $b) => strcmp((string) $a, (string) $b));

        return $nilai;
    }
}

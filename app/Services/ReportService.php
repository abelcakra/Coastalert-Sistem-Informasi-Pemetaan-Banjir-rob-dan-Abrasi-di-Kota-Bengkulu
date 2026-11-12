<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Spot;
use App\Support\Legacy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ReportService
{
    public function __construct(
        private readonly WilayahService $wilayah,
        private readonly ReportCodeService $kode,
        private readonly PhotoService $foto,
    ) {
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array{errors: array<int, string>, hasil?: array<string, mixed>}
     */
    public function buat(array $body, ?UploadedFile $foto): array
    {
        $jenis = in_array($body['jenis'] ?? null, Legacy::JENIS, true)
            ? $body['jenis']
            : null;
        $lat = Legacy::angka($body['lat'] ?? null);
        $lng = Legacy::angka($body['lng'] ?? null);
        $errors = [];

        if (Legacy::teks($body['namaPelapor'] ?? '') === '') {
            $errors[] = 'Nama pelapor wajib diisi.';
        }
        if ($jenis === null) {
            $errors[] = 'Jenis laporan harus "rob" atau "abrasi".';
        }
        if (Legacy::teks($body['deskripsi'] ?? '') === '') {
            $errors[] = 'Deskripsi kejadian wajib diisi.';
        }

        if (! is_int($lat) && ! is_float($lat) || ! is_int($lng) && ! is_float($lng)) {
            $errors[] = 'Titik lokasi wajib dipilih di peta; latitude dan longitude tidak boleh kosong.';
        } elseif ($lat < -90 || $lat > 90) {
            $errors[] = 'Latitude harus berada pada rentang -90 sampai 90.';
        } elseif ($lng < -180 || $lng > 180) {
            $errors[] = 'Longitude harus berada pada rentang -180 sampai 180.';
        } else {
            $lokasi = $this->wilayah->klasifikasi($lat, $lng);
            if ($lokasi->status === 'manual') {
                $errors[] = $lokasi->alasan ?: 'Titik lokasi tidak dapat diperiksa terhadap batas Kota Bengkulu.';
            }
        }

        if ($errors !== []) {
            return ['errors' => $errors];
        }

        $validasiFoto = $this->foto->validasi($foto);
        if (! $validasiFoto['ok']) {
            return ['errors' => [$validasiFoto['error']]];
        }

        $pathFoto = null;

        try {
            $pathFoto = $foto ? $this->foto->simpan($foto, $validasiFoto['ekstensi'] ?? null) : null;

            $laporan = Report::query()->create([
                'id' => Legacy::newId('rp'),
                'kode' => $this->kode->buat(),
                'jenis' => $jenis,
                'namaPelapor' => Legacy::teks($body['namaPelapor']),
                'kontak' => Legacy::teks($body['kontak'] ?? ''),
                'alamat' => Legacy::teks($body['alamat'] ?? ''),
                'kecamatan' => Legacy::teks($body['kecamatan'] ?? ''),
                'lat' => $lat,
                'lng' => $lng,
                'deskripsi' => Legacy::teks($body['deskripsi']),
                'tanggal' => Legacy::teks($body['tanggal'] ?? '') !== ''
                    ? Legacy::teks($body['tanggal'])
                    : now()->toDateString(),
                'foto' => $pathFoto,
                'status' => 'pending',
                'catatanAdmin' => '',
                'createdAt' => now(),
            ]);
        } catch (\Throwable $e) {
            if ($pathFoto) {
                $this->foto->hapus($pathFoto);
            }

            throw $e;
        }

        $diarsipkan = $laporan->statusLokasi !== 'dalam';

        return [
            'errors' => [],
            'hasil' => [
                'data' => $laporan,
                'diarsipkan' => $diarsipkan,
                'pesan' => $diarsipkan
                    ? 'Terima kasih. Lokasi laporan berada di luar cakupan Kota Bengkulu, sehingga laporan disimpan sebagai arsip dan tidak ditampilkan di peta/statistik aktif.'
                    : 'Terima kasih! Laporan Anda menunggu verifikasi admin.',
            ],
        ];
    }

    /**
     * @return Collection<int, Report>
     */
    public function semua(bool $termasukArsip = false): Collection
    {
        $rows = Report::query()->orderBy('seq')->get();

        return $termasukArsip
            ? $rows
            : $rows->filter(fn (Report $report) => $report->statusLokasi === 'dalam')->values();
    }

    public function cari(string $id, bool $termasukArsip = true): ?Report
    {
        $report = Report::query()->where('id', $id)->first();

        if ($report === null) {
            return null;
        }

        if (! $termasukArsip && $report->statusLokasi !== 'dalam') {
            return null;
        }

        return $report;
    }

    /**
     * @return array{jumlah: int, data: array<int, array<string, mixed>>}
     */
    public function publik(): array
    {
        $data = $this->semua()
            ->filter(fn (Report $report) => $report->status === 'diverifikasi')
            ->map(fn (Report $report) => [
                'id' => $report->id,
                'jenis' => $report->jenis,
                'lat' => $report->lat,
                'lng' => $report->lng,
                'kecamatan' => $report->kecamatan,
                'deskripsi' => $report->deskripsi,
                'tanggal' => $report->tanggal,
                'foto' => $report->foto,
            ])
            ->values()
            ->all();

        return ['jumlah' => count($data), 'data' => $data];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function lacak(string $kode): ?array
    {
        $kode = strtoupper(preg_replace('/\s+/', '', $kode) ?? '');

        if (preg_match('/^\d{6}$/', $kode) === 1) {
            $kode = 'CL-'.$kode;
        }

        if (preg_match('/^CL-\d{6}$/', $kode) !== 1) {
            throw new HttpException(400, 'Format kode laporan tidak valid. Contoh: CL-123456.');
        }

        $laporan = Report::query()->where('kode', $kode)->first();

        if ($laporan === null) {
            throw new HttpException(404, 'Kode laporan tidak ditemukan.');
        }

        return [
            'kode' => $laporan->kode,
            'tanggal' => $laporan->tanggal,
            'jenis' => $laporan->jenis,
            'lokasi' => $laporan->kecamatan ?: '',
            'kecamatan' => $laporan->kecamatan ?: '',
            'status' => $laporan->status,
            'createdAt' => $laporan->createdAt,
        ];
    }

    /**
     * @return Collection<int, Report>
     */
    public function daftarAdmin(?string $status = null, bool $arsip = false): Collection
    {
        $rows = $this->semua($arsip);

        if ($arsip) {
            $rows = $rows->filter(fn (Report $report) => $report->statusLokasi !== 'dalam')->values();
        }

        if (is_string($status) && in_array($status, Legacy::STATUS_LAPORAN, true)) {
            $rows = $rows->filter(fn (Report $report) => $report->status === $status)->values();
        }

        return $rows
            ->sortByDesc(fn (Report $report) => (string) $report->createdAt)
            ->values();
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array{laporan: Report, spot: Spot|null, spotDibuat: bool}
     */
    public function ubahStatus(string $id, array $body): array
    {
        $status = $body['status'] ?? null;
        if ($status !== null && $status !== '' && ! in_array($status, Legacy::STATUS_LAPORAN, true)) {
            throw new HttpException(400, 'Status tidak valid.');
        }

        return DB::transaction(function () use ($id, $body, $status) {
            $laporanLama = Report::query()->where('id', $id)->lockForUpdate()->first();

            if ($laporanLama === null || $laporanLama->statusLokasi !== 'dalam') {
                throw new HttpException(404, 'Laporan tidak ditemukan.');
            }

            $patch = ['updatedAt' => now()];
            if (is_string($status) && $status !== '') {
                $patch['status'] = $status;
            }
            if (array_key_exists('catatanAdmin', $body) && is_string($body['catatanAdmin'])) {
                $patch['catatanAdmin'] = $body['catatanAdmin'];
            }

            $laporanLama->fill($patch);
            $laporanLama->save();
            $laporan = $laporanLama->refresh();

            $statusEfektif = is_string($status) && $status !== '' ? $status : $laporanLama->status;
            $spot = null;
            $spotDibuat = false;

            if (Legacy::boolean($body['jadikanTitik'] ?? false) && $statusEfektif === 'diverifikasi') {
                $idTitik = Legacy::idTitikLaporan($laporanLama->id);
                $spot = Spot::query()->where('id', $idTitik)->lockForUpdate()->first();

                if ($spot === null) {
                    if ($laporan->lat === null || $laporan->lng === null) {
                        throw new HttpException(400, 'Koordinat laporan kosong sehingga tidak dapat dijadikan titik.');
                    }

                    $lat = (float) $laporan->lat;
                    $lng = (float) $laporan->lng;
                    if (! is_finite($lat) || ! is_finite($lng) || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
                        throw new HttpException(400, 'Koordinat laporan tidak valid sehingga tidak dapat dijadikan titik.');
                    }

                    if ($this->wilayah->klasifikasi($lat, $lng)->status !== 'dalam') {
                        throw new HttpException(400, 'Laporan tidak dapat dijadikan titik karena lokasinya di luar batas Kota Bengkulu.');
                    }

                    $now = now();
                    $nama = mb_substr(
                        Legacy::teks($laporan->alamat ?: 'Laporan '.($laporan->namaPelapor ?: 'warga')),
                        0,
                        150,
                    );
                    if ($nama === '') {
                        $nama = mb_substr('Laporan '.$laporan->id, 0, 150);
                    }

                    $kecamatan = mb_substr(
                        Legacy::teks($laporan->kecamatan ?: 'Belum diketahui'),
                        0,
                        100,
                    );
                    $sumber = mb_substr(
                        'Laporan warga terverifikasi ['.$laporan->id.']: '.($laporan->namaPelapor ?: 'tanpa nama'),
                        0,
                        200,
                    );

                    $spot = Spot::query()->create([
                        'id' => $idTitik,
                        'nama' => $nama,
                        'kecamatan' => $kecamatan,
                        'jenis' => $laporan->jenis,
                        'kategori' => null,
                        'statusKoordinat' => 'perkiraan',
                        'lat' => $lat,
                        'lng' => $lng,
                        'tinggiRob' => null,
                        'lajuAbrasi' => null,
                        'luasTerdampakHa' => null,
                        'kkTerdampak' => null,
                        'tahun' => (int) substr((string) $laporan->tanggal, 0, 4) ?: (int) now()->format('Y'),
                        'tanggal' => $laporan->tanggal,
                        'deskripsi' => $laporan->deskripsi,
                        'sumber' => $sumber,
                        'terverifikasi' => true,
                        'createdAt' => $now,
                        'updatedAt' => $now,
                    ]);

                    $spotDibuat = true;
                }
            }

            return ['laporan' => $laporan, 'spot' => $spot, 'spotDibuat' => $spotDibuat];
        });
    }

    public function hapus(string $id): bool
    {
        $laporan = $this->cari($id, false);
        if ($laporan === null) {
            return false;
        }

        return (bool) $laporan->delete();
    }
}

<?php

namespace App\Services;

use App\Models\Spot;
use App\Support\Legacy;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class SpotService
{
    public function __construct(private readonly WilayahService $wilayah)
    {
    }

    /**
     * @return Collection<int, Spot>
     */
    public function semua(bool $termasukArsip = false): Collection
    {
        $rows = Spot::query()->orderBy('seq')->get();

        return $termasukArsip
            ? $rows
            : $rows->filter(fn (Spot $spot) => $spot->statusLokasi === 'dalam')->values();
    }

    public function cari(string $id, bool $termasukArsip = false): ?Spot
    {
        $spot = Spot::query()->where('id', $id)->first();

        if ($spot === null) {
            return null;
        }

        if (! $termasukArsip && $spot->statusLokasi !== 'dalam') {
            return null;
        }

        return $spot;
    }

    /**
     * @param  array{jenis?: mixed, kategori?: mixed, kecamatan?: mixed, q?: mixed}  $filter
     * @return Collection<int, Spot>
     */
    public function daftar(array $filter): Collection
    {
        $rows = $this->semua();
        $jenis = $filter['jenis'] ?? null;

        if (is_string($jenis) && in_array($jenis, Legacy::JENIS, true)) {
            $rows = $rows->filter(fn (Spot $spot) => $spot->jenis === $jenis);
        }

        $kategori = $filter['kategori'] ?? null;
        if (is_string($kategori) && $kategori !== '') {
            $daftar = array_map('trim', explode(',', $kategori));
            $mintaBelum = in_array('Belum diverifikasi', $daftar, true);
            $rows = $rows->filter(
                fn (Spot $spot) => $spot->kategori
                    ? in_array($spot->kategori, $daftar, true)
                    : $mintaBelum,
            );
        }

        $kecamatan = $filter['kecamatan'] ?? null;
        if (is_string($kecamatan) && $kecamatan !== '') {
            $rows = $rows->filter(fn (Spot $spot) => $spot->kecamatan === $kecamatan);
        }

        $q = $filter['q'] ?? null;
        if (is_string($q) && $q !== '') {
            $kata = Str::lower($q);
            $rows = $rows->filter(function (Spot $spot) use ($kata) {
                $gabungan = Str::lower(implode(' ', [
                    $spot->nama,
                    $spot->kecamatan,
                    $spot->jenisAncaman,
                    $spot->deskripsi,
                    $spot->tanggal,
                ]));

                return str_contains($gabungan, $kata);
            });
        }

        return $rows->values();
    }

    /**
     * Normalise a spot payload using the original API's rules.
     *
     * @param  array<string, mixed>  $body
     * @return array{errors: array<int, string>, data: array<string, mixed>}
     */
    public function normalisasi(array $body, ?Spot $existing = null): array
    {
        $jenis = in_array($body['jenis'] ?? null, Legacy::JENIS, true)
            ? $body['jenis']
            : null;
        $jenisBerubah = (bool) ($existing?->jenis && $jenis && $existing->jenis !== $jenis);

        if (array_key_exists('jenisAncaman', $body)) {
            $jenisAncaman = Legacy::teks($body['jenisAncaman']);
        } elseif ($jenisBerubah) {
            $jenisAncaman = '';
        } else {
            $jenisAncaman = Legacy::teks($existing?->jenisAncaman);
        }

        $jenisAncaman = $jenisAncaman !== ''
            ? $jenisAncaman
            : ($jenis === 'rob' ? 'Banjir Rob' : ($jenis === 'abrasi' ? 'Abrasi' : ''));

        $kategori = in_array($body['kategori'] ?? null, Legacy::KATEGORI, true)
            ? $body['kategori']
            : null;

        $statusKoordinat = in_array($body['statusKoordinat'] ?? null, Legacy::STATUS_KOORDINAT, true)
            ? $body['statusKoordinat']
            : ($existing?->statusKoordinat ?: 'perkiraan');

        $lat = Legacy::angka($body['lat'] ?? null);
        $lng = Legacy::angka($body['lng'] ?? null);

        $tanggal = array_key_exists('tanggal', $body)
            ? Legacy::teks($body['tanggal'])
            : Legacy::teks($existing?->tanggal);

        $errors = [];

        if (! isset($body['nama']) || Legacy::teks($body['nama']) === '') {
            $errors[] = 'Nama titik wajib diisi.';
        }

        if ($jenis === null) {
            $errors[] = 'Jenis harus "rob" atau "abrasi".';
        }

        if (mb_strlen($jenisAncaman) > 100) {
            $errors[] = 'Jenis ancaman maksimal 100 karakter.';
        }

        if (! is_int($lat) && ! is_float($lat)) {
            $errors[] = 'Latitude tidak valid.';
        } elseif ($lat < -90 || $lat > 90) {
            $errors[] = 'Latitude tidak valid.';
        }

        if (! is_int($lng) && ! is_float($lng)) {
            $errors[] = 'Longitude tidak valid.';
        } elseif ($lng < -180 || $lng > 180) {
            $errors[] = 'Longitude tidak valid.';
        }

        if (is_int($lat) || is_float($lat)) {
            if (is_int($lng) || is_float($lng)) {
                if ($lat >= -90 && $lat <= 90 && $lng >= -180 && $lng <= 180) {
                    $lokasi = $this->wilayah->klasifikasi($lat, $lng);
                    if ($lokasi->status === 'luar') {
                        $errors[] = 'Koordinat berada di luar batas administrasi Kota Bengkulu.';
                    } elseif ($lokasi->status === 'manual') {
                        $errors[] = $lokasi->alasan ?: 'Koordinat tidak dapat diperiksa terhadap batas Kota Bengkulu.';
                    }
                }
            }
        }

        if ($tanggal !== '' && preg_match(Legacy::POLA_TANGGAL, $tanggal) !== 1) {
            $errors[] = 'Tanggal harus YYYY-MM-DD atau "YYYY-MM-DD s.d. YYYY-MM-DD".';
        }

        $angka = fn (mixed $value): int|float|null => Legacy::angka($value);

        return [
            'errors' => $errors,
            'data' => [
                'nama' => Legacy::teks($body['nama'] ?? ''),
                'kecamatan' => Legacy::teks($body['kecamatan'] ?? ''),
                'jenis' => $jenis,
                'jenisAncaman' => $jenisAncaman,
                'kategori' => $kategori,
                'statusKoordinat' => $statusKoordinat,
                'lat' => $lat,
                'lng' => $lng,
                'tinggiRob' => $jenis === 'rob' ? $angka($body['tinggiRob'] ?? null) : null,
                'lajuAbrasi' => $jenis === 'abrasi' ? $angka($body['lajuAbrasi'] ?? null) : null,
                'luasTerdampakHa' => $angka($body['luasTerdampakHa'] ?? null),
                'kkTerdampak' => $angka($body['kkTerdampak'] ?? null),
                'tahun' => $angka($body['tahun'] ?? null),
                'tanggal' => $tanggal !== '' ? $tanggal : null,
                'deskripsi' => Legacy::teks($body['deskripsi'] ?? ''),
                'sumber' => Legacy::teks($body['sumber'] ?? '') !== ''
                    ? Legacy::teks($body['sumber'])
                    : ($existing?->sumber ?: 'Input manual'),
                'terverifikasi' => array_key_exists('terverifikasi', $body)
                    ? Legacy::boolean($body['terverifikasi'])
                    : (bool) ($existing?->terverifikasi ?? false),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function buat(array $data): Spot
    {
        $now = now();

        return Spot::query()->create([
            ...$data,
            'id' => Legacy::newId('sp'),
            'createdAt' => $now,
            'updatedAt' => $now,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function ubah(Spot $spot, array $data): Spot
    {
        $spot->fill([...$data, 'updatedAt' => now()]);
        $spot->save();

        return $spot->refresh();
    }

    public function hapus(Spot $spot): bool
    {
        if ($spot->statusLokasi !== 'dalam') {
            return false;
        }

        return (bool) $spot->delete();
    }
}

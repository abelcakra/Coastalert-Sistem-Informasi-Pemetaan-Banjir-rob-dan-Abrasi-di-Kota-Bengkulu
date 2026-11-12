<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Shared legacy contract constants and value normalisers.
 *
 * Keeping these values in one place prevents the API, importers and views
 * from drifting away from the original CoastAlert rules.
 */
final class Legacy
{
    public const JENIS = ['rob', 'abrasi'];

    public const KATEGORI = ['Rendah', 'Sedang', 'Tinggi'];

    public const STATUS_KOORDINAT = ['perkiraan', 'referensi_lokasi', 'terverifikasi'];

    public const STATUS_LAPORAN = ['pending', 'diverifikasi', 'ditolak'];

    public const POLA_TANGGAL = '/^\d{4}-\d{2}-\d{2}(?: s\.d\. \d{4}-\d{2}-\d{2})?$/';

    /**
     * Empty values become null; an explicit zero remains zero.
     */
    public static function angka(mixed $nilai): int|float|null
    {
        if ($nilai === null) {
            return null;
        }

        if (is_string($nilai) && trim($nilai) === '') {
            return null;
        }

        if (is_string($nilai)) {
            $nilai = str_replace(',', '.', $nilai);
        }

        if (! is_numeric($nilai)) {
            return null;
        }

        $angka = (float) $nilai;

        return floor($angka) === $angka && $angka <= PHP_INT_MAX && $angka >= PHP_INT_MIN
            ? (int) $angka
            : $angka;
    }

    /**
     * JS-compatible truthiness used by the old API for checkboxes.
     */
    public static function boolean(mixed $nilai, bool $bawaan = false): bool
    {
        if ($nilai === null || $nilai === '') {
            return $bawaan;
        }

        return $nilai === true || $nilai === 1 || $nilai === '1' || $nilai === 'true';
    }

    public static function teks(mixed $nilai): string
    {
        return trim((string) ($nilai ?? ''));
    }

    /**
     * Generate the same short prefix style as the legacy application.
     */
    public static function newId(string $prefix = 'id'): string
    {
        return $prefix.'_'.base_convert((string) (int) floor(microtime(true) * 1000), 10, 36)
            .Str::lower(Str::random(6));
    }

    /**
     * A report-generated point uses a deterministic id so repeated
     * verification requests always point to the same row.
     */
    public static function idTitikLaporan(string $idLaporan): string
    {
        $idAman = preg_replace('/[^a-zA-Z0-9._-]/', '_', $idLaporan);
        $dasar = 'lpr_'.$idAman;

        if (strlen($dasar) <= 40) {
            return $dasar;
        }

        return 'lpr_'.substr(hash('sha256', $idLaporan), 0, 36);
    }
}

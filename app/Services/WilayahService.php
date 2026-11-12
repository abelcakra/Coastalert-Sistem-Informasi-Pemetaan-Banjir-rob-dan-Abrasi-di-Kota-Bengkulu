<?php

namespace App\Services;

use App\Support\Lokasi;
use RuntimeException;

/**
 * Point-in-polygon check against the official Kota Bengkulu boundary.
 *
 * This is a direct PHP port of the legacy ray-casting implementation,
 * including hole handling, MultiPolygon support and edge tolerance.
 */
class WilayahService
{
    private const EPS = 1e-12;

    /** @var array<int, array<int, array<int, array{0: float, 1: float}>>>|null */
    private static ?array $poligon = null;

    /**
     * @return array<int, array<int, array<int, array{0: float, 1: float}>>>
     */
    public function poligon(): array
    {
        if (self::$poligon !== null) {
            return self::$poligon;
        }

        $path = (string) config('coastalert.boundary_path');

        if (! is_file($path)) {
            throw new RuntimeException("Berkas batas Kota Bengkulu tidak ditemukan: {$path}");
        }

        $isi = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $poligon = $this->bacaGeometry($isi);

        if ($poligon === []) {
            throw new RuntimeException("Tidak ada polygon pada berkas batas: {$path}");
        }

        self::$poligon = $poligon;

        return self::$poligon;
    }

    public function klasifikasi(mixed $lat, mixed $lng): Lokasi
    {
        if ($lat === null || $lat === '' || $lng === null || $lng === '') {
            return new Lokasi('manual', 'Koordinat kosong.');
        }

        if (! is_numeric($lat) || ! is_numeric($lng)) {
            return new Lokasi('manual', 'Koordinat bukan angka yang valid.');
        }

        $la = (float) $lat;
        $ln = (float) $lng;

        if (! is_finite($la) || ! is_finite($ln)) {
            return new Lokasi('manual', 'Koordinat bukan angka yang valid.');
        }
        if ($la < -90 || $la > 90) {
            return new Lokasi('manual', 'Latitude di luar rentang -90..90.');
        }
        if ($ln < -180 || $ln > 180) {
            return new Lokasi('manual', 'Longitude di luar rentang -180..180.');
        }

        foreach ($this->poligon() as $poly) {
            $outer = $this->posisiDiCincin($ln, $la, $poly[0]);

            if ($outer === 'tepi') {
                return new Lokasi('dalam');
            }
            if ($outer !== 'dalam') {
                continue;
            }

            $diLubang = false;
            foreach (array_slice($poly, 1) as $hole) {
                $posisi = $this->posisiDiCincin($ln, $la, $hole);
                if ($posisi === 'tepi') {
                    return new Lokasi('dalam');
                }
                if ($posisi === 'dalam') {
                    $diLubang = true;
                    break;
                }
            }

            if (! $diLubang) {
                return new Lokasi('dalam');
            }
        }

        return new Lokasi('luar');
    }

    public function titikDiDalamKota(mixed $lat, mixed $lng): bool
    {
        return $this->klasifikasi($lat, $lng)->status === 'dalam';
    }

    /**
     * @param  array<string, mixed>  $geometry
     * @return array<int, array<int, array<int, array{0: float, 1: float}>>>
     */
    private function bacaGeometry(array $isi): array
    {
        if (($isi['type'] ?? null) === 'FeatureCollection') {
            $hasil = [];
            foreach ($isi['features'] ?? [] as $feature) {
                $hasil = array_merge($hasil, $this->daftarPoligon($feature['geometry'] ?? null));
            }

            return $hasil;
        }

        if (($isi['type'] ?? null) === 'Feature') {
            return $this->daftarPoligon($isi['geometry'] ?? null);
        }

        return $this->daftarPoligon($isi);
    }

    /**
     * @param  array<string, mixed>|null  $geometry
     * @return array<int, array<int, array<int, array{0: float, 1: float}>>>
     */
    private function daftarPoligon(?array $geometry): array
    {
        if (! isset($geometry['type'], $geometry['coordinates'])) {
            return [];
        }

        if ($geometry['type'] === 'Polygon') {
            return [$geometry['coordinates']];
        }

        if ($geometry['type'] === 'MultiPolygon') {
            return $geometry['coordinates'];
        }

        if ($geometry['type'] === 'GeometryCollection') {
            $hasil = [];
            foreach ($geometry['geometries'] ?? [] as $item) {
                $hasil = array_merge($hasil, $this->daftarPoligon($item));
            }

            return $hasil;
        }

        return [];
    }

    /**
     * @param  array<int, array{0: float, 1: float}>  $ring
     */
    private function posisiDiCincin(float $lng, float $lat, array $ring): string
    {
        $dalam = false;
        $jumlah = count($ring);

        for ($i = 0, $j = $jumlah - 1; $i < $jumlah; $j = $i++) {
            [$xi, $yi] = $ring[$i];
            [$xj, $yj] = $ring[$j];

            if ($this->diSegmen($lng, $lat, $xi, $yi, $xj, $yj)) {
                return 'tepi';
            }

            $memotong = (($yi > $lat) !== ($yj > $lat))
                && $lng < ((($xj - $xi) * ($lat - $yi)) / ($yj - $yi)) + $xi;

            if ($memotong) {
                $dalam = ! $dalam;
            }
        }

        return $dalam ? 'dalam' : 'luar';
    }

    private function diSegmen(
        float $x,
        float $y,
        float $ax,
        float $ay,
        float $bx,
        float $by,
    ): bool {
        $minX = min($ax, $bx) - self::EPS;
        $maxX = max($ax, $bx) + self::EPS;
        $minY = min($ay, $by) - self::EPS;
        $maxY = max($ay, $by) + self::EPS;

        if ($x < $minX || $x > $maxX || $y < $minY || $y > $maxY) {
            return false;
        }

        $cross = ($x - $ax) * ($by - $ay) - ($y - $ay) * ($bx - $ax);
        if (abs($cross) > self::EPS) {
            return false;
        }

        $dot = ($x - $ax) * ($x - $bx) + ($y - $ay) * ($y - $by);

        return $dot <= self::EPS;
    }
}

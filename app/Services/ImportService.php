<?php

namespace App\Services;

use App\Exceptions\ImportValidationException;
use App\Models\Spot;
use App\Support\Legacy;
use Illuminate\Support\Facades\DB;

class ImportService
{
    /**
     * @param  array<string, mixed>  $feature
     * @return array{error?: string, statusLokasi?: string, data?: array<string, mixed>}
     */
    public function dariFeature(array $feature): array
    {
        $props = is_array($feature['properties'] ?? null) ? $feature['properties'] : [];
        $geometry = is_array($feature['geometry'] ?? null) ? $feature['geometry'] : null;

        $posisi = [];
        if (($geometry['type'] ?? null) === 'Point' && isset($geometry['coordinates'][0], $geometry['coordinates'][1])) {
            $posisi = ['lat' => $geometry['coordinates'][1], 'lng' => $geometry['coordinates'][0]];
        } elseif ($geometry !== null) {
            $posisi = $this->centroid($geometry) ?? [];
        }

        $lat = $this->angka($this->ambil($props, 'lat', 'latitude', 'y'));
        $lng = $this->angka($this->ambil($props, 'lng', 'lon', 'long', 'longitude', 'x'));

        if ($lat === null) {
            $lat = $this->angka($posisi['lat'] ?? null);
        }
        if ($lng === null) {
            $lng = $this->angka($posisi['lng'] ?? null);
        }

        $jenis = $this->tebakJenis($this->ambil($props, 'jenis', 'jenis_ancaman', 'jenisAncaman', 'type', 'kategori_jenis'));
        $nama = $this->ambil($props, 'nama', 'nama_lokasi', 'name', 'kelurahan', 'lokasi') ?? 'Tanpa nama';
        $id = trim((string) ($this->ambil($props, 'id', 'kode', 'kode_titik') ?? ''));

        if ($lat === null || $lng === null) {
            return ['error' => 'Titik "'.$nama.'" tidak punya koordinat valid.'];
        }

        if ($lat < -90 || $lat > 90) {
            return ['error' => 'Titik "'.$nama.'" latitude di luar rentang -90 sampai 90.'];
        }

        if ($lng < -180 || $lng > 180) {
            return ['error' => 'Titik "'.$nama.'" longitude di luar rentang -180 sampai 180.'];
        }

        $lokasi = app(WilayahService::class)->klasifikasi($lat, $lng);
        if ($lokasi->status === 'manual') {
            return ['error' => 'Titik "'.$nama.'" tidak dapat diperiksa terhadap batas Kota Bengkulu: '.$lokasi->alasan];
        }

        if (! in_array($jenis, Legacy::JENIS, true)) {
            return ['error' => 'Titik "'.$nama.'" jenisnya tidak dikenali (isi "rob" atau "abrasi").'];
        }

        $jenisAncaman = trim((string) ($this->ambil($props, 'jenisAncaman', 'jenis_ancaman', 'ancaman') ?? ''));
        if ($jenisAncaman === '') {
            $jenisAncaman = $jenis === 'abrasi' ? 'Abrasi' : 'Banjir Rob';
        }

        $data = [
            'nama' => trim((string) $nama),
            'kecamatan' => trim((string) ($this->ambil($props, 'kecamatan', 'kec', 'district') ?? '')),
            'jenis' => $jenis,
            'jenisAncaman' => $jenisAncaman,
            'kategori' => $this->normalKategori($this->ambil($props, 'kategori', 'tingkat_rawan', 'tingkat', 'level', 'kelas')),
            'statusKoordinat' => $this->normalStatusKoordinat($this->ambil($props, 'statusKoordinat', 'status_koordinat', 'koordinat')),
            'lat' => $lat,
            'lng' => $lng,
            'tinggiRob' => $jenis === 'rob'
                ? $this->angka($this->ambil($props, 'tinggiRob', 'tinggi_rob', 'tinggi', 'height'))
                : null,
            'lajuAbrasi' => $jenis === 'abrasi'
                ? $this->angka($this->ambil($props, 'lajuAbrasi', 'laju_abrasi', 'laju', 'rate'))
                : null,
            'luasTerdampakHa' => $this->angka($this->ambil($props, 'luasTerdampakHa', 'luas', 'luas_ha', 'area_ha')),
            'kkTerdampak' => $this->angka($this->ambil($props, 'kkTerdampak', 'kk', 'jumlah_kk', 'keluarga')),
            'tahun' => $this->angka($this->ambil($props, 'tahun', 'year')),
            'tanggal' => trim((string) ($this->ambil($props, 'tanggal', 'date', 'tanggal_kejadian') ?? '')),
            'deskripsi' => trim((string) ($this->ambil($props, 'deskripsi', 'description', 'keterangan', 'ket') ?? '')),
            'sumber' => trim((string) ($this->ambil($props, 'sumber', 'sumber_data', 'source') ?? 'Import data GIS')),
            'terverifikasi' => $this->normalTerverifikasi($props),
        ];

        if ($id !== '') {
            $data['id'] = $id;
        }

        return ['statusLokasi' => $lokasi->status, 'data' => $data];
    }

    /**
     * @return array<int, array<int, string>>
     */
    public function parseCsv(string $teks): array
    {
        if (str_starts_with($teks, "\xEF\xBB\xBF")) {
            $teks = substr($teks, 3);
        }

        $teks = str_replace(["\r\n", "\r"], "\n", $teks);
        $baris = [];
        $row = [];
        $sel = '';
        $dalamKutip = false;
        $panjang = strlen($teks);

        for ($i = 0; $i < $panjang; $i++) {
            $c = $teks[$i];

            if ($dalamKutip) {
                if ($c === '"' && ($teks[$i + 1] ?? '') === '"') {
                    $sel .= '"';
                    $i++;
                } elseif ($c === '"') {
                    $dalamKutip = false;
                } else {
                    $sel .= $c;
                }
            } elseif ($c === '"') {
                $dalamKutip = true;
            } elseif ($c === ',' || $c === ';') {
                $row[] = $sel;
                $sel = '';
            } elseif ($c === "\n") {
                $row[] = $sel;
                $baris[] = $row;
                $row = [];
                $sel = '';
            } else {
                $sel .= $c;
            }
        }

        if ($sel !== '' || $row !== []) {
            $row[] = $sel;
            $baris[] = $row;
        }

        return array_values(array_filter(
            $baris,
            fn (array $r) => count(array_filter($r, fn ($s) => trim((string) $s) !== '')) > 0,
        ));
    }

    /**
     * @param  array<int, array<string, mixed>>  $features
     * @return array<string, mixed>
     */
    public function imporFeatures(array $features, bool $dryRun = false): array
    {
        $valid = [];
        $errors = [];

        foreach ($features as $feature) {
            $hasil = $this->dariFeature($feature);
            if (isset($hasil['error'])) {
                $errors[] = $hasil['error'];
                continue;
            }
            $valid[] = $hasil;
        }

        $ringkasan = ['berhasil' => 0, 'diperbarui' => 0, 'diarsipkan' => 0];

        if ($dryRun) {
            $indeks = $this->indeksTitik();
            foreach ($valid as $hasil) {
                try {
                    $simpan = $this->simpanTitik($hasil['data'], $hasil['statusLokasi'], $indeks, true);
                    if ($simpan['aksi'] === 'ditambah') {
                        $ringkasan['berhasil']++;
                    } else {
                        $ringkasan['diperbarui']++;
                    }
                    if ($simpan['statusLokasi'] !== 'dalam') {
                        $ringkasan['diarsipkan']++;
                    }
                } catch (ImportValidationException $e) {
                    $errors[] = 'Titik "'.$hasil['data']['nama'].'": '.$e->getMessage();
                }
            }

            return [
                ...$ringkasan,
                'gagal' => count($errors),
                'errors' => array_slice($errors, 0, 10),
                'dryRun' => true,
            ];
        }

        if ($valid === []) {
            return [
                ...$ringkasan,
                'gagal' => count($errors),
                'errors' => array_slice($errors, 0, 10),
                'dryRun' => false,
            ];
        }

        $hasil = DB::transaction(function () use ($valid, &$ringkasan, &$errors) {
            $indeks = $this->indeksTitik(true);
            foreach ($valid as $item) {
                try {
                    $simpan = $this->simpanTitik($item['data'], $item['statusLokasi'], $indeks, false);
                    if ($simpan['aksi'] === 'ditambah') {
                        $ringkasan['berhasil']++;
                    } else {
                        $ringkasan['diperbarui']++;
                    }
                    if ($simpan['statusLokasi'] !== 'dalam') {
                        $ringkasan['diarsipkan']++;
                    }
                } catch (ImportValidationException $e) {
                    $errors[] = 'Titik "'.$item['data']['nama'].'": '.$e->getMessage();
                }
            }

            return $ringkasan;
        });

        return [
            ...$hasil,
            'gagal' => count($errors),
            'errors' => array_slice($errors, 0, 10),
            'dryRun' => false,
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array{byId: array<string, array<string, mixed>>, byKey: array<string, array<string, mixed>>}  $indeks
     * @return array{aksi: string, statusLokasi: string}
     */
    private function simpanTitik(array $data, string $statusLokasi, array &$indeks, bool $dryRun): array
    {
        $kunci = $this->kunciTitik($data);
        $idData = $data['id'] ?? null;
        $existing = ($idData !== null ? ($indeks['byId'][$idData] ?? null) : null)
            ?? ($indeks['byKey'][$kunci] ?? null);

        if (($existing['statusLokasi'] ?? null) === 'dalam' && $statusLokasi !== 'dalam') {
            throw new ImportValidationException('Titik aktif yang sudah ada tidak boleh dipindahkan ke arsip oleh impor.');
        }

        if ($dryRun) {
            $id = $existing['id'] ?? $data['id'] ?? 'dry_'.(count($indeks['byId']) + 1);
            $simulasi = [...$data, 'id' => $id, 'statusLokasi' => $statusLokasi ?: ($existing['statusLokasi'] ?? 'dalam')];
            $indeks['byId'][$id] = $simulasi;
            $indeks['byKey'][$this->kunciTitik($simulasi)] = $simulasi;

            return [
                'aksi' => $existing ? 'diperbarui' : 'ditambah',
                'statusLokasi' => $simulasi['statusLokasi'],
            ];
        }

        $now = now();

        if ($existing !== null) {
            $spot = Spot::query()->where('id', $existing['id'])->firstOrFail();
            $patch = $data;
            unset($patch['id']);
            $spot->fill([...$patch, 'updatedAt' => $now]);
            $spot->save();

            $baris = $spot->refresh()->toArray();
            $indeks['byId'][$baris['id']] = $baris;
            $indeks['byKey'][$this->kunciTitik($baris)] = $baris;

            return ['aksi' => 'diperbarui', 'statusLokasi' => $statusLokasi];
        }

        $id = $data['id'] ?? Legacy::newId('sp');
        $barisData = [...$data, 'id' => $id, 'createdAt' => $now, 'updatedAt' => $now];
        $spot = Spot::query()->create($barisData);
        $baris = $spot->refresh()->toArray();
        $indeks['byId'][$baris['id']] = $baris;
        $indeks['byKey'][$this->kunciTitik($baris)] = $baris;

        return ['aksi' => 'ditambah', 'statusLokasi' => $statusLokasi];
    }

    /**
     * @return array{byId: array<string, array<string, mixed>>, byKey: array<string, array<string, mixed>>}
     */
    private function indeksTitik(bool $forUpdate = false): array
    {
        $query = Spot::query()->orderBy('seq');
        if ($forUpdate) {
            $query->lockForUpdate();
        }

        $byId = [];
        $byKey = [];
        foreach ($query->get() as $spot) {
            $baris = $spot->toArray();
            $byId[$baris['id']] = $baris;
            $byKey[$this->kunciTitik($baris)] = $baris;
        }

        return ['byId' => $byId, 'byKey' => $byKey];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function kunciTitik(array $data): string
    {
        return implode('|', [
            strtolower(trim((string) ($data['nama'] ?? ''))),
            number_format((float) ($data['lat'] ?? 0), 6, '.', ''),
            number_format((float) ($data['lng'] ?? 0), 6, '.', ''),
            (string) ($data['jenis'] ?? ''),
        ]);
    }

    public function pesanImpor(array $ringkasan, string $sumber): string
    {
        $mode = $ringkasan['dryRun'] ? ' (dry-run, tidak ditulis)' : '';

        return $ringkasan['berhasil'].' ditambahkan, '.$ringkasan['diperbarui'].' diperbarui, '
            .$ringkasan['diarsipkan'].' diarsipkan, '.$ringkasan['gagal'].' gagal dari '
            .$sumber.$mode.'.';
    }

    private function ambil(array $obj, string ...$kandidat): mixed
    {
        foreach ($kandidat as $kunci) {
            foreach ([$kunci, strtolower($kunci), strtoupper($kunci)] as $k) {
                if (! array_key_exists($k, $obj)) {
                    continue;
                }

                $nilai = $obj[$k];
                if ($nilai !== null && trim((string) $nilai) !== '') {
                    return $nilai;
                }
            }
        }

        return null;
    }

    private function tebakJenis(mixed $nilai): ?string
    {
        $teks = strtolower((string) ($nilai ?? ''));
        if (str_contains($teks, 'abrasi') || str_contains($teks, 'erosi') || str_contains($teks, 'erosion')) {
            return 'abrasi';
        }
        if (str_contains($teks, 'rob') || str_contains($teks, 'flood') || str_contains($teks, 'banjir')) {
            return 'rob';
        }

        return null;
    }

    private function normalKategori(mixed $nilai): ?string
    {
        $teks = strtolower((string) ($nilai ?? ''));
        if (str_contains($teks, 'tinggi') || str_contains($teks, 'high')) {
            return 'Tinggi';
        }
        if (str_contains($teks, 'sedang') || str_contains($teks, 'medium')) {
            return 'Sedang';
        }
        if (str_contains($teks, 'rendah') || str_contains($teks, 'low')) {
            return 'Rendah';
        }

        return in_array($nilai, Legacy::KATEGORI, true) ? $nilai : null;
    }

    private function normalStatusKoordinat(mixed $nilai): string
    {
        $teks = strtolower((string) ($nilai ?? ''));
        if (str_contains($teks, 'referensi')) {
            return 'referensi_lokasi';
        }
        if (str_contains($teks, 'terverifikasi') || str_contains($teks, 'terukur')) {
            return 'terverifikasi';
        }

        return 'perkiraan';
    }

    /**
     * @param  array<string, mixed>  $props
     */
    private function normalTerverifikasi(array $props): bool
    {
        $nilai = $this->ambil($props, 'terverifikasi', 'verified', 'statusVerifikasi');

        return $nilai === true || $nilai === 1 || $nilai === '1' || $nilai === 'true' || $nilai === 'terverifikasi';
    }

    /**
     * @param  array<string, mixed>  $geometry
     * @return array{lat: float, lng: float}|null
     */
    private function centroid(array $geometry): ?array
    {
        if (! isset($geometry['coordinates'])) {
            return null;
        }

        $titik = [];
        $telusuri = function (mixed $c) use (&$telusuri, &$titik): void {
            if (is_array($c) && isset($c[0], $c[1]) && is_numeric($c[0]) && is_numeric($c[1])) {
                $titik[] = [(float) $c[0], (float) $c[1]];

                return;
            }

            if (is_array($c)) {
                foreach ($c as $item) {
                    $telusuri($item);
                }
            }
        };
        $telusuri($geometry['coordinates']);

        if ($titik === []) {
            return null;
        }

        $lng = array_sum(array_column($titik, 0)) / count($titik);
        $lat = array_sum(array_column($titik, 1)) / count($titik);

        return ['lat' => $lat, 'lng' => $lng];
    }

    private function angka(mixed $nilai): int|float|null
    {
        return Legacy::angka($nilai);
    }
}

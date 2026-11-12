<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;

class PhotoService
{
    private const MIME_DIIZINKAN = [
        'image/jpeg' => 'jpeg',
        'image/jpg' => 'jpeg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    private const EKSTENSI_DIIZINKAN = [
        'jpeg' => ['.jpg', '.jpeg'],
        'png' => ['.png'],
        'webp' => ['.webp'],
    ];

    private const EKSTENSI_SIMPAN = [
        'jpeg' => '.jpg',
        'png' => '.png',
        'webp' => '.webp',
    ];

    /**
     * @return array{ok: bool, ekstensi?: string|null, error?: string}
     */
    public function validasi(?UploadedFile $file): array
    {
        if ($file === null) {
            return ['ok' => true, 'ekstensi' => null];
        }

        if (! $file->isValid() || $file->getSize() === 0) {
            return ['ok' => false, 'error' => 'Berkas foto kosong atau tidak dapat dibaca.'];
        }

        if ($file->getSize() > ((int) config('coastalert.max_photo_kb', 5120)) * 1024) {
            return ['ok' => false, 'error' => 'Ukuran foto maksimal 5 MB.'];
        }

        $formatDariMime = self::MIME_DIIZINKAN[strtolower((string) $file->getClientMimeType())] ?? null;
        if ($formatDariMime === null) {
            return ['ok' => false, 'error' => 'Hanya foto JPG, PNG, atau WebP yang diizinkan.'];
        }

        $ekstensi = strtolower(pathinfo((string) $file->getClientOriginalName(), PATHINFO_EXTENSION));
        $ekstensi = $ekstensi !== '' ? '.'.$ekstensi : '';
        if (! in_array($ekstensi, self::EKSTENSI_DIIZINKAN[$formatDariMime], true)) {
            return ['ok' => false, 'error' => 'Ekstensi berkas tidak sesuai dengan jenis gambarnya.'];
        }

        $buffer = (string) file_get_contents($file->getRealPath());
        if ($this->deteksiFormatGambar($buffer) !== $formatDariMime) {
            return ['ok' => false, 'error' => 'Isi berkas tidak sesuai dengan tipe gambar yang diunggah.'];
        }

        return ['ok' => true, 'ekstensi' => self::EKSTENSI_SIMPAN[$formatDariMime]];
    }

    /**
     * @return string|null Public path like /uploads/laporan_...png.
     */
    public function simpan(UploadedFile $file, ?string $ekstensi): ?string
    {
        if ($ekstensi === null) {
            return null;
        }

        $dir = (string) config('coastalert.upload_dir');
        if (! is_dir($dir) && ! mkdir($dir, 0775, true) && ! is_dir($dir)) {
            throw new \RuntimeException('Folder unggahan tidak dapat dibuat.');
        }

        $nama = 'laporan_'.now()->getTimestampMs().'_'.bin2hex(random_bytes(6)).$ekstensi;
        $tujuan = $dir.DIRECTORY_SEPARATOR.$nama;

        if (file_put_contents($tujuan, (string) file_get_contents($file->getRealPath()), LOCK_EX) === false) {
            throw new \RuntimeException('Foto laporan tidak dapat disimpan.');
        }

        return '/uploads/'.$nama;
    }

    public function hapus(?string $foto): bool
    {
        if (! is_string($foto) || ! str_starts_with($foto, '/uploads/')) {
            return false;
        }

        $nama = basename($foto);
        if ($nama === '' || $nama !== substr($foto, strlen('/uploads/'))) {
            return false;
        }

        $tujuan = rtrim((string) config('coastalert.upload_dir'), DIRECTORY_SEPARATOR)
            .DIRECTORY_SEPARATOR.$nama;

        if (! is_file($tujuan)) {
            return false;
        }

        return @unlink($tujuan) === true;
    }

    public function deteksiFormatGambar(string $buffer): ?string
    {
        if (strlen($buffer) < 12) {
            return null;
        }

        if (ord($buffer[0]) === 0xFF && ord($buffer[1]) === 0xD8 && ord($buffer[2]) === 0xFF) {
            return 'jpeg';
        }

        if (
            ord($buffer[0]) === 0x89
            && substr($buffer, 1, 3) === 'PNG'
            && ord($buffer[4]) === 0x0D
            && ord($buffer[5]) === 0x0A
            && ord($buffer[6]) === 0x1A
            && ord($buffer[7]) === 0x0A
        ) {
            return 'png';
        }

        if (substr($buffer, 0, 4) === 'RIFF' && substr($buffer, 8, 4) === 'WEBP') {
            return 'webp';
        }

        return null;
    }
}

<?php

namespace Tests\Unit;

use App\Services\PhotoService;
use Tests\TestCase;

class PhotoServiceTest extends TestCase
{
    public function test_magic_bytes_detect_supported_image_formats(): void
    {
        $service = app(PhotoService::class);

        $png = base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Z7sAAAAASUVORK5CYII=',
            true,
        );

        $this->assertSame('png', $service->deteksiFormatGambar((string) $png));
        $this->assertSame('jpeg', $service->deteksiFormatGambar("\xFF\xD8\xFF\xE0".str_repeat("\0", 20)));
        $this->assertSame('webp', $service->deteksiFormatGambar('RIFF'.pack('V', 0).'WEBP'.str_repeat("\0", 8)));
        $this->assertNull($service->deteksiFormatGambar('too short'));
        $this->assertNull($service->deteksiFormatGambar(str_repeat('x', 40)));
    }

    public function test_delete_only_accepts_paths_inside_the_upload_directory(): void
    {
        $service = app(PhotoService::class);

        $this->assertFalse($service->hapus(null));
        $this->assertFalse($service->hapus('/uploads/'));
        $this->assertFalse($service->hapus('/uploads/../.env'));
        $this->assertFalse($service->hapus('/uploads/missing-file.png'));
    }
}

<?php

namespace App\Support;

final class Lokasi
{
    public function __construct(
        public readonly string $status,
        public readonly ?string $alasan = null,
    ) {
    }
}

<?php

namespace App\Services;

use App\Models\Report;

class ReportCodeService
{
    public function buat(): string
    {
        for ($i = 0; $i < 50; $i++) {
            $kode = 'CL-'.random_int(100000, 999999);
            if (! Report::query()->where('kode', $kode)->exists()) {
                return $kode;
            }
        }

        return 'CL-'.substr((string) now()->getTimestampMs(), -6);
    }
}

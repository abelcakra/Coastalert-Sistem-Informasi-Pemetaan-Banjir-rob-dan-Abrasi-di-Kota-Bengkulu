<?php

namespace App\Models;

use App\Services\WilayahService;
use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = 'id';

    protected $keyType = 'string';

    protected $hidden = ['seq'];

    protected $fillable = [
        'id',
        'kode',
        'jenis',
        'namaPelapor',
        'kontak',
        'alamat',
        'kecamatan',
        'lat',
        'lng',
        'deskripsi',
        'tanggal',
        'foto',
        'status',
        'catatanAdmin',
        'createdAt',
        'updatedAt',
    ];

    protected $casts = [
        'lat' => 'float',
        'lng' => 'float',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    protected $appends = ['statusLokasi'];

    public function getStatusLokasiAttribute(): string
    {
        return app(WilayahService::class)
            ->klasifikasi($this->attributes['lat'] ?? null, $this->attributes['lng'] ?? null)
            ->status;
    }

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\TH:i:s.v\Z');
    }
}

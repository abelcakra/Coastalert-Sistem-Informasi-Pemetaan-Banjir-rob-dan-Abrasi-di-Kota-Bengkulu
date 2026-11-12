<?php

namespace App\Models;

use App\Services\WilayahService;
use Illuminate\Database\Eloquent\Model;

class Spot extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = 'id';

    protected $keyType = 'string';

    protected $hidden = ['seq'];

    protected $fillable = [
        'id',
        'nama',
        'kecamatan',
        'jenis',
        'jenisAncaman',
        'kategori',
        'statusKoordinat',
        'lat',
        'lng',
        'tinggiRob',
        'lajuAbrasi',
        'luasTerdampakHa',
        'kkTerdampak',
        'tahun',
        'tanggal',
        'deskripsi',
        'sumber',
        'terverifikasi',
        'createdAt',
        'updatedAt',
    ];

    protected $casts = [
        'lat' => 'float',
        'lng' => 'float',
        'tinggiRob' => 'float',
        'lajuAbrasi' => 'float',
        'luasTerdampakHa' => 'float',
        'kkTerdampak' => 'integer',
        'tahun' => 'integer',
        'terverifikasi' => 'boolean',
        'createdAt' => 'datetime',
        'updatedAt' => 'datetime',
    ];

    protected $appends = ['statusLokasi', 'statusVerifikasi'];

    public function getStatusLokasiAttribute(): string
    {
        return app(WilayahService::class)
            ->klasifikasi($this->attributes['lat'] ?? null, $this->attributes['lng'] ?? null)
            ->status;
    }

    public function getStatusVerifikasiAttribute(): string
    {
        return $this->terverifikasi ? 'terverifikasi' : 'perlu_verifikasi';
    }

    protected function serializeDate(\DateTimeInterface $date): string
    {
        return $date->format('Y-m-d\TH:i:s.v\Z');
    }
}

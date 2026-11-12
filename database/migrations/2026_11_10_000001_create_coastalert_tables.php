<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The legacy application stored these two tables with camelCase columns.
     * The DDL is kept intentionally close to the original MySQL schema so the
     * existing records and API payloads can be used without a data rewrite.
     */
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE `spots` (
              `seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              `id` VARCHAR(40) NOT NULL,
              `nama` VARCHAR(150) NOT NULL,
              `kecamatan` VARCHAR(100) NOT NULL DEFAULT '',
              `jenis` ENUM('rob','abrasi') NOT NULL,
              `jenisAncaman` VARCHAR(100) NOT NULL DEFAULT '',
              `kategori` ENUM('Rendah','Sedang','Tinggi') DEFAULT NULL,
              `statusKoordinat` ENUM('perkiraan','referensi_lokasi','terverifikasi') NOT NULL DEFAULT 'perkiraan',
              `lat` DOUBLE NOT NULL,
              `lng` DOUBLE NOT NULL,
              `tinggiRob` DOUBLE DEFAULT NULL,
              `lajuAbrasi` DOUBLE DEFAULT NULL,
              `luasTerdampakHa` DOUBLE DEFAULT NULL,
              `kkTerdampak` INT DEFAULT NULL,
              `tahun` INT DEFAULT NULL,
              `tanggal` VARCHAR(40) DEFAULT NULL,
              `deskripsi` TEXT,
              `sumber` VARCHAR(200) DEFAULT '',
              `terverifikasi` TINYINT(1) NOT NULL DEFAULT 0,
              `createdAt` DATETIME DEFAULT NULL,
              `updatedAt` DATETIME DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `seq` (`seq`),
              KEY `idx_spots_jenis` (`jenis`),
              KEY `idx_spots_kecamatan` (`kecamatan`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL);

        DB::statement(<<<'SQL'
            CREATE TABLE `reports` (
              `seq` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
              `id` VARCHAR(40) NOT NULL,
              `kode` VARCHAR(20) DEFAULT NULL,
              `jenis` ENUM('rob','abrasi') NOT NULL DEFAULT 'rob',
              `namaPelapor` VARCHAR(150) NOT NULL,
              `kontak` VARCHAR(100) DEFAULT '',
              `alamat` VARCHAR(255) DEFAULT '',
              `kecamatan` VARCHAR(100) DEFAULT '',
              `lat` DOUBLE NOT NULL,
              `lng` DOUBLE NOT NULL,
              `deskripsi` TEXT,
              `tanggal` DATE DEFAULT NULL,
              `foto` VARCHAR(255) DEFAULT NULL,
              `status` ENUM('pending','diverifikasi','ditolak') NOT NULL DEFAULT 'pending',
              `catatanAdmin` TEXT,
              `createdAt` DATETIME DEFAULT NULL,
              `updatedAt` DATETIME DEFAULT NULL,
              PRIMARY KEY (`id`),
              UNIQUE KEY `seq` (`seq`),
              UNIQUE KEY `kode` (`kode`),
              KEY `idx_reports_status` (`status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
        Schema::dropIfExists('spots');
    }
};

/**
 * Skema tabel bersama untuk pengujian.
 *
 * Helper ini hanya dipakai file test dan tidak diimpor runtime aplikasi.
 * Skema produksi tetap dikelola oleh scripts/setup-db.mjs.
 *
 * Perbedaan yang dipertahankan:
 * - phase2-arsip.test.mjs membuat tabel tanpa index tambahan;
 * - test lain memakai index yang sama dengan skema produksi.
 */

const SPOTS_KOLOM = `
    seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    nama VARCHAR(150) NOT NULL,
    kecamatan VARCHAR(100) NOT NULL DEFAULT '',
    jenis ENUM('rob','abrasi') NOT NULL,
    jenisAncaman VARCHAR(100) NOT NULL DEFAULT '',
    kategori ENUM('Rendah','Sedang','Tinggi') NULL DEFAULT NULL,
    statusKoordinat ENUM('perkiraan','referensi_lokasi','terverifikasi') NOT NULL DEFAULT 'perkiraan',
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    tinggiRob DOUBLE NULL,
    lajuAbrasi DOUBLE NULL,
    luasTerdampakHa DOUBLE NULL,
    kkTerdampak INT NULL,
    tahun INT NULL,
    tanggal VARCHAR(40) NULL,
    deskripsi TEXT,
    sumber VARCHAR(200) DEFAULT '',
    terverifikasi TINYINT(1) NOT NULL DEFAULT 0,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL`;

const SPOTS_INDEX = `,
    INDEX idx_spots_jenis (jenis),
    INDEX idx_spots_kecamatan (kecamatan)`;

const REPORTS_KOLOM = `
    seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
    id VARCHAR(40) NOT NULL PRIMARY KEY,
    kode VARCHAR(20) NULL UNIQUE,
    jenis ENUM('rob','abrasi') NOT NULL DEFAULT 'rob',
    namaPelapor VARCHAR(150) NOT NULL,
    kontak VARCHAR(100) DEFAULT '',
    alamat VARCHAR(255) DEFAULT '',
    kecamatan VARCHAR(100) DEFAULT '',
    lat DOUBLE NOT NULL,
    lng DOUBLE NOT NULL,
    deskripsi TEXT,
    tanggal DATE NULL,
    foto VARCHAR(255) NULL,
    status ENUM('pending','diverifikasi','ditolak') NOT NULL DEFAULT 'pending',
    catatanAdmin TEXT,
    createdAt DATETIME NULL,
    updatedAt DATETIME NULL`;

const REPORTS_INDEX = `,
    INDEX idx_reports_status (status)`;

export function ddlSpots({ indexes = true } = {}) {
  return `CREATE TABLE spots (${SPOTS_KOLOM}${indexes ? SPOTS_INDEX : ''}
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
}

export function ddlReports({ indexes = true } = {}) {
  return `CREATE TABLE reports (${REPORTS_KOLOM}${indexes ? REPORTS_INDEX : ''}
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
}

export const DDL_SPOTS = ddlSpots();
export const DDL_REPORTS = ddlReports();

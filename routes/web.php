<?php

use App\Http\Controllers\PageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes - CoastAlert
|--------------------------------------------------------------------------
|
| Rute aplikasi web CoastAlert:
| - Halaman publik: Beranda, Peta Interaktif, Statistik, Lapor Kejadian, Status Laporan
| - Panel admin: Prefix 'admin', nama rute 'admin.*'
|
*/

// Halaman Publik
Route::get('/', [PageController::class, 'index'])->name('home');
Route::get('/peta', [PageController::class, 'peta'])->name('peta');
Route::get('/dashboard', [PageController::class, 'dashboard'])->name('dashboard');
Route::get('/laporan', [PageController::class, 'laporan'])->name('laporan');
Route::get('/status', [PageController::class, 'status'])->name('status');

// Halaman Panel Admin
Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [PageController::class, 'adminRedirect'])->name('index');
    Route::get('/login', [PageController::class, 'adminLogin'])->name('login');
    Route::get('/dashboard', [PageController::class, 'adminDashboard'])->name('dashboard');
    Route::get('/peta', [PageController::class, 'adminPeta'])->name('peta');
    Route::get('/data-laporan', [PageController::class, 'adminDataLaporan'])->name('data-laporan');
    Route::get('/verifikasi', [PageController::class, 'adminVerifikasi'])->name('verifikasi');
    Route::get('/titik', [PageController::class, 'adminTitik'])->name('titik');
});

<?php

use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ImportController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SpotController;
use App\Http\Controllers\Api\StatsController;
use Illuminate\Support\Facades\Route;

Route::middleware('api.nostore')->group(function () {
    Route::post('/admin/login', [AdminAuthController::class, 'login'])
        ->middleware('throttle.legacy:login-admin,10,900');
    Route::post('/admin/logout', [AdminAuthController::class, 'logout'])
        ->middleware('admin.token');
    Route::get('/admin/cek', [AdminAuthController::class, 'cek'])
        ->middleware('admin.token');

    Route::get('/spots', [SpotController::class, 'index']);
    Route::get('/spots/{id}', [SpotController::class, 'show']);
    Route::post('/spots', [SpotController::class, 'store'])->middleware('admin.token');
    Route::put('/spots/{id}', [SpotController::class, 'update'])->middleware('admin.token');
    Route::delete('/spots/{id}', [SpotController::class, 'destroy'])->middleware('admin.token');

    Route::post('/reports', [ReportController::class, 'store'])
        ->middleware('throttle.legacy:kirim-laporan,10,900');
    Route::get('/reports/publik', [ReportController::class, 'publik']);
    Route::get('/reports/lacak/{kode}', [ReportController::class, 'lacak'])
        ->middleware('throttle.legacy:lacak-laporan,30,600');
    Route::get('/reports', [ReportController::class, 'index'])->middleware('admin.token');
    Route::patch('/reports/{id}', [ReportController::class, 'update'])->middleware('admin.token');
    Route::delete('/reports/{id}', [ReportController::class, 'destroy'])->middleware('admin.token');

    Route::get('/stats', [StatsController::class, 'index']);
    Route::get('/stats/admin', [StatsController::class, 'admin'])->middleware('admin.token');
    Route::get('/stats/meta', [StatsController::class, 'meta']);

    Route::post('/import/geojson', [ImportController::class, 'geojson'])->middleware('admin.token');
    Route::post('/import/csv', [ImportController::class, 'csv'])->middleware('admin.token');

    Route::get('/chat/status', [ChatController::class, 'status'])
        ->middleware('throttle.legacy:chat-status,60,60');
    Route::post('/chat', [ChatController::class, 'store'])
        ->middleware('throttle.legacy:chat,20,600');

    Route::get('/', function () {
        return response()->json([
            'nama' => 'CoastAlert API',
            'endpoints' => [
                'GET  /api/spots',
                'GET  /api/spots/:id',
                'POST /api/spots (admin)',
                'PUT  /api/spots/:id (admin)',
                'DELETE /api/spots/:id (admin)',
                'POST /api/reports (publik)',
                'GET  /api/reports/lacak/:kode (publik)',
                'GET  /api/reports (admin)',
                'PATCH /api/reports/:id (admin)',
                'GET  /api/stats (publik)',
                'GET  /api/stats/admin (admin)',
                'GET  /api/stats/meta',
                'POST /api/import/geojson (admin)',
                'POST /api/import/csv (admin)',
                'GET  /api/chat/status (status layanan Ollama)',
                'POST /api/chat (asisten HARA via Ollama)',
            ],
        ]);
    });

    Route::any('/{any}', function () {
        return response()->json(['error' => 'Endpoint tidak ditemukan.'], 404);
    })->where('any', '.*');
});

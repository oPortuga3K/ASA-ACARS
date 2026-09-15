<?php

use Illuminate\Support\Facades\Route;
use Modules\AsaCore\Http\Controllers\Api\ConfigController;
use Modules\AsaCore\Http\Controllers\Api\HeartbeatController;
use Modules\AsaCore\Http\Controllers\Api\LandingController;
use Modules\AsaCore\Http\Controllers\Api\RunwayController;

// Public
Route::get('/version', [ConfigController::class, 'version']);

// Authenticated
Route::middleware('api.auth')->group(function () {
    Route::get('/config', [ConfigController::class, 'index']);
    Route::post('/heartbeat', [HeartbeatController::class, 'store']);
    Route::post('/pirep/{id}/landing', [LandingController::class, 'store']);
    Route::post('/runway-data/missing', [RunwayController::class, 'store']);
});
<?php

use Illuminate\Support\Facades\Route;
use Modules\AsaVATraffic\Http\Controllers\Api\TrafficController;

Route::middleware('api.auth')->group(function () {
    Route::get('/live', [TrafficController::class, 'live']);
    Route::get('/pilot/{id}', [TrafficController::class, 'pilot']);
});
<?php

use Illuminate\Support\Facades\Route;
use Modules\AsaLogbook\Http\Controllers\Api\LogbookController;

Route::middleware('api.auth')->group(function () {
    Route::get('/stats', [LogbookController::class, 'stats']);
    Route::get('/pireps', [LogbookController::class, 'pireps']);
    Route::get('/pireps/{id}', [LogbookController::class, 'pirep']);
});
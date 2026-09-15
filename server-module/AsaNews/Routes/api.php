<?php

use Illuminate\Support\Facades\Route;
use Modules\AsaNews\Http\Controllers\Api\NewsController;

Route::middleware('api.auth')->group(function () {
    Route::get('/unread-count', [NewsController::class, 'unreadCount']);
    Route::post('/mark-read', [NewsController::class, 'markRead']);
    Route::get('/list', [NewsController::class, 'list']);
});
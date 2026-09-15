<?php

namespace Modules\AsaLogbook\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;

class RouteServiceProvider extends ServiceProvider
{
    protected $moduleNamespace = 'Modules\\AsaLogbook\\Http\\Controllers';

    public function boot() { parent::boot(); }

    public function map()
    {
        Route::prefix('api/asalogbook')
            ->middleware('api')
            ->namespace($this->moduleNamespace . '\\Api')
            ->group(module_path('AsaLogbook', 'Routes/api.php'));
    }
}
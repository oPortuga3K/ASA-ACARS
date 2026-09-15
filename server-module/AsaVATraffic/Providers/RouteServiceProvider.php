<?php

namespace Modules\AsaVATraffic\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;

class RouteServiceProvider extends ServiceProvider
{
    protected $moduleNamespace = 'Modules\\AsaVATraffic\\Http\\Controllers';

    public function boot() { parent::boot(); }

    public function map()
    {
        Route::prefix('api/asavatraffic')
            ->middleware('api')
            ->namespace($this->moduleNamespace . '\\Api')
            ->group(module_path('AsaVATraffic', 'Routes/api.php'));
    }
}
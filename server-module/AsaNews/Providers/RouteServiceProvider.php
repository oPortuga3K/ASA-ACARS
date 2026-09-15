<?php

namespace Modules\AsaNews\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;

class RouteServiceProvider extends ServiceProvider
{
    protected $moduleNamespace = 'Modules\\AsaNews\\Http\\Controllers';

    public function boot() { parent::boot(); }

    public function map()
    {
        Route::prefix('api/asanews')
            ->middleware('api')
            ->namespace($this->moduleNamespace . '\\Api')
            ->group(module_path('AsaNews', 'Routes/api.php'));
    }
}
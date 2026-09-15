<?php

namespace Modules\AsaCore\Providers;

use Illuminate\Support\Facades\Route;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;

class RouteServiceProvider extends ServiceProvider
{
    protected $moduleNamespace = 'Modules\\AsaCore\\Http\\Controllers';

    public function boot() { parent::boot(); }

    public function map()
    {
        $this->mapApiRoutes();
    }

    protected function mapApiRoutes()
    {
        Route::prefix('api/asacore')
            ->middleware('api')
            ->namespace($this->moduleNamespace . '\\Api')
            ->group(module_path('AsaCore', 'Routes/api.php'));
    }
}
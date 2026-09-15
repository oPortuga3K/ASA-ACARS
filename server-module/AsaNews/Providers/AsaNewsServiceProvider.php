<?php

namespace Modules\AsaNews\Providers;

use Illuminate\Support\ServiceProvider;

class AsaNewsServiceProvider extends ServiceProvider
{
    public function boot()
    {
        $this->loadMigrationsFrom(module_path('AsaNews', 'Database/Migrations'));
    }
    public function register()
    {
        $this->app->register(RouteServiceProvider::class);
    }
}
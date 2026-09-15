<?php

namespace Modules\AsaCore\Providers;

use Illuminate\Support\ServiceProvider;

class AsaCoreServiceProvider extends ServiceProvider
{
    public function boot()
    {
        $this->registerConfig();
        $this->loadMigrationsFrom(module_path('AsaCore', 'Database/Migrations'));
    }

    public function register()
    {
        $this->app->register(RouteServiceProvider::class);
        $this->mergeConfigFrom(module_path('AsaCore', 'Config/config.php'), 'asacore');
    }

    protected function registerConfig()
    {
        $this->publishes([
            module_path('AsaCore', 'Config/config.php') => config_path('asacore.php'),
        ], 'config');
        $this->mergeConfigFrom(module_path('AsaCore', 'Config/config.php'), 'asacore');
    }
}
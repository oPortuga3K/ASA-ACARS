<?php

namespace Modules\AsaVATraffic\Providers;

use Illuminate\Support\ServiceProvider;

class AsaVATrafficServiceProvider extends ServiceProvider
{
    public function boot() {}
    public function register()
    {
        $this->app->register(RouteServiceProvider::class);
    }
}
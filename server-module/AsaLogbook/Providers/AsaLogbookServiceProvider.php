<?php

namespace Modules\AsaLogbook\Providers;

use Illuminate\Support\ServiceProvider;

class AsaLogbookServiceProvider extends ServiceProvider
{
    public function boot() {}
    public function register()
    {
        $this->app->register(RouteServiceProvider::class);
    }
}
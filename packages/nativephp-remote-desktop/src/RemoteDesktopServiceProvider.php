<?php

namespace BudgetWeb\NativePHPRemoteDesktop;

use Illuminate\Support\ServiceProvider;

class RemoteDesktopServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RemoteDesktopManager::class);
    }
}

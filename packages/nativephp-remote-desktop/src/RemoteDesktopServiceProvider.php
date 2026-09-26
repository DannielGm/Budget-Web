<?php

namespace BudgetWeb\NativePHPRemoteDesktop;

use Illuminate\Support\ServiceProvider;

class RemoteDesktopServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(RemoteDesktopManager::class);
    }

    public function boot(): void
    {
        // Registered here rather than left to the hook name alone, so the command
        // is resolvable when the plugin compiler invokes it.
        if ($this->app->runningInConsole()) {
            $this->commands([
                Commands\PatchAndroidBridgeCommand::class,
            ]);
        }
    }
}

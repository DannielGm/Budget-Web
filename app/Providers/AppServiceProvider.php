<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->booting(function () {
            // NativePHP Mobile's JumpBridge adds a ~2.0s timeout to every request off-device.
            // We mute it early in the boot cycle to keep local web development fast.
            // Live native:jump sessions and real devices are unaffected.
            if (class_exists(\Native\Mobile\Bridge\JumpBridge::class) && !env('NATIVEPHP_KEEP_BRIDGE') && !env('JUMP_BRIDGE_PORT')) {
                \Native\Mobile\Bridge\JumpBridge::mute();
            }
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);
    }
}

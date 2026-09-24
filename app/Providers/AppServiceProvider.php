<?php

namespace App\Providers;

use App\Listeners\RestorePickedBackup;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;

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
            if (class_exists(\Native\Mobile\JumpBridge::class) && !env('NATIVEPHP_KEEP_BRIDGE') && !env('JUMP_BRIDGE_PORT')) {
                \Native\Mobile\JumpBridge::instance()->mute();
            }
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        // The document picker's native half only exists in a build that compiled
        // the plugin in, but its event class ships with the package either way —
        // so the listener is bound to the presence of the class, and an app
        // without the picker simply never hears from it.
        if (class_exists(DocumentPicked::class)) {
            Event::listen(DocumentPicked::class, RestorePickedBackup::class);
        }
    }
}

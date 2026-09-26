<?php

namespace App\Providers;

use App\Listeners\RestorePickedBackup;
use Illuminate\Foundation\Http\Events\RequestHandled;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;
use Tighten\Ziggy\BladeRouteGenerator;

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
            //
            // The guard is NATIVEPHP_RUNNING, which the native runtime sets with a plain
            // C setenv() before php_embed_init and mirrors into $_SERVER — so it is a
            // direct, race-free read with no bridge round-trip to fail during early boot.
            //
            // The original guard keyed off the absence of JUMP_BRIDGE_PORT. That env var is
            // a Jump-mode dev flag and is never set in a normal build, so the condition was
            // true inside the compiled app too and the bridge got muted on-device. With the
            // bridge muted, Platform::current() could not reach it and reported null, so
            // every capability (isNative/canSave/canPick/canShare) came back false and the
            // app fell back to the two transports a WebView cannot perform: a
            // Content-Disposition download it silently drops, and a file input with no
            // chooser behind it — which is exactly how backup import/export broke.
            if (class_exists(\Native\Mobile\JumpBridge::class)
                && ! $this->runningOnDevice()
                && ! env('NATIVEPHP_KEEP_BRIDGE')
                && ! env('JUMP_BRIDGE_PORT')) {
                \Native\Mobile\JumpBridge::instance()->mute();
            }
        });

        // Ziggy remembers "I already emitted the routes script" in a static
        // property, and the only thing that clears it is Octane's RequestReceived
        // event. Octane is not installed here, but the compiled app has the same
        // problem for a different reason: NativePHP boots the embedded interpreter
        // once and keeps it warm for the life of the process, so the static
        // survives every request.
        //
        // From the second response onward Ziggy therefore emitted its *merge*
        // script (`Object.assign(Ziggy.routes, ...)`), which references a global
        // `Ziggy` that response never declared — so the page threw
        // "Ziggy is not defined" on the line the script sits on, and because the
        // route helper was declared in the same block, every route() call after it
        // failed too. The first page load worked, which is why it looked
        // intermittent.
        //
        // RequestHandled is dispatched by the framework's terminable middleware on
        // every request in every runtime, so it is the portable stand-in for the
        // Octane event. Note this is a specific fix for a general hazard: any
        // vendor class that caches per-request state in a static is misbehaving in
        // this runtime, and Ziggy is only the one that fails loudly.
        Event::listen(RequestHandled::class, function (): void {
            BladeRouteGenerator::$generated = false;
        });
    }

    /**
     * Whether this PHP process is the embedded runtime inside a compiled app.
     *
     * Read from both $_SERVER and getenv(): the native bridge writes the value
     * into $_SERVER explicitly, but on some paths it is only present via putenv.
     */
    private function runningOnDevice(): bool
    {
        $flag = $_SERVER['NATIVEPHP_RUNNING'] ?? $_ENV['NATIVEPHP_RUNNING'] ?? null;

        if ($flag === null) {
            $flag = getenv('NATIVEPHP_RUNNING') ?: null;
        }

        return in_array((string) $flag, ['1', 'true', 'on', 'yes'], true);
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

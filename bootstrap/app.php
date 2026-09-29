<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Remote desktop rebinds the origin itself (HandleRemoteDesktopOrigin
        // uses URL::useOrigin/useAssetOrigin), so no trustProxies() is needed.
        // Trusting '*' would let X-Forwarded-* from any peer rewrite the
        // origin, which is a wider door than this feature requires.
        $middleware->web(prepend: [
            \App\Http\Middleware\HandleRemoteDesktopOrigin::class,
        ]);

        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
        ]);

        // The display currency is written by the browser with document.cookie,
        // next to the localStorage entry, so the server can read the same
        // preference React already has. A cookie this app does not encrypt is
        // one it also cannot decrypt: EncryptCookies drops what it cannot read,
        // so without this exclusion the value silently arrives as "no cookie"
        // and every request would fall back to dollars. The value is validated
        // against the two known series where it is read, so an unencrypted
        // display preference carries no more trust than the query string it
        // travels beside.
        $middleware->encryptCookies(except: [
            \App\Support\DisplayCurrency::COOKIE,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();

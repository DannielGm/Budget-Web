<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

class HandleRemoteDesktopOrigin
{
    /**
     * Handle an incoming request.
     *
     * In the persistent Android runtime, PHP stays warm across requests. When a
     * remote desktop client on the local network loads the application, we must
     * dynamically bind the root URL and Vite asset resolver to the phone's LAN
     * origin (e.g. http://192.168.1.50:8080) so that all HTML tags (@vite),
     * Ziggy route definitions (@routes), and Inertia redirects point to the
     * phone rather than the browser's own loopback (127.0.0.1).
     *
     * Using a try/finally block ensures that once the response has rendered,
     * the overrides are cleanly reverted so on-device WebView requests are
     * never affected.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->header('X-Remote-Desktop-Origin')
            ?? $request->server('HTTP_X_REMOTE_DESKTOP_ORIGIN')
            ?? $request->cookie('remote_desktop_origin');

        $isRemote = $origin && filter_var($origin, FILTER_VALIDATE_URL);

        if ($isRemote) {
            $origin = rtrim($origin, '/');
            $scheme = parse_url($origin, PHP_URL_SCHEME) ?: 'http';

            URL::useOrigin($origin);
            URL::useAssetOrigin($origin . '/_assets');
            URL::forceScheme($scheme);

            Vite::createAssetPathsUsing(function (string $path) use ($origin) {
                return $origin . '/_assets/' . ltrim($path, '/');
            });
        }

        try {
            return $next($request);
        } finally {
            if ($isRemote) {
                URL::useOrigin(null);
                URL::useAssetOrigin(null);
                URL::forceScheme(null);
                Vite::createAssetPathsUsing(null);
            }
        }
    }
}


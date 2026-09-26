<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Boost Dev Toolbar
    |--------------------------------------------------------------------------
    |
    | Boost injects its toolbar, registers a POST /_boost/browser-logs route and
    | pushes middleware onto the web group. It decides to do any of that when
    | the app is "local" OR debug is on — and the compiled build bundles the
    | same .env the machine develops against, so a dev build shipped to a phone
    | carried the toolbar with it. It is not cosmetic: the WebView was posting
    | every console message to http://127.0.0.1/_boost/browser-logs, which on a
    | real device is a dead address, so the page was paying for a request that
    | could only ever fail.
    |
    | Keyed off the runtime flag NativePHP sets before php_embed_init, for the
    | same reason the bridge muting in AppServiceProvider is: a direct,
    | race-free read with no bridge round-trip that could fail during boot. Local
    | development keeps the toolbar; anything running as a compiled app does not.
    |
    | Set BOOST_ENABLED explicitly to override either behaviour.
    |
    */

    'enabled' => env('BOOST_ENABLED', ! in_array(
        (string) ($_SERVER['NATIVEPHP_RUNNING'] ?? $_ENV['NATIVEPHP_RUNNING'] ?? getenv('NATIVEPHP_RUNNING') ?: null),
        ['1', 'true', 'on', 'yes'],
        true
    )),

];

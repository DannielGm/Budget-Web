<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <!-- The Android status bar is painted by the system and does not read our
             stylesheet, so without this it sits above a gradient header in a
             colour of its own. useTheme keeps it in step with the light/dark
             toggle, which the system setting cannot know about. -->
        <meta name="theme-color" content="#FF8A3D">
        <meta name="color-scheme" content="light dark">

        <!-- The CSRF token for the one form in this app the browser submits
             natively. Every other request goes through Inertia, which reads the
             XSRF-TOKEN cookie and never needs this. The backup file input is
             the exception: a file upload has to be a real form post, so it
             carries its own token. -->
        <meta name="csrf-token" content="{{ csrf_token() }}">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=figtree:400,500,600&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        <script>
            // Check local storage or system preference on load to prevent FOUC
            if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            // The display currency is read before React mounts so the first
            // paint already carries the right symbol. Any value other than
            // 'EUR' means dollars, which is the default.
            window.displayCurrency = localStorage.currency === 'EUR' ? 'EUR' : 'USD';
        </script>
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>

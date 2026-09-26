<?php

namespace Tests\Feature;

use Tests\TestCase;

class RehostOriginTest extends TestCase
{
    private const KOTLIN = __DIR__.'/../../packages/nativephp-remote-desktop/resources/android/RemoteDesktopServer.kt';

    /**
     * Mirror of the Kotlin `rehost`: the literal /_assets/ pair-collapse runs
     * first so serveStatic() still receives a resolvable path, then the
     * expression replaces whatever origin forms remain.
     */
    private function rehost(string $text, string $origin): string
    {
        $collapsed = str_replace(
            ['https://127.0.0.1/_assets/', 'http://127.0.0.1/_assets/'],
            $origin.'/',
            $text
        );

        return preg_replace('/https?:\\\\?\/\\\\?\/127\.0\.0\.1/', $origin, $collapsed);
    }

    /**
     * The re-host fix is present in the plugin source that `native:install`
     * copies into the Android scaffold. This is the property the --check gate
     * also relies on; the cases below are what it cannot see.
     */
    public function test_the_rehost_fix_is_present_in_the_plugin_source(): void
    {
        $this->assertFileExists(self::KOTLIN);
        $this->assertStringContainsString(
            'REHOST_ORIGIN',
            file_get_contents(self::KOTLIN)
        );
    }

    /**
     * The bug. Laravel's data-page payload escapes every slash, so the bytes on
     * the wire read http:\/\/127.0.0.1\/... The old literal-only match missed
     * these, the URL kept pointing at the CLIENT's own loopback, no script
     * loaded, and the page rendered blank.
     */
    public function test_it_rehosts_the_escaped_slash_origin_that_caused_the_white_screen(): void
    {
        $actual = $this->rehost(
            'http:\/\/127.0.0.1\/build\/assets\/app-CgifHWC1.js',
            'http://192.168.1.42:8080'
        );

        // A trailing `\/` is a legal JSON escape for `/` and is left alone: the
        // payload stays valid JSON and decodes to the right URL. Only the origin
        // -- the part the browser would resolve against itself -- is rewritten.
        $this->assertSame(
            'http://192.168.1.42:8080\/build\/assets\/app-CgifHWC1.js',
            $actual
        );

        // The point of the fix: the client's loopback must be gone.
        $this->assertStringNotContainsString('127.0.0.1', $actual);
    }

    /**
     * The @vite script/link tags carry a real /_assets/ mount, which collapses to
     * the origin root. This path always worked and must keep working.
     */
    public function test_it_leaves_the_plain_html_form_working(): void
    {
        $this->assertSame(
            'http://192.168.1.42:8080/build/assets/app-x.js',
            $this->rehost('http://127.0.0.1/_assets/build/assets/app-x.js', 'http://192.168.1.42:8080')
        );
    }

    public function test_it_does_not_rewrite_an_unrelated_host(): void
    {
        $this->assertSame(
            'http://example.com/z.js',
            $this->rehost('http://example.com/z.js', 'http://192.168.1.42:8080')
        );
    }
}

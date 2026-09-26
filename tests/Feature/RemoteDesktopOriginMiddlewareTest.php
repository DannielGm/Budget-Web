<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Vite;
use Tests\TestCase;

class RemoteDesktopOriginMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    public function test_remote_desktop_origin_header_rewrites_root_url_and_vite_assets(): void
    {
        $remoteOrigin = 'http://192.168.1.75:8080';

        $response = $this->withHeaders([
            'X-Remote-Desktop-Origin' => $remoteOrigin,
        ])->get('/');

        $response->assertOk();

        // Check that the rendered HTML contains the remote origin in script/style tags
        $content = $response->getContent();
        $this->assertStringContainsString($remoteOrigin . '/_assets/', $content);
        $this->assertStringNotContainsString('http://127.0.0.1/_assets/', $content);
    }

    public function test_regular_request_without_header_uses_default_origin(): void
    {
        $response = $this->get('/');

        $response->assertOk();

        $content = $response->getContent();
        $this->assertStringNotContainsString('http://192.168.1.75:8080', $content);
    }

    public function test_persistent_runtime_restores_default_after_remote_request(): void
    {
        $remoteOrigin = 'http://192.168.1.75:8080';

        // 1. First request is remote
        $remoteResponse = $this->withHeaders([
            'X-Remote-Desktop-Origin' => $remoteOrigin,
        ])->get('/');
        $remoteResponse->assertOk();
        $this->assertStringContainsString($remoteOrigin . '/_assets/', $remoteResponse->getContent());

        // Flush headers so the test client simulates a clean local request
        $this->flushHeaders();

        // 2. Second request is local (e.g. from internal WebView without remote header)
        $localResponse = $this->get('/');
        $localResponse->assertOk();
        $this->assertStringNotContainsString($remoteOrigin, $localResponse->getContent());
    }

    public function test_middleware_cleans_up_after_request_finishes(): void
    {
        $remoteOrigin = 'http://192.168.1.88:8080';

        $response = $this->withHeaders([
            'X-Remote-Desktop-Origin' => $remoteOrigin,
        ])->get('/');

        $response->assertOk();
        $this->assertStringContainsString($remoteOrigin . '/_assets/', $response->getContent());

        // After request finishes, Vite asset resolver was restored to default
        $assetUrl = Vite::asset('resources/js/app.jsx');
        $this->assertStringNotContainsString($remoteOrigin, $assetUrl);
    }
}


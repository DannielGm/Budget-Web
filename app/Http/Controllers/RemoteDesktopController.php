<?php

namespace App\Http\Controllers;

use BudgetWeb\NativePHPRemoteDesktop\RemoteDesktopManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RemoteDesktopController extends Controller
{
    public function __construct(private readonly RemoteDesktopManager $remoteDesktop) {}

    public function status(): JsonResponse
    {
        return response()->json($this->remoteDesktop->status());
    }

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'port' => ['nullable', 'integer', 'min:1024', 'max:65535'],
            'ttl_minutes' => ['nullable', 'integer', 'min:1', 'max:60'],
        ]);

        return response()->json($this->remoteDesktop->start(
            $validated['port'] ?? 8080,
            $validated['ttl_minutes'] ?? 15,
        ));
    }

    public function stop(): JsonResponse
    {
        return response()->json($this->remoteDesktop->stop());
    }
}

<?php

namespace BudgetWeb\NativePHPRemoteDesktop;

use Illuminate\Support\Str;

class RemoteDesktopManager
{
    public function start(int $port = 8080, int $ttlMinutes = 15): array
    {
        if (! function_exists('nativephp_call')) {
            return ['error' => 'El escritorio remoto solo está disponible en la aplicación Android.'];
        }

        $token = Str::upper(Str::random(5).'-'.Str::random(4));
        $result = json_decode(nativephp_call('RemoteDesktop.Start', json_encode([
            'port' => $port,
            'token' => $token,
            'ttl_seconds' => max(60, min(3600, $ttlMinutes * 60)),
        ], JSON_THROW_ON_ERROR)) ?: '{}', true);

        if (($result['status'] ?? null) === 'error') {
            return ['error' => $result['message'] ?? 'No se pudo iniciar el escritorio remoto.'];
        }

        return $result;
    }

    public function stop(): array
    {
        if (! function_exists('nativephp_call')) {
            return ['active' => false];
        }

        return json_decode(nativephp_call('RemoteDesktop.Stop', '{}') ?: '{}', true) ?: ['active' => false];
    }

    public function status(): array
    {
        if (! function_exists('nativephp_call')) {
            return ['active' => false];
        }

        return json_decode(nativephp_call('RemoteDesktop.Status', '{}') ?: '{}', true) ?: ['active' => false];
    }
}

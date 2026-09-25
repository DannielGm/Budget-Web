<?php

namespace App\Support;

use Native\Mobile\Platform;

/**
 * What this build can do on the device it is running on.
 *
 * Availability is asked of the runtime, not the class loader: the plugins ship
 * their PHP half with the app, but their bridge functions only exist once a
 * build has compiled them in.
 *
 * The "am I on a device at all?" half is `Platform::current()` — the vendor's own
 * cached probe — because `nativephp_can()` cannot answer it: off-device that
 * function is provided by a Jump-mode fallback that says yes to everything. A
 * platform means the bridge replied; no platform means a browser, a test run, or
 * a queue worker.
 */
class NativeCapabilities
{
    /**
     * @return array{isNative: bool, canSave: bool, canPick: bool, canShare: bool, canRemoteDesktop: bool, platform: ?string}
     */
    public static function detect(): array
    {
        $platform = Platform::current();
        $isNative = $platform !== null;

        return [
            'isNative' => $isNative,
            'platform' => $platform,
            'canSave' => $isNative && self::bridgeHas('DocumentPicker.Save'),
            'canPick' => $isNative && self::bridgeHas('DocumentPicker.Pick'),
            'canShare' => $isNative && self::bridgeHas('Share.File'),
            'canRemoteDesktop' => $isNative
                && $platform === 'android'
                && self::bridgeHas('RemoteDesktop.Start'),
        ];
    }

    /**
     * How the vendor describes a bridge that doesn't implement the capability
     * contract: everything it might be asked for is assumed available.
     */
    private static function bridgeHas(string $function): bool
    {
        return ! function_exists('nativephp_can') || nativephp_can($function);
    }
}

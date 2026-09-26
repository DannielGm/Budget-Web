<?php

/**
 * Manual entry point for the Android bridge patches the Remote Desktop plugin
 * depends on.
 *
 * The patches themselves live in one place —
 * BudgetWeb\NativePHPRemoteDesktop\Support\AndroidBridgePatches — because they
 * used to be duplicated here and had already drifted apart.
 *
 * In normal use you do NOT need to run this. The plugin registers a
 * `post_compile` hook, which fires after the plugin compiler generates
 * `app/src/nativephp/kotlin` and before Gradle runs. That is the only point at
 * which both kinds of file exist at once:
 *
 *   - PHPBridge.kt / MainActivity.kt live in `src/main/java` and are reset by
 *     `php artisan native:install`.
 *   - ShareFunctions.kt lives in `app/src/nativephp/kotlin` and does not exist
 *     until the compiler has run.
 *
 * So `php artisan native:build android` alone produces a correct APK. This
 * script remains for inspecting state (`--check`) and as a manual escape hatch.
 *
 * Usage:  php packages/nativephp-remote-desktop/patch-android.php [--check]
 */

use BudgetWeb\NativePHPRemoteDesktop\Support\AndroidBridgePatches;

$autoload = dirname(__DIR__, 2).'/vendor/autoload.php';

if (! is_file($autoload)) {
    fwrite(STDERR, "Composer autoloader not found. Run `composer install` first.\n");
    exit(1);
}

require $autoload;

$checkOnly = in_array('--check', $argv ?? [], true);

echo $checkOnly
    ? "Checking NativePHP Android bridge patches:\n"
    : "Applying NativePHP Android bridge patches:\n";

$results = AndroidBridgePatches::apply(
    checkOnly: $checkOnly,
    log: fn (string $line) => print ($line.PHP_EOL)
);

if ($checkOnly) {
    exit(AndroidBridgePatches::isSatisfied($results) ? 0 : 1);
}

if (AndroidBridgePatches::isSatisfied($results)) {
    echo "Done. You can now run: php artisan native:build android\n";
    exit(0);
}

fwrite(STDERR, "\nSome patches could not be applied. The NativePHP template may have changed.\n");
exit(1);

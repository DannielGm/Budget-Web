<?php

namespace BudgetWeb\NativePHPRemoteDesktop\Commands;

use BudgetWeb\NativePHPRemoteDesktop\Support\AndroidBridgePatches;
use Native\Mobile\Plugins\Commands\NativePluginHookCommand;

/**
 * Applies the Android bridge patches at the one moment both kinds of file exist.
 *
 * `post_compile` fires after the plugin compiler has generated
 * `app/src/nativephp/kotlin` but before Gradle runs, which is the only point at
 * which the vendor-owned files (reset by `native:install`) and the plugin-owned
 * files (created by the compiler) are both present. Running the patches here
 * removes the manual step that previously had to be slotted between `native:build`
 * phases by hand.
 *
 * Reports a genuinely broken anchor rather than passing over it: a missing
 * anchor means the NativePHP template changed, and continuing would produce an
 * APK whose remote desktop silently does not compile or dispatch.
 *
 * Note on severity: returning FAILURE here does NOT stop the build. The vendor
 * PluginHookRunner::runPluginHook() downgrades a non-zero exit code to a
 * warning and carries on to Gradle. So this command makes the failure visible
 * and impossible to miss in the output, but a failed patch still ships. The
 * output says so explicitly rather than implying the build was aborted.
 */
class PatchAndroidBridgeCommand extends NativePluginHookCommand
{
    protected $signature = 'bkeeper:patch-android-bridge';

    protected $description = 'Apply the Android bridge patches the remote desktop depends on';

    public function handle(): int
    {
        if (! $this->isAndroid()) {
            return self::SUCCESS;
        }

        $this->info('Applying remote desktop Android bridge patches...');

        $results = AndroidBridgePatches::apply(
            checkOnly: false,
            log: fn (string $line) => $this->line($line)
        );

        if (! AndroidBridgePatches::isSatisfied($results)) {
            $this->error('Remote desktop Android bridge patches are incomplete; see above.');
            $this->error('The APK WILL still be built and the remote desktop WILL be broken.');
            $this->error('NativePHP only warns on a failed hook, so this is not fatal —');
            $this->error('do not install this build. Fix the anchor and re-run native:build.');

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}

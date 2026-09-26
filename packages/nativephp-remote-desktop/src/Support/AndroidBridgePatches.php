<?php

namespace BudgetWeb\NativePHPRemoteDesktop\Support;

/**
 * The Android bridge edits the remote desktop depends on, and the one Kotlin fix
 * it owns.
 *
 * Why this exists: `native:install` regenerates the whole Android scaffold, and
 * `native:build` additionally deletes and re-copies
 * `app/src/nativephp/kotlin` from the installed plugins. So the files below are
 * perishable in two different ways, at two different points in the build:
 *
 *   - PHPBridge.kt / MainActivity.kt live in `src/main/java`, are reset by
 *     `native:install`, and must be patched before Gradle compiles.
 *   - ShareFunctions.kt lives in `src/nativephp/kotlin`, does not even exist
 *     until the plugin compiler has run, and must be patched after that.
 *
 * There is no single point where a human can patch both by hand. The
 * `post_compile` hook exists precisely for this: it fires after the plugin tree
 * is generated and before Gradle runs, so one hook covers all three. See
 * Commands\PatchAndroidBridgeCommand.
 *
 * The re-host fix in RemoteDesktopServer.kt is NOT patched here. That one lives
 * in the plugin's own source and the compiler copies it in on every build, so it
 * needs no patching — it is only checked, so a regression in the source is
 * caught rather than silently shipped.
 *
 * Match counting: each patch declares min_matches/max_matches, and every
 * occurrence is replaced rather than only the first. A pattern anchored on a
 * line that appears in several places must patch all of them, because patching
 * one of four identical sites reports success while leaving the rest unfixed.
 * When the NativePHP template changes and the count moves outside the declared
 * band, the patch fails rather than applying a partial edit.
 *
 * Known limitation: PluginHookRunner::runPluginHook() only warns on a non-zero
 * exit code, so a FAILED patch does not actually stop the build — it is reported
 * and the APK still ships. The failure is loud, but it is not fatal. See
 * PatchAndroidBridgeCommand, which says so in its own output.
 */
class AndroidBridgePatches
{
    /**
     * The Android project root for a plugin installed at <root>/packages/*.
     */
    public static function androidRoot(): string
    {
        // This class lives at <root>/packages/nativephp-remote-desktop/src/Support/,
        // so the Laravel root — the only place a `nativephp/` directory can live —
        // is four levels up.
        return dirname(__DIR__, 4).'/nativephp/android';
    }

    /**
     * The compiler-owned Kotlin tree, which does not exist until a build runs.
     */
    public static function pluginKotlinRoot(string $androidRoot): string
    {
        return $androidRoot.'/app/src/nativephp/kotlin';
    }

    /**
     * The file whose fix is owned by the plugin source rather than patched.
     */
    public static function rehostTarget(string $androidRoot): string
    {
        return self::pluginKotlinRoot($androidRoot).'/com/bkeeper/remotedesktop/RemoteDesktopServer.kt';
    }

    /**
     * @return list<array{file: string, pattern: string, replacement: string, marker: string, label: string, min_matches?: int, max_matches?: int}>
     */
    public static function all(string $androidRoot): array
    {
        $pluginRoot = self::pluginKotlinRoot($androidRoot);

        return [
            // 1. PHPBridge: an overload that dispatches with an explicit cookie
            //    header, so a LAN client keeps its own session instead of sharing
            //    the phone WebView's store.
            [
                'file' => $androidRoot.'/app/src/main/java/com/nativephp/mobile/bridge/PHPBridge.kt',
                'min_matches' => 1,
                'max_matches' => 1,
                'pattern' => '/(    fun handleLaravelRequest\(request: PHPRequest\): String \{)/',
                'replacement' => "    fun handleLaravelRequest(request: PHPRequest): String {\n"
                    ."        return handleLaravelRequest(request, null)\n"
                    ."    }\n"
                    ."\n"
                    ."    /**\n"
                    ."     * Dispatch an HTTP request while optionally using an isolated cookie header.\n"
                    ."     * Remote/LAN clients pass their own session cookie; normal WebView calls pass\n"
                    ."     * null and retain the shared WebView cookie jar behavior.\n"
                    ."     */\n"
                    .'    fun handleLaravelRequest(request: PHPRequest, explicitCookieHeader: String?): String {',
                'marker' => 'fun handleLaravelRequest(request: PHPRequest, explicitCookieHeader: String?): String',
                'label' => 'PHPBridge.handleLaravelRequest overload',
            ],

            // 2. PHPBridge: honour the explicit cookie header when one is supplied.
            [
                'file' => $androidRoot.'/app/src/main/java/com/nativephp/mobile/bridge/PHPBridge.kt',
                'min_matches' => 1,
                'max_matches' => 1,
                'pattern' => '/            val cookieHeader = LaravelCookieStore\.asCookieHeader\(\)/',
                'replacement' => '            val cookieHeader = explicitCookieHeader ?: LaravelCookieStore.asCookieHeader()',
                'marker' => 'explicitCookieHeader ?: LaravelCookieStore.asCookieHeader()',
                'label' => 'PHPBridge explicit cookie header',
            ],

            // 3. MainActivity: expose phpBridge so plugin bridge functions can dispatch.
            [
                'file' => $androidRoot.'/app/src/main/java/com/nativephp/mobile/ui/MainActivity.kt',
                'min_matches' => 1,
                'max_matches' => 1,
                'pattern' => '/    private val phpBridge by lazy \{ PHPBridge\(this\) \}/',
                'replacement' => '    val phpBridge by lazy { PHPBridge(this) }',
                'marker' => '    val phpBridge by lazy',
                'label' => 'MainActivity.phpBridge visibility',
            ],

            // 4. ShareFunctions: a .json backup is application/json, not the */*
            //    catch-all. Plugin Kotlin is copied out of vendor/ on every build,
            //    so this edit is as perishable as the two above.
            [
                'file' => $pluginRoot.'/com/nativephp/share/ShareFunctions.kt',
                'min_matches' => 1,
                'max_matches' => 1,
                'pattern' => '/(                "txt" -> "text\/plain"\r?\n)(                else -> "\*\/\*")/',
                'replacement' => '                "txt" -> "text/plain"'."\n"
                    .'                // BKeeper\'s own backup. Without this the share sheet is handed'."\n"
                    .'                // "*/*" and several receiving apps offer to save it as binary or'."\n"
                    .'                // refuse it outright.'."\n"
                    .'                "json" -> "application/json"'."\n"
                    .'                else -> "*/*"',
                'marker' => '"json" -> "application/json"',
                'label' => 'ShareFunctions json MIME type',
            ],
        ];
    }

    /**
     * Apply every patch, or report what is missing.
     *
     * Each patch declares a `$marker` present only once applied, which is what
     * makes re-running a no-op. Regexes are used rather than literal strings
     * because the generated scaffold has unstable line endings and the anchors
     * are whitespace sensitive; content is normalised to LF, patched, then
     * restored to its original ending.
     *
     * @param  callable(string): void|null  $log
     * @return list<array{label: string, status: string}> ok|patched|missing|absent|failed
     */
    public static function apply(bool $checkOnly = false, ?callable $log = null): array
    {
        $log ??= static fn (string $line) => null;

        $androidRoot = self::androidRoot();
        $results = [];

        foreach (self::all($androidRoot) as $patch) {
            $result = self::applyOne($patch, $checkOnly, $log);

            if ($result !== null) {
                $results[] = $result;
            }
        }

        $results[] = self::checkRehostFix($androidRoot, $log);

        return $results;
    }

    /**
     * Apply a single patch, returning its result, or null if nothing was needed.
     *
     * Split out of apply() so the match-count contract is directly testable
     * against a synthetic scaffold: apply() resolves paths relative to the real
     * project, which a test cannot stand in for.
     *
     * @param  array{file: string, pattern: string, replacement: string, marker: string, label: string, min_matches?: int, max_matches?: int}  $patch
     * @param  callable(string): void  $log
     * @return array{label: string, status: string}|null
     */
    public static function applyOne(array $patch, bool $checkOnly, callable $log): ?array
    {
        $file = $patch['file'];

        if (! is_file($file)) {
            // A plugin-owned file legitimately does not exist before the
            // plugin compiler has run, so this is an expected state on a bare
            // install rather than an error.
            $log(sprintf('  [skip]    %s (file not generated yet)', $patch['label']));

            return ['label' => $patch['label'], 'status' => 'absent'];
        }

        $contents = file_get_contents($file);
        $crlf = str_contains($contents, "\r\n");
        $haystack = $crlf ? str_replace("\r\n", "\n", $contents) : $contents;

        if (str_contains($haystack, $patch['marker'])) {
            $log(sprintf('  [ok]      %s (already applied)', $patch['label']));

            return ['label' => $patch['label'], 'status' => 'ok'];
        }

        // Every occurrence, not just the first. The Kotlin targets are
        // uniquely anchored, but a pattern that matches N sites must patch
        // all of them: patching one of four identical setenv() lines looks
        // successful and still leaves the app emitting the wrong origin.
        $matches = preg_match_all($patch['pattern'], $haystack, $discarded);

        if ($matches === false) {
            $log(sprintf('  [FAILED]  %s (invalid pattern)', $patch['label']));

            return ['label' => $patch['label'], 'status' => 'failed'];
        }

        // A changed NativePHP template must fail loudly. Under-patching
        // silently ships an APK with a half-applied fix, which is the one
        // outcome this hook exists to prevent.
        $min = $patch['min_matches'] ?? 1;
        $max = $patch['max_matches'] ?? $min;

        if ($matches < $min || $matches > $max) {
            $log(sprintf('  [FAILED]  %s (expected %d match%s, found %d)', $patch['label'], $min, $min === 1 ? '' : 'es', $matches));
            $log('            The NativePHP template changed; re-check the patch manually.');

            return ['label' => $patch['label'], 'status' => 'failed'];
        }

        $patched = preg_replace($patch['pattern'], $patch['replacement'], $haystack, -1, $count);

        if ($count === 0 || $patched === null) {
            $log(sprintf('  [FAILED]  %s', $patch['label']));
            $log('            The NativePHP template changed; re-check the patch manually.');

            return ['label' => $patch['label'], 'status' => 'failed'];
        }

        if ($checkOnly) {
            $log(sprintf('  [MISSING] %s (patchable, not applied)', $patch['label']));

            return ['label' => $patch['label'], 'status' => 'missing'];
        }

        if ($crlf) {
            $patched = str_replace("\n", "\r\n", $patched);
        }

        // Snapshot first. These files are regenerated by native:install and
        // the plugin compiler, but a patch that half-applied leaves the
        // scaffold in a state neither the template nor the plugin source can
        // explain, and without a copy there is nothing to diff against.
        $backup = $file.'.prepatch';

        if (! is_file($backup)) {
            copy($file, $backup);
            $log(sprintf('  [backup]  %s', basename($backup)));
        }

        file_put_contents($file, $patched);

        $log(sprintf('  [patched] %s', $patch['label']));

        return ['label' => $patch['label'], 'status' => 'patched'];
    }

    /**
     * Whether every patch is applied (or absent because the build has not run).
     */
    public static function isSatisfied(array $results): bool
    {
        foreach ($results as $result) {
            if (in_array($result['status'], ['missing', 'failed'], true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Assert the LAN re-host fix is present, rather than applying it.
     *
     * It lives in the plugin's own source and the compiler copies it in, so
     * patching it here would be a second competing edit to the same lines — and
     * the marker would then report success by "patching" a file the source had
     * already fixed, hiding a regression in the source itself.
     *
     * @param  callable(string): void  $log
     * @return array{label: string, status: string}
     */
    private static function checkRehostFix(string $androidRoot, callable $log): array
    {
        $label = 'RemoteDesktopServer re-host fix (escaped-slash origins)';
        $file = self::rehostTarget($androidRoot);

        if (! is_file($file)) {
            $log(sprintf('  [skip]    %s (file not generated yet)', $label));

            return ['label' => $label, 'status' => 'absent'];
        }

        if (str_contains(file_get_contents($file), 'REHOST_ORIGIN')) {
            $log(sprintf('  [ok]      %s', $label));

            return ['label' => $label, 'status' => 'ok'];
        }

        $log('  [FAILED]  '.$label);
        $log('            Expected REHOST_ORIGIN in the plugin source; it is missing or reverted.');
        $log('            Re-apply the fix in packages/nativephp-remote-desktop/resources/android/');

        return ['label' => $label, 'status' => 'failed'];
    }
}

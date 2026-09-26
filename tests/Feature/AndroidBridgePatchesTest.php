<?php

namespace Tests\Feature;

use BudgetWeb\NativePHPRemoteDesktop\Support\AndroidBridgePatches;
use Tests\TestCase;

/**
 * Covers the match-count contract in the post_compile patch hook.
 *
 * The failure this guards against is specific: a patch anchored on a line that
 * appears more than once, applied to only the first occurrence, reports success
 * while leaving the remaining sites unfixed. The resulting APK is half-patched
 * and breaks in a way that looks unrelated to the patch.
 */
class AndroidBridgePatchesTest extends TestCase
{
    /**
     * Run the real patch against a synthetic scaffold containing the anchor
     * $times times, and report the result plus the resulting file contents.
     */
    private function applyToScaffold(string $label, int $times, bool $checkOnly = false): array
    {
        $root = sys_get_temp_dir().'/rd-patches-'.uniqid();
        $file = $root.'/PHPBridge.kt';

        mkdir($root, 0777, true);
        file_put_contents(
            $file,
            implode("\n", array_fill(0, $times, '            val cookieHeader = LaravelCookieStore.asCookieHeader()'))
        );

        $patches = array_values(array_filter(
            AndroidBridgePatches::all($root),
            fn (array $patch) => $patch['label'] === $label
        ));

        $this->assertCount(1, $patches, "Expected exactly one patch labelled '{$label}'.");

        // Point the real descriptor at our temp file, keeping the declared match
        // band, so the contract under test is the one the patch actually ships.
        $patches[0]['file'] = $file;

        $result = AndroidBridgePatches::applyOne($patches[0], $checkOnly, static fn (string $line) => null);
        $after = file_get_contents($file);

        @unlink($file.'.prepatch');
        @unlink($file);
        @rmdir($root);

        return [$result, $after];
    }

    /**
     * A single unique anchor is patched exactly once.
     */
    public function test_unique_anchor_is_patched_once(): void
    {
        [$result, $after] = $this->applyToScaffold('PHPBridge explicit cookie header', 1);

        $this->assertSame('patched', $result['status']);
        $this->assertStringContainsString('explicitCookieHeader ?: LaravelCookieStore.asCookieHeader()', $after);
    }

    /**
     * The band catches an anchor that has appeared in more places than expected.
     *
     * This is the exact template-drift case: the NativePHP template adds a second
     * call site, the patch silently fixes one, and the app still misbehaves.
     */
    public function test_duplicate_anchor_fails_rather_than_half_patching(): void
    {
        [$result, $after] = $this->applyToScaffold('PHPBridge explicit cookie header', 3);

        $this->assertSame('failed', $result['status']);
        $this->assertStringNotContainsString('explicitCookieHeader', $after);
        $this->assertFalse(AndroidBridgePatches::isSatisfied([$result]));
    }

    /**
     * A missing anchor is reported as a failure, not silently skipped.
     */
    public function test_missing_anchor_fails(): void
    {
        [$result, $after] = $this->applyToScaffold('PHPBridge explicit cookie header', 0);

        $this->assertSame('failed', $result['status']);
        $this->assertFalse(AndroidBridgePatches::isSatisfied([$result]));
    }

    /**
     * A patch whose band allows N matches must rewrite all of them.
     *
     * This is the behaviour the old single-replacement loop got wrong: with
     * limit 1, a two-site anchor would be half-patched and reported as success.
     */
    public function test_all_matches_are_rewritten_not_just_the_first(): void
    {
        $root = sys_get_temp_dir().'/rd-patches-'.uniqid();
        $file = $root.'/Sample.kt';
        mkdir($root, 0777, true);

        file_put_contents($file, implode("\n", [
            'before',
            'val a = oldCall()',
            'val b = oldCall()',
            'val c = oldCall()',
        ]));

        $patch = [
            'file' => $file,
            'pattern' => '/oldCall\(\)/',
            'replacement' => 'newCall()',
            'marker' => 'newCall()',
            'label' => 'multi-site anchor',
            'min_matches' => 3,
            'max_matches' => 3,
        ];

        $result = AndroidBridgePatches::applyOne($patch, false, static fn (string $line) => null);
        $after = file_get_contents($file);

        $this->assertSame('patched', $result['status']);
        $this->assertStringNotContainsString('oldCall()', $after);
        $this->assertSame(3, substr_count($after, 'newCall()'));

        @unlink($file.'.prepatch');
        @unlink($file);
        @rmdir($root);
    }

    /**
     * Every patch declares a match band, so none can fall back to the old
     * "patch the first one" behaviour.
     */
    public function test_every_patch_declares_a_match_band(): void
    {
        $patches = AndroidBridgePatches::all(sys_get_temp_dir().'/unused');

        $this->assertNotEmpty($patches);

        foreach ($patches as $patch) {
            $this->assertArrayHasKey('min_matches', $patch, "{$patch['label']} has no min_matches");
            $this->assertArrayHasKey('max_matches', $patch, "{$patch['label']} has no max_matches");
        }
    }
}

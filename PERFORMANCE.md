# Android App Size & Startup Optimization Plan

Measured baseline: `nativephp/android/app/build/outputs/apk/release/app-release.apk`
= **70.44 MB**.

Every number below was measured from the actual artifact, not copied from vendor
docs. Re-run the audit commands at the end after each track to confirm the win
landed.

## Results (final, measured 2026-10-03)

`app-release.apk`: **70.44 MB -> 28.75 MB** = **-41.69 MB (-59%)**.

| Stage | APK | Delta |
|---|---|---|
| Baseline | 70.44 MB | — |
| After Track A | 38.72 MB | -31.72 MB |
| After Track B | **28.75 MB** | -9.97 MB |

Region by region, original -> now:

| Region | Before | After | Win |
|---|---|---|---|
| `classes*.dex` | 32.67 MB (4 files) | **6.47 MB (1 file)** | -26.20 MB (R8) |
| `assets/laravel_bundle.zip` | 22.09 MB | **7.39 MB** | -14.70 MB |
| `resources.arsc` | 1.33 MB | 0.69 MB | -0.64 MB |
| `res/*.png` | ~4.6 MB | ~4.4 MB | -0.2 MB |
| `lib/arm64-v8a` | 8.85 MB | 8.85 MB | **0** (A3 blocked) |

Track A alone accounted for -31.72 MB and Track B for -9.97 MB.

### Track A result (measured)

R8 also collapsed four dex files into one, which is why the saving beat the
estimate. Two things did **not** go to plan:

- **A3 achieved nothing.** `libphp_wrapper.so` is still 30.75 MB raw / 8.35 MB
  zipped, unchanged. See A3 below for why.
- **`res/*.png` barely moved.** Resource shrinking removed only genuinely
  unreferenced files; the splash and icon are referenced, so they stay at full
  resolution. That makes B1 the largest remaining win.

### Track B result (measured)

`laravel_bundle.zip`: **17.36 MB -> 8.77 MB** = **-8.59 MB**. Entries 8,443 -> 7,702.

Verified absent from the rebuilt bundle: `public/splash.png`, `public/icon.png`,
everything under `Icons/`, `vendor/psy/psysh`. The 741-entry drop is mostly
psysh (~428 files) plus `laravel/tinker` and its dependencies.

Projected APK is roughly **~29-30 MB** (the bundle entry shrinks by ~9.3 MB
inside the APK), but that is arithmetic, not a measurement. It still needs a
real build.

Bundle entry count went 8,447 -> 8,443 after Track A and 8,443 -> 7,702 after
Track B. Removing `logcat.txt` removed one entry; removing psysh removed hundreds.

## Where the 70.44 MB actually goes

| Region | In APK | Raw | Cause |
|---|---|---|---|
| `classes{1..4}.dex` | 32.67 MB | 32.67 MB | R8 disabled |
| `assets/laravel_bundle.zip` | 22.09 MB | 23.72 MB | 8,447 entries |
| `lib/arm64-v8a` | 8.85 MB | 32.50 MB | `libphp_wrapper.so` = 30.75 MB raw |
| `res/*.png` | ~4.6 MB | — | splash/icon shipped at full resolution |
| `resources.arsc` | 1.33 MB | — | unused resources retained |

Largest single items inside the Laravel bundle (APK cost = compressed size
inside the bundle x 0.93, the bundle's own outer compression ratio):

| Path | Raw | APK cost |
|---|---|---|
| `public/splash.png` | 5.79 MB | ~5.35 MB |
| `logcat.txt` | 67.48 MB | ~4.52 MB |
| `public/icon.png` | 1.85 MB | ~1.53 MB |
| `Icons/mew_design_*.png` | 1.85 MB | ~1.53 MB |
| `vendor/psy/psysh` | 1.89 MB | ~0.50 MB |
| `resources/js/Components` | 0.33 MB | ~0.09 MB |

## Read this before touching anything

1. **`nativephp/android/app/build.gradle.kts` is rewritten on every build.**
   `Native\Mobile\Concerns\PreparesBuild::updateBuildConfiguration()` runs
   `preg_replace` over `isMinifyEnabled`, `isShrinkResources` and
   `debugSymbolLevel`, sourcing the values from `config('nativephp.android.build')`.
   Hand-editing that file is silently reverted. **The only durable lever is
   `.env` / `config/nativephp.php`.**
   - Corollary: that `preg_replace` has no limit, so it rewrites *every*
     occurrence. The `profileable` build type currently reads
     `isMinifyEnabled = false` while carrying an "Always R8-minify" comment for
     exactly this reason, and `debug_symbols` will apply to the debug variant too.

2. **`NATIVEPHP_BOOT_MODE` is not a lever here.** `assets/bundle_meta.json`
   contains `"entry_mode": "web"` and `"native_routes": []`. `BootPlanner.kt`
   returns `WEB_LEGACY` whenever the pattern list is empty, so switching the env
   value to `auto` boots identically. See Track D.

3. **`logcat.txt` was git-tracked and 67.48 MB.** `.txt` matches no entry in
   `BundleExclusions::PROJECT`, so it shipped. The fix was deleting the file,
   not widening the exclusion list.

4. **Every build destroys the previous APK.** `native:package` starts with
   "Cleaning Gradle cache", which wipes `nativephp/android/app/build/`
   outright. The baseline artifact you are measuring against is gone the moment
   you start the next build. **Copy the APK somewhere safe before rebuilding**
   if you need to compare.

5. **`native:build` is iOS-only.** Despite `--target=android`, it dispatches to
   `BuildIosAppCommand` and dies with "requires macOS" on Windows. Android
   builds go through `native:package android`, which refuses to run without
   signing (`--keystore` et al., or `ANDROID_KEYSTORE_*` env vars).

6. **The Gradle step fails on Windows anyway.** `RunsAndroid.php` invokes
   `gradlew.bat` through `Process::path()`, and cmd does not resolve it:
   `'gradlew.bat' is not recognized`. The Laravel bundle is produced correctly
   first, so the "Bundle size" line in the output is still trustworthy — but the
   APK is not produced by `native:package` on this machine. Run
   `gradlew.bat assembleRelease` from `nativephp/android` directly (with
   `JAVA_HOME` set to jbr-21) to get the artifact.

---

## Track A — config only (~35 MB, no application code changes)

### A1. Enable R8 (largest single win)

`.env`:

```
NATIVEPHP_ANDROID_MINIFY_ENABLED=true
```

Expected: dex 32.67 MB -> roughly 8-12 MB. `app/proguard-rules.pro` already
carries the JNI `RegisterNatives` keeps and the `NativeElementBridge` keeps, so
this was prepared for. The comment in the build file cites ~90 ms off
`bindApplication` on a Pixel 9, which doubles as a startup win — this single
step is both the biggest size win and the main boot-speed win.

Verify on a device, not in tests: R8 failures here surface as boot crashes, not
failing assertions.

### A2. Shrink resources

`.env`:

```
NATIVEPHP_ANDROID_SHRINK_RESOURCES=true
```

Expected: ~2-4 MB from `res/*.png` plus `resources.arsc`.

### A3. Drop native debug symbols from the shipped build

`.env`:

```
NATIVEPHP_ANDROID_DEBUG_SYMBOLS=SYMBOL_TABLE
```

`libphp_wrapper.so` is 30.75 MB raw and is overwhelmingly symbol data; only
8.35 MB of that survives compression into the APK.

**Measured result: this step currently achieves 0 MB.** `debugSymbolLevel` was
correctly set to `SYMBOL_TABLE` (verified by reflection), but the same generated
gradle file also contains:

```kotlin
packaging {
    jniLibs {
        keepDebugSymbols.add("**/*.so")
    }
}
```

`keepDebugSymbols` tells AGP to retain debug symbols in every packaged `.so`,
and it overrides the `debugSymbolLevel` for release artifacts. Neither
`PreparesBuild` nor the config surface touches that line — it is only in the
generated file, so it has to be removed there. This is the one place in this
plan where editing the generated gradle file is correct rather than futile,
because nothing regenerates that line back.

Leaving it in place is not harmful, just wasted: the symbols ride along in every
APK you sideload. Recheck this section if you ever see the `.so` size change.

**Channel note (APK today, Play later).** You ship a signed APK now, and the
70.44 MB artifact measured here is a universal APK carrying the full symbol
payload — so this saving applies in full today. Once you migrate to Play, build
an `.aab` (`php artisan native:package android --build-type bundle`): Play
generates per-device APKs and strips native debug symbols server-side, keeping
them for symbolication. The saving therefore shrinks after the migration.
Measure it rather than assuming, since it depends on the symbol share of that
particular `.so`. Keep the setting in both cases — it costs nothing and still
shrinks the artifact you sideload and test.

### A4. Delete the stray log

```
git rm logcat.txt
git commit -m "Remove 67MB debug log committed by accident"
```

Expected: ~4.52 MB off the APK. Note the blob remains in git history, so every
clone stays ~67 MB until history is rewritten — track that as a separate
decision, it is not required to get the APK win.

---

## Track B — bundle content (~8 MB)

### B1. Splash and icon — excluded, not recompressed

**Done: both are now excluded from the bundle. Measured -7.4 MB.**

The original plan here was to downscale them. That was the wrong move, and the
measurement said so:

- `public/splash.png` is 1536x2752, which is already a *correct* resolution for
  a modern phone. It is not oversized; it is just a noisy 5.79 MB.
- Re-encoding it losslessly changed nothing (5.79 -> 5.79 MB). Re-encoding
  `public/icon.png` made it **worse** (1.85 -> 2.45 MB). Both are already
  near-optimal PNGs, so there was no free win in recompression.

The real finding is that **neither file is needed at runtime at all.** They are
read once out of `public/` by NativePHP's installer to generate the native
drawables, and that happens *before* the bundle is assembled. Nothing in the
running app asks for them: `app.blade.php` carries no favicon, icon or splash
link, and no compiled JS names either file. So adding both to
`cleanup_exclude_files` removes them entirely — bigger win than recompression,
with no visual change whatsoever.

**Still on the table: the `res/` copies (3.34 MB).** `res/AE.png` (2.12 MB) and
`res/9X.png` (1.22 MB) are generated by the installer at 1280x1920, and their
size follows the *pixel content*, so excluding the sources does not touch them.
Shrinking them needs a lossy change and a visual call, so it is left alone:

| Option | splash.png | icon.png | Trade-off |
|---|---|---|---|
| Rescale to 1280x1920 truecolor | 3.63 MB | — | no colour loss |
| 256-colour palette (GD-readable) | **0.77 MB** | **0.10 MB** | banding risk on gradients |
| WebP | 0.07 MB | 0.09 MB | **not possible** |

WebP is ruled out, not merely unattractive: `resizePng()` calls
`imagecreatefrompng()`, and GD cannot read WebP, so a WebP source breaks the
installer outright. The palette route is the only large win that stays a valid
PNG, and it is a decision about how the app looks, not a build setting.

### B2. Stop shipping `laravel/tinker`

`vendor/psy/psysh` (1.89 MB) is a bundled REPL pulled in by `laravel/tinker`,
which is a **direct `require`**, so `composer install --no-dev` keeps it. Move
`laravel/tinker` from `require` to `require-dev` in `composer.json`.

Expected: ~0.50 MB. Confirm nothing under `app/` invokes tinker at runtime first.

### B3. Exclude non-runtime project paths

**Done for `Icons/`. Measured -1.65 MB.** It is source art and design exports,
referenced by no part of the build — the installer looks in `public/`, never
here. Confirmed by grepping the whole package for `Icons`: no hits.

**Deliberately NOT done for `resources/js`.** The original plan excluded it
too. It was dropped on purpose:

- It is worth only **0.09 MB** inside the APK.
- It is pre-build source already compiled into `public/build`, so the runtime
  genuinely does not need it — but the gain is not worth touching a path that
  dev tooling may read.

Verified still present after Track B: all 47 files under
`resources/js/Components/`, and 106 under `resources/js/`.

One thing that did slip through, incidentally: `package-lock.json` (0.36 MB) is
in the bundle. `BundleExclusions` drops `*.lock`, but this file ends in `.json`,
so the pattern misses it. Harmless, but it is the largest non-code file left.

---

## Track C — startup and loading speed

### C1. R8 (from A1)

Removes ~24 MB of dex that ART otherwise has to load, and the build file's own
comment attributes ~90 ms of the cold-start `bindApplication` time to it. This
is the main measured startup win, and it is already paid for by Track A.

### C2. App-specific baseline profile — device work, not a config flag

`app/src/main/baseline-prof.txt` exists (13,579 lines) and ships as
`assets/dexopt/baseline.prof` in the APK, but it is the AGP-merged
Compose/activity profile. It says nothing about this app's own
WebView -> PHP -> Inertia -> React startup path.

Be clear about the cost here: the `profileable` build type only sets
`isProfileable = true`, which lets a profiler *attach*. It does not generate a
profile. Producing one needs a real device plus a Macrobenchmark module added to
the Gradle project, then extracting hot methods back into
`baseline-prof.txt`. That is a genuine project, not a flag.

### C3. Boot-path JavaScript — investigated, no win available

Total built JS is 1,188 KB. The suspicious chunk was
`useDismissOnBackButton` at 121.7 KB: 121.7 KB for a back-button hook does not
add up, and it sits on the critical path via `useMenuDismiss` -> `AppHeader` ->
layouts.

**It is a misnamed chunk, and the weight is framer-motion.** Fingerprinting the
built file: `layoutId` x18, `presenceContext` x13, `motion` x18,
`dragConstraints` x7, `whileTap` x7 — all framer-motion internals. The `app`
chunk has almost none of it (`layoutId` x2). Rollup named the shared chunk after
one of its modules.

So there is nothing to optimise: `app.jsx` wraps the entire tree in
`<MotionConfig reducedMotion="user">`, which is what makes the app's OS-level
reduced-motion setting cover modals, shared-layout morphs and page transitions.
Deferring it would mean remounting the tree, and it is needed *before* first
paint to avoid a motion flash. Leave it.

`BudgetGraph` (349.8 KB, recharts) is correctly behind `lazy()` in
`Dashboard.jsx` and is **not** on the boot path.

### C4. First-launch extraction

The bundle went 8,447 -> 7,702 entries across Tracks A and B. Fewer files to
unzip on first boot, but the count barely moved and the win is small. Measure
before spending effort here.

### C5. OPcache — the open question worth an hour

The bundled PHP reports `#define COMPILE_DL_OPCACHE 1`, i.e. opcache is built as
a **dynamic** module. If nothing loads it, PHP re-compiles every source file on
every request, and that dwarfs every other PHP-side lever. It is also the one
thing that cannot be answered from the build machine: the binary ships static
libraries (`libphp.a`) that CMake links into `libphp_wrapper.so`, and there are
no loadable extension `.so`s and no `php.ini` in the bundle.

**The app already answers this for you.** The on-device bootstrap logs a
breakdown on every request:

```
PerfTiming: PHP opcache=enabled=YES/NO,cached=N autoload=..ms bootstrap=..ms
            kernel=..ms capture=..ms kernel_boot=..ms handle=..ms terminate=..ms TOTAL=..ms
```

It also returns the same data as an `X-PHP-Timing` response header. Read it
with:

```powershell
adb logcat -s php | Select-String 'PerfTiming'
adb shell am start -W -n com.bkeeper.budgettracker/.MainActivity
```

If that line reads `opcache=disabled` or `opcache=NOT_AVAILABLE`, enabling it is
the biggest remaining startup win by a wide margin, and it is worth finding out
before spending time on anything else in this track.

---

## Track D — explicitly not doing

- **`NATIVEPHP_BOOT_MODE=auto`** — a no-op. `native_routes` is `[]`, so
  `BootPlanner` still returns `WEB_LEGACY`. Reaching `NATIVE_DIRECT` requires
  registering `Route::native` and rendering through NativePHP native components
  instead of Inertia/React. That is an architectural rewrite of this app's whole
  view layer, not a build setting, and it should be decided on its own merits.
- **`useLegacyPackaging = false`** — would shrink the APK by roughly the 8 MB
  of `lib/arm64-v8a`, but stores `.so` files compressed, which Android must
  decompress at load. It is currently `true` deliberately: this is a size/speed
  trade and the speed side already won. Do not flip it while the goal is speed.
- **Removing RxJava 2 + 3, Gson, Coil, CameraX, Request-Inspector** — these come
  from `nativephp/mobile` itself. Excluding them risks breaking plugin
  compilation for dex that R8 (A1) largely removes anyway.
- **`nativephp/binaries/*.zip`** — two PHP zips (8.5.10 and 8.5.11, ~12.8 MB
  each) bloat the *repository*, not the APK; `nativephp.lock` pins 8.5.11. Worth
  a cleanup commit, but it does not move the shipped size.

---

## What is left

Done and measured: **A1, A2, A4** (all of Track A's working steps) and
**B1, B2, B3** (all of Track B). Tracks C1 and C3 are resolved — C1 by way of
R8, C3 by finding there is nothing to win.

Remaining, roughly by value:

1. **C5 — check whether OPcache is live on the device.** One `adb logcat` line
   decides it, and if it is off it dwarfs everything else left. Do this first.
2. **A3 — remove `keepDebugSymbols.add("**/*.so")`** from the generated
   `build.gradle.kts`. Worth ~8 MB of the 8.85 MB still sitting in
   `lib/arm64-v8a`, which is now the single largest region left in the APK.
3. **`res/AE.png` + `res/9X.png` (3.34 MB).** Needs a lossy decision — see B1.
4. **C2 — a real baseline profile.** Device plus a Macrobenchmark module. Only
   worth it once C5 is answered.
5. **Device boot test.** Every APK since Track A has had R8 enabled for the
   first time, and R8 failures appear as a crash on launch, never as a failing
   test. This is the one unverified risk in the whole plan.
6. **Track D** — leave alone unless the native-first rewrite is separately
   approved.

## Audit commands

```powershell
# APK region breakdown
Add-Type -AssemblyName System.IO.Compression.FileSystem
$apk = Get-ChildItem nativephp\android\app\build\outputs -Recurse -Filter *.apk |
       Select-Object -First 1 -ExpandProperty FullName
$z = [System.IO.Compression.ZipFile]::OpenRead($apk)
$z.Entries | Group-Object { ($_.FullName -split '/')[0..1] -join '/' } |
  ForEach-Object { [pscustomobject]@{
    Group = $_.Name
    RawMB = [math]::Round((($_.Group | Measure-Object Length -Sum).Sum)/1MB, 2)
    ZipMB = [math]::Round((($_.Group | Measure-Object CompressedLength -Sum).Sum)/1MB, 2)
  } } | Sort-Object RawMB -Descending | Select-Object -First 20
$z.Dispose()
```

```powershell
# Bundle entry count and biggest items
Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path `
     'nativephp\android\app\src\main\assets\laravel_bundle.zip'))
"entries: $($z.Entries.Count)"
$z.Entries | Sort-Object Length -Descending | Select-Object -First 15 `
  Name, @{n='RawMB';e={[math]::Round($_.Length/1MB,2)}}
$z.Dispose()
```

```powershell
# Cold start, before and after
adb shell am start -W -n com.bkeeper.budgettracker/.MainActivity
```

```powershell
# Laravel + JS suites; none of the above should change their results
php artisan test --compact
npm run test
```

## Risks

- **R8 can break JNI.** `proguard-rules.pro` is already prepared for it, but
  this is the one change that needs a real device boot test before release.
  It fails as a crash on launch, not as a failing test.
- **`debug_symbols` also applies to the debug variant**, making native debug
  crashes harder to symbolicate. Keep `FULL` in the `profileable` variant if you
  profile native code.
- **Removing `logcat.txt` from HEAD does not shrink existing clones**, only
  future ones, unless history is rewritten.
- **`git rm logcat.txt` is irreversible in a commit.** Confirm it is genuinely a
  stray log and not something the app reads — it is not referenced from `app/`,
  but check before deleting.

## Verification rule

Every figure in this plan came from reading the built artifact. After each
track, re-run the audit commands and compare against the tables above rather
than trusting that a source edit took effect — `build.gradle.kts` in particular
is regenerated, so a change that looks applied in the source may still be
overwritten at build time.

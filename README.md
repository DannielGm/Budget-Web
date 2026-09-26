# Budget keeper — Laravel + React Migration Fork

Project: `E:\Projects\Budget-Web`

Laravel 11, SQLite, React (Inertia.js), and Tailwind CSS. This is a web-based migration of the Budget Android app, designed for cross-platform availability while maintaining the authoritative financial logic and "Single Screen" UX. Packaged natively for Android using NativePHP.

## Implemented Features

- **Core Logic Parity**: Ported the complex financial formulas (Cash vs. Credit, Debt calculation, True Budget) from Kotlin to PHP.
- **Carry-forward Engine**: Automated rollover of closing balances and unpaid debt between months.
- **Web Dashboard**: Responsive React-based UI that replicates the Android dashboard structure.
- **Interactive Graphing**: Multi-metric visual budget tracking powered by Recharts, showing Available Balance, Expenses, and Savings movements over time.
- **Persistent Storage**: Backed by a clean SQLite schema with Eloquent models for Budgets, Categories, Expenses, Debts, and Savings.
- **Savings Integrations**: Native tracking for Binance, Bank, and Physical savings with real-time BCV conversion.
- **Theme Toggle**: Full support for Light and Dark modes with theme-aware chart colors.

## Privacy

`database/data/september.private.json` contains real financial data. It is Git-ignored but **not encrypted**. The local SQLite database (`database/database.sqlite`) stores all sensitive information. Ensure this environment is kept private and secure.

## Finished Alphas

### alpha 0.0.1 — Initial Laravel + React Migration
- Initialized the Laravel 11 project with the agent-optimized `--boost` flag.
- Migrated the domain model and database schema to SQLite.
- Implemented `BudgetService` to handle complex financial calculations and carry-forward rules.
- Created the core React components: `BalanceCard`, `BudgetGraph`, and the category detail view.
- Wired the initial dashboard with support for month selection and theme toggling.
- Successfully seeded the database with the authoritative September financial record.

### alpha 0.0.2 — Interactive Editing & Dialogs
- Ported all editor dialogs (Income addition, Expense creation/editing, Debt management).
- Implemented server-side validation for all financial inputs.
- Added real-time UI updates after successful edits using Inertia.js state management.

### alpha 0.0.3 — NativePHP Mobile Integration
- Integrated `nativephp/mobile` (v4.5.0) into the Laravel project.
- Configured app branding: **BKeeper - Budget Tracker** (`com.bkeeper.budgettracker`).
- Automated the Laravel source bundling and Native PHP wrapper compilation.
- Successfully generated the first debug APK for Android (`arm64-v8a`).

### alpha 0.0.4 — Multi-month Navigation & Calendar
- Implemented a web-based version of the Month/Day calendar picker (Monday-first).
- Enabled full multi-month navigation and day-level filtering (1d/7d/Month) on the dashboard.
- Synced BCV exchange rate logic with the web backend for automatic daily updates and historical backfill.
- Replaced confidential seed data with a synthetic 4-month mockup (showing upward/downward trends).

### alpha 0.1.0 — Feature Parity & UI Fixes
- Reached 100% feature parity with the Android Phase 4.3.2 release.
- **Status Bar Integration**: Fixed clashing with Android status bar using safe-area insets.
- **Budgeting (Planned vs Actual)**: Implemented `planned_bs` for categories with visual progress tracking.
- **Data Portability**: Added JSON Export/Import system and a dedicated Settings screen.
- **Branding**: Updated to **Budget keeper** naming convention across the app.
- **Automated Testing**: Added unit tests for the core financial service engine.

### alpha 0.2.0 — Savings Integrations
- Implemented comprehensive tracking for Savings (Binance, Bank, Physical) with USD inputs.
- Developed a dynamic `True Budget` calculation that reconciles available Bs with total USD savings.
- Refactored the dashboard to feature a Framer Motion-powered swipeable dual-view (Budget / Savings).
- Added interactive history and logging modals for deposits and withdrawals.

### alpha 0.2.5 — UI Polish, Graphing & Presupuesto Thresholds
- **Advanced Graphing**: Multi-metric "Flujo" graph tracking Available Budget, Expenses, and Savings.
- **Presupuesto Threshold**: Dotted threshold line on charts with dynamic green/red color coding based on affordability.
- **Planning Categories**: Reworked category logic where `is_presupuesto` flag enables planning without affecting real cash balance.
- **Additive Transactions**: Re-implemented "Add to current" logic for Incomes and Debt payments.
- **Historical Rates**: Calendar-based historical BCV rate picker for budget configuration.
- **Dynamic Mockups**: Improved seeder to generate 4-month trends (3 up, 1 down) from any starting month.

### alpha 0.2.6 — Performance & UX Overhaul
- **Performance Optimizations**: Drastically reduced load times (from ~2.5s to ~0.40s) by muting NativePHP's JumpBridge off-device, lazy-loading savings ledgers via `Inertia::optional()`, memoising Budget aggregates, and optimizing BCV API caching with resilient timeouts.
- **Category Accordion**: Replaced static category badges with a modern accordion dialog for quick category switching, creation, editing, and deletion.
- **Smart Category Bar**: Added a contextual, floating category quick-switch bar powered by `framer-motion` and `IntersectionObserver` that only slides into view when scrolling through expenses.
- **Debt History**: Replaced static debt totals with individual payment tracking in a dedicated `debt_payments` table, viewable via a lazy-loaded Summary Modal.
- **Backdated Payments**: Added calendar support to backdate debt payments explicitly.

### alpha 0.2.7 — Reconcilable Transfer System & UI Polish
- **Unified Transfer System**: Introduced a dedicated `transfers` table and model for moving funds between components (Cash, Bank, Binance) with full double-entry traceability.
- **Budget Formula Recalibration**: Updated logic to calculate available balance using the unified transfers ledger, ensuring internal movements don't double-count or ghost funds.
- **Debt UX Polish**: Simplified the Debt editor with a modern toggle switch for payments and automatic "Initial Payment" tracking in the history view. Added wholesale debt deletion that cascades to remove all associated payments.
- **Category Integrity**: Standardized category types (Contado, Crédito, Presupuesto) with a mutually exclusive dropdown selector, strict budget formula isolation, and cascade deletion for orphaned expenses.
- **Safety & Stability**: Fixed critical JavaScript crashes in the Debt and Category forms and resolved mass-assignment issues for presupuesto flags.

### alpha 0.2.8 — Savings Dashboard & Digital Transfers
- **Digital Branding**: Fully rebranded "Binance" to "Digital" across the UI and Database (using live migrations).
- **Independent Pool Tracking**: Refactored the core budget formulas to track Digital, Bank, and Physical savings as truly independent ledgers.
- **Unified Savings Ledger**: Merged direct manual saving deposits/withdrawals with cross-app `Transfers` into a single, chronological timeline.
- **Pool Summary Modal**: Added dedicated tracking modals for each specific pool to view targeted deposit/withdrawal histories.
- **Transfer Shortcuts**: Integrated a quick-transfer floating button directly into the Savings Dashboard.

### alpha 0.2.9 — Graph Filtering & Savings Visibility Fixes
- **Backend Eager Loading**: Explicitly loaded `savingsTransactions` and `transfers` relationships in the `BudgetController` to provide the frontend graph with complete historical data, fixing the flatlined savings issue.
- **Unified Graph Savings Ledger**: Rewrote the `BudgetGraph` calculation engine to use the exact same underlying merged ledger (`savingsLedger`) as the Savings Dashboard, guaranteeing pixel-perfect alignment between the "Ahorro del Mes" line and the "Historial de Movimientos".
- **Graph Invert Logic**: Fixed an issue where the savings graph rendered inversely. The graph now correctly goes UP on deposits and transfers into a savings pool, and DOWN on withdrawals and transfers out.
- **Absolute Savings Tracking**: Prevented the `Ahorro del Mes` graph line from artificially dropping to $0 in windowed views (like 7d or 1d filters), ensuring it accurately shows the total accumulated monthly savings regardless of the active time slice.
- **Date Range Protections**: Locked the `7d` and `1d` filters on past months, forcing the user into the `Mes` view to prevent confusing filtering anomalies on historical data.
- **Presupuesto Affordability UI**: Updated the `isBudgetOk` boolean logic driving the chart threshold line so that it strictly references the *global* available balance, turning red only when planned budget exceeds actual funds.
- **Expense Quick-Edit**: Added double-click/double-tap support on individual expenses in the dashboard list to open the edit modal instantly, removing the redundant edit icon to declutter the UI.
- **Category Quick-Select**: Added double-click/double-tap support on categories in the Category Accordion to instantly view their expenses and close the menu.
- **Thousand Separator Formatting**: Swapped all basic number inputs across all Modals (`ExpenseForm`, `DebtForm`, `BudgetForm`, `SavingsForm`, `TransferModal`) for a custom `FormattedNumberInput` powered by `react-number-format`. Users can now see real-time thousand dot `.` and decimal comma `,` parsing as they type, dramatically improving readability for large amounts while persisting safely to Laravel's numeric backend format.
- **Strict Decimal Consistency**: Enforced a strict 2-digit decimal format (`minimumFractionDigits` & `maximumFractionDigits`) across all dashboard elements (Expenses, Debt totals, Modal summaries) to guarantee visual uniformity when trailing zeros are present.
- **Credit Purchases in Debt Summary**: Fixed a bug in the Debt Summary Modal where "Compras a crédito" (credit purchases made during the active month) were omitted from the "Total Pendiente" calculation. The modal now perfectly matches the dashboard's total debt figure.
- **Historical Rate Picker Fix**: Fixed a silent failure in the configuration menu's "Buscar tasa histórica" calendar. A dedicated API endpoint (`/exchange-rate/history`) was wired up in Laravel, allowing the frontend to query the pre-existing SQLite rate database safely without mutating it. Upon selecting a date, the frontend now updates the active input and auto-closes the calendar.
- **USD Equivalence Display**: Added USD equivalent text indicators (converted using the month's active BCV rate) below individual debts, the "Compras a crédito" row, and the category "Total" sum in the main dashboard view.
- **Theme Persistence & Native Detection**: Dark/Light mode selection is now saved in `localStorage` across app reloads. The `<head>` now features a zero-FOUC (Flash of Unstyled Content) inline script that automatically queries the device's system-level theme via `prefers-color-scheme`. When packaged with NativePHP, the Android WebView passes the OS-level Dark/Light mode preference down to the app, establishing the correct default theme on first launch.

### alpha 0.3.0 — Sub-Categories & UI Polish
- **Debt Category Linking**: Added a `debt_id` foreign key to `categories`. Users can now link any "Crédito" category directly to a specific named Debt bucket (e.g. linking the "Supermarket" category directly to the "Zinli Card" debt).
- **Dynamic Debt Tracking**: Reworked the entire Debt mathematical engine in `Budget.php` and `BudgetService.php`. Unlinked credit categories continue to accumulate into a global "Compras a crédito" fallback bucket, while linked credit categories now intelligently add directly to their assigned debt's balance in real-time.
- **Debt UX Enhancements**: Enabled creating and editing named Debt buckets via a fully functional modal directly from the Debt badge '+' icon. Made the "Monto Inicial" optional during creation, allowing users to create empty debt buckets specifically to act as destinations for credit categories. Added visual badges on the debt card showing exactly how much new debt was accumulated ("Nuevos cargos") under a specific bucket during the active month.
- **Daily BCV Sync**: Implemented a "Tasa Diaria BCV" toggle directly in the Budget configuration form, giving the user control to lock the budget's rate to the absolute latest fetched BCV exchange rate.
- **Responsive Modals**: Polished all dialog action buttons using `flex-col-reverse` to ensure they seamlessly adapt and stack vertically on narrow Android screens, preventing any squished text or clipping.
- **Settings Menu**: Updated the Dashboard's floating action menu with a settings icon and wider auto-resizing dropdown box to prevent truncated button text on smaller screens.

### alpha 0.3.1 — BCV Rate History, Compact Header & Navigation Polish
- **BCV Rate History Dashboard**: Added a dedicated swipeable view (between Main and Savings) displaying real-time BCV exchange rate analytics, interactive historical sparklines/charts across multiple time horizons (30d, 90d, 180d, 1y, all), variation statistics, and on-demand BCV sync with cache invalidation.
- **Series Endpoint & Caching**: Created a lightweight JSON series endpoint (`/exchange-rate/series`) in `ExchangeRateService` and `BudgetController`, backed by automated feature testing (`ExchangeRateSeriesTest`).
- **Compact Responsive Header**: Redesigned header controls to prevent truncation of long month names (e.g. `SEPTIEMBRE 2026`) on mobile webviews by optimizing touch padding, adjusting secondary icon sizing, and granting full fluid width to the month label.
- **Collapsible Vertical View Switcher**: Replaced the static 3-button horizontal pill badge in the header with a dynamic single-button deployer. The focused dashboard icon is displayed by default; tapping it deploys the full view menu vertically in place with smooth transition and click-outside dismissal.
- **Client Runtime & TDZ Fixes**: Resolved React component initialization and Temporal Dead Zone issues in swipe view state for production Vite bundles.
- **Android-Centered Dialogs & Settings Menu**: Replaced the settings corner dropdown with a centered floating action menu featuring a blurred backdrop and mobile-safe dismissal. Updated the shared modal system to center dialogs horizontally and vertically at every viewport size while retaining safe padding and scrolling. This consistently centers the month selector, historical-rate picker, debt status, category accordion, and all shared forms in Android WebView and browser layouts.
- **Financial Clarity**: Reordered the available balance card to show the Bs amount as the primary value with its `$` equivalent below. Standardized currency formatting across the dashboard.
- **Month Summary Strip**: Added a compact `Ingresos / Gastos / Pagado` summary directly below the available balance, with aligned Bs and `$` figures for faster at-a-glance understanding.
- **Debt Progress Readability**: Individual debt rows now show remaining Bs and `$`, followed by a concise `paid percentage - paid Bs amount` line. Long debt labels truncate safely on narrow screens.
- **Secondary Dashboard Polish**: Refined savings pool cards, savings history rows, BCV statistics/history formatting, and the debt summary modal with consistent financial hierarchy, tabular numbers, shared formatters, and an accessible debt-payment progress bar.
- **Shared Interaction Accessibility**: Added `focus-visible` brand outlines, consistent Android/touch press feedback, disabled tap-highlight interference, and `prefers-reduced-motion` support.
- **Accessible Icon Controls**: Added dynamic labels for theme controls and verified descriptive labels/title attributes for dashboard, calendar, navigation, settings, and other icon-only actions.
- **Balance Hero Visual Unification**: Refined the main available-balance card to share the dark navy hero treatment, typography, padding, decorative background, and hierarchy used by the Savings and BCV dashboards. The Bs value remains primary with its USD equivalent below, while BCV rate and refresh controls are presented as compact secondary actions. Added responsive nowrap/truncation safeguards for long Android WebView values, accessible refresh labeling, touch feedback, and consistent use of the already-calculated cash-expense total.
- **New Graph For Dashboard**: A new graph implementation has been done making it more focused into specific tabs
- **Unified Cash-Expense Logic**: Centralized the definition of cash expenses shared by the Balance Card and the graph. Both now include all counted cash categories while excluding categories tagged `is_presupuesto`, so selecting a dashboard category no longer changes the global Gastos metric.
- **Presupuesto-Plan Tracking**: Clarified the Gastos tab by separating cash spending from planning data. The cash-expense line matches the Balance Card, while the plan panel uses only expenses assigned to categories tagged `is_presupuesto` and compares them with their `planned_bs` values. (Re-introduced `planned_bs` database tracking internally to power this functionality).
- **Visible Plan Progress**: The Gastos tab now presents Plan, Gastado, Restante, utilization percentage, a responsive progress bar, and a clearly labeled dotted reference line. The panel is explicitly titled `Seguimiento de categorías presupuesto` so cash expenses and planned-category spending cannot be confused.
- **Correct Affordability Rule**: Dashboard and graph status now use the requested rule: available balance greater than or equal to the total planned amount is green (`Presupuesto cubierta`); available balance below the plan is red (`Presupuesto excedido`). Actual spending can be displayed separately when it differs from the affordability status.
- **Expense Card & Form Overhaul**: Replaced the inline expense list with a reusable `ExpenseCard` featuring a clearer category header, semantic badges for Contado/Crédito/Presupuesto, explicit financial-impact explanations, category totals with per-expense stored-rate USD conversions, a purposeful empty state, and visible touch-safe edit/delete actions. The expense form now prioritizes the Bs amount, shows the live USD equivalent and applied rate, moves rate editing into an advanced section, improves date controls, explains the effect of the expense on available balance, supports scrollable Android WebView layouts, and provides a clear edit-mode delete action.

### alpha 0.4.0 — Remote Desktop

- **Temporary LAN Editing**: Added an Android-only **Escritorio remoto** option to the settings menu. When activated, the APK exposes the same embedded Laravel application to a computer on the local Wi-Fi network, allowing budgets, expenses, debts, savings, transfers, and settings to be edited from either device against the phone's single SQLite database.
- **NativePHP Plugin**: Added the local `budget-web/nativephp-remote-desktop` plugin with `RemoteDesktop.Start`, `RemoteDesktop.Status`, and `RemoteDesktop.Stop` Android bridge functions. The plugin starts a Kotlin `ServerSocket` on the Wi-Fi interface (port `8080` by default), detects the phone's LAN IPv4 address, serves Vite/static assets, and forwards dynamic HTTP requests into NativePHP's persistent embedded PHP runtime.
- **Pairing Flow**: The phone displays a local URL and temporary pairing code. A computer opens the URL, enters the code, receives an HttpOnly remote-session cookie, and can then use the complete BKeeper web interface. QR-code pairing is intentionally deferred to a later release.
- **Automatic Shutdown**: Remote access expires automatically after 15 minutes by default, with a visible countdown and an immediate **Desconectar escritorio** action. Sessions, pairing state, and the listening socket are cleared when the server stops.
- **Isolated Browser State**: LAN requests use an explicit cookie header, keeping the computer's Laravel session separate from the phone WebView's cookie jar while still using the same application database and PHP execution lane.
- **Security Boundaries**: Management routes such as `/remote-desktop/status`, `/start`, and `/stop` are blocked from remote LAN clients, preventing a paired computer from retrieving the pairing token or controlling the listener. Request bodies are size-limited, and the feature is intended only for trusted local networks.
- **Device Gating**: The settings option appears only when NativePHP reports an Android runtime with the compiled `RemoteDesktop.Start` bridge function. Web and unsupported platforms do not expose the feature.
- **Backend and UI**: Added `RemoteDesktopManager`, `RemoteDesktopController`, start/status/stop routes, native capability detection, and a centered mobile settings panel with activation, address/code copy actions, expiration countdown, errors, and disconnect controls.
- **Android Build Requirement**: The feature compiles against Android API 26+ and requires Java 17 or newer for the Android Gradle Plugin. The project was validated with the installed Java 21 runtime (`C:\Users\DANIE\.jdks\jbr-21.0.11`).
- **Validation**: NativePHP plugin validation, Android Kotlin compilation (`compileDebugKotlin`), the production Vite build, and the Laravel test suite all passed. Physical-device LAN testing remains necessary to verify router/client isolation and foreground Android behavior.
- **Security Limitation**: The current implementation uses local HTTP and is not intended for public-internet exposure. A production-grade remote service would require TLS, durable user authentication, device pairing/revocation, and optimistic-lock conflict handling for simultaneous phone/PC edits.

### alpha 0.4.1 — Remote Desktop White-Screen Fix & Reproducible Android Patches

- **Root Cause of the White Screen**: After pairing, the computer loaded a blank page. `serveStatic()` only served paths under `build/`, `_assets/`, and `storage/`, so the Blade shell's Vite asset requests fell through to the PHP dispatcher and were answered with application HTML using a JavaScript MIME type. The browser refused the script, React never mounted, and the page stayed white. Pairing itself is pure Kotlin, which is why the code exchange appeared to work.
- **Asset Resolution Rewritten**: `serveStatic()` now mirrors the phone WebView's own resolution strategy — the requested path first, then `vendor/`, then `build/` — instead of a prefix allow-list. Added correct MIME types (`js`/`mjs`, `css`, `json`, `svg`, `png`, `webp`, `gif`, `ico`, `woff`/`woff2`/`ttf`/`eot`, `html`, `txt`), `Cache-Control`, and `Access-Control-Allow-Origin: *` for fonts. Path traversal remains blocked through canonical-path containment.
- **HTTP Response Hardening**: `writeRawResponse()` now detects the header/body separator (`\r\n\r\n` or `\n\n`), preserves an existing `HTTP/` status line or synthesizes one, strips `Content-Length`/`Transfer-Encoding`, and guarantees a `Content-Type` default so HTML always parses. (Note: it claimed to re-compute the length against the *rewritten* body. It did not — see the 0.4.4 entry for the bug that actually caused it.)
- **Origin and Cookie Re-Hosting**: Both `http://` and `https://127.0.0.1` are rewritten to the LAN origin in the response body, in `Location`, and in `Set-Cookie`. `Domain` and `Secure` attributes are stripped from cookies so the computer's browser retains a valid Laravel session over plain HTTP — previously a `Secure` cookie would have been silently discarded. (This rewrite was intended to fix the origin problem; it did not. See 0.4.4.)
- **Correct Status Lines**: Added a reason-phrase table. The server previously emitted invalid lines such as `HTTP/1.1 303 OK` and `404 OK`; the pairing redirect is now a proper `303 See Other`.
- **Visible Failures**: A blank upstream response now returns a styled `502` page naming the failing method and path, instead of silently producing empty output. Future regressions will be diagnosable from the browser.
- **Reproducible Android Patches**: The remote desktop depends on three edits to Kotlin files inside the generated `nativephp/android` scaffold, which `php artisan native:install` and the plugin compiler both regenerate. The edits live in one place — `Support\AndroidBridgePatches` — and are applied by a `post_compile` plugin hook, so `php artisan native:build android` alone produces a correct APK:
  1. `PHPBridge.handleLaravelRequest()` gains an overload accepting an explicit `Cookie` header, so a LAN client keeps its own session instead of being merged into — or overwriting — the phone's cookie store.
  2. `MainActivity.phpBridge` is made public so plugin bridge functions can dispatch into the same persistent PHP runtime.
  3. `ShareFunctions` learns that `.json` is `application/json`, so a backup handed to the share sheet is not offered as the `*/*` catch-all.
- **Why a hook rather than a manual step**: the three targets are perishable at *two different points*. `PHPBridge.kt` and `MainActivity.kt` live in `src/main/java` and are reset by `native:install`; `ShareFunctions.kt` lives in `app/src/nativephp/kotlin` and does not exist until the plugin compiler has run (`AndroidPluginCompiler` deletes and re-copies that whole tree on every build). There is therefore no single point at which a human can patch all three by hand. `post_compile` fires after the plugin tree is generated and before Gradle runs, which covers all three in one pass.
- **Patch Design**: matching is regex-based and line-ending aware (the scaffold uses CRLF on Windows), and each patch declares a marker substring present only once applied, so re-running is a safe no-op. Each patch also declares a `min_matches`/`max_matches` band and **every** match is rewritten, not just the first: patching one of several identical sites would otherwise report success while leaving the rest unfixed, shipping a half-patched APK. If the NativePHP template changes and the match count falls outside the declared band, the patch fails rather than applying a partial edit. Every write is preceded by a `.prepatch` snapshot of the original file, so a bad anchor is diffable and recoverable.
- **A failed patch is loud but NOT fatal**: `PluginHookRunner::runPluginHook()` (vendor) downgrades a non-zero exit code to a warning and proceeds to Gradle. The hook command therefore cannot abort the build, and its output says so explicitly rather than implying the build was stopped. Treat a `[FAILED]` line in the build log as *do not install this APK* — the remote desktop will be broken.
- **The LAN re-host fix is not a patch**: it lives in the plugin's own `resources/android/RemoteDesktopServer.kt`, which the compiler copies in on every build, so it needs no patching. The hook only *asserts* it is present, so a regression in the source is caught rather than shipped. Patching it as well would be a second competing edit whose marker would report success by "fixing" a file the source had already fixed.
- **Manual escape hatch**: `php packages/nativephp-remote-desktop/patch-android.php [--check]` still applies or reports the same patches, delegating to the shared class rather than duplicating it. `--check` exits non-zero when anything is missing, making it usable as a CI or pre-build guard.
- **Validation**: the cycle was verified from a pristine vendor baseline — files restored, patches applied from scratch, re-run as a no-op, and `--check` clean. The generated Kotlin was inspected to confirm indentation survived the patch, which is what broke the build when the replacement text was a heredoc.

### alpha 0.4.3 — Remote Desktop & Import/Export
- **Reworked native php calls**: Now all features should work

### alpha 0.4.4 — Remote Desktop Origin & Pairing Hardening

- **White screen root cause**: `writeRawResponse()` converted the body to bytes *before* running the re-host rewrite, so the rewritten string was thrown away and the original bytes were sent:

  ```kotlin
  val bodyBytes = body.toByteArray(UTF_8)   // frozen here
  body = rehost(body)                        // rewritten here
  out.write(bodyBytes)                       // ...but the OLD bytes are sent
  ```

  `rehost()` was always correct — its result just never reached the socket, which is why three earlier regex attempts could not have worked. The conversion now happens after the rewrite.
- **Laravel generates the right URLs**: `HandleRemoteDesktopOrigin` (prepended to the `web` group) reads the `X-Remote-Desktop-Origin` header the server sets and rebinds `URL::useOrigin()`, `URL::useAssetOrigin()` and the Vite asset resolver for that one request. `@vite` preloads, scripts, dynamic imports, Ziggy and Inertia's payload then all emit LAN URLs natively, with no `127.0.0.1` in the output. Response rewriting is now only a backstop. (`useAssetOrigin()` is required because NativePHP sets `ASSET_URL` to `127.0.0.1` in C before boot, and that value beats the request root in `asset()`.)
- **No `trustProxies()`**: the middleware binds the origin itself, so trusting every peer is unnecessary and would let any `X-Forwarded-*` rewrite it. The suite passes without it. Overrides are wrapped in `try`/`finally` because NativePHP keeps one warm PHP interpreter, where a leaked `forcedRoot` would mislabel every later page.
- **Pairing**: only a SHA-256 digest is stored and compared with `MessageDigest.isEqual()` (constant time) rather than plaintext `==`; 5 failed attempts trigger a 15-minute per-IP lockout (`429`); pairing replaces any existing session; and the TTL is checked on every connection, so a paused tab cannot outlive the window (`410 Gone`). `/remote-desktop/*` and `/backup/import/pick` return `404` to remote clients — the document picker opens a native dialog with no remote counterpart.
- **Verification**: PHP is covered by tests (108 passing, 1 pre-existing skip). **The Kotlin has not been compiled** — no Android build has run against these changes, so device behaviour is unconfirmed.


## Build and Current-Phase Checks

Prerequisites: PHP 8.3+, Node.js, Composer, Java 17+, Android SDK.

1. **Install Dependencies**:
   ```bash
   composer install
   npm install
   ```
2. **Environment Setup**:
   ```bash
   cp .env.example .env
   php artisan key:generate
   touch database/database.sqlite
   php artisan migrate --seed
   ```
3. **Build APK**:
   ```bash
   npm run build
   php artisan native:run android
   ```

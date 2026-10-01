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
- **Análisis**: A month-health screen reached from the dashboard summary strip, deriving every figure from props the dashboard already has (no second endpoint, no second source of truth).
- **Touch Feedback**: Short press haptics on every `.touch-feedback` control, wired through one delegated listener.
- **Display Currency**: Every figure can be read in dollars or euros. A rate picked from a specific day uses that day's real BCV euro rate; a custom rate is reused as typed and only the symbol changes. The rate history shows whichever series is on screen with the other one beside it as a comparison line.
- **`income_rate` is the month's rate, full stop**: it is whatever the budget form holds — a custom number the user typed, or the BCV figure `refreshMonthRates()` kept in step — and it is what every bolivar figure on screen converts at. `refreshMonthRates()` re-derives it from the active series on every load and never touches an `is_custom_rate: true` budget, so "the form wins" needs no extra enforcement. The payload exposes it as `rates.effective`; the two real BCV series survive as `rates.{usd,eur}.latest` (the form's daily switch, and what a savings pot is valued at) and as `rates.{usd,eur}.day` for a day filter.
- **Savings come in two pots**: a pool is not marked as one currency. Every savings movement carries the currency it was saved in — `USD` or `EUR`, defaulting to USD, which is what every row written before the column existed was — and a pool therefore reports `balance_usd` and `balance_eur` separately. A screen states the pot its own currency is saved in: dollar mode shows the dollars, euro mode the euros, and the pot on screen is never converted: its figure is the amount as stated, and its bolivar line is the app's own rate for the day or range, the one every other bolivar figure on screen divides by. `amount_usd` holds the amount *in that currency* and keeps its historical name, because renaming it would make the backup importer strip the amount out of every file already on a device.
- **Only two places add the pots up**: the pool strip and the `/savings` summary. Both leave the pot already in the display currency exactly as it is and convert only the other one, pairing the two BCV series from the same day: a conversion taken from today's rate on one side and a picked day's rate on the other is not a number the user can check. The summary also sums every source into one patrimony figure: cash + both pots − named debts − this month's credit purchases. A pot whose series has not loaded is left out of a total rather than valued at the other currency's rate.
- **A savings movement says which pot it belongs to**: `SavingsForm` and `TransferModal` offer the choice, defaulting to the currency on screen, and the amount label, the rate label and the rate default all follow it. Neither takes its rate from the caller, which in euro mode pre-filled a euro rate into a dollar field and wrote a bolivar amount roughly twenty percent high; a rate the user typed survives a currency change. A movement is priced at today's real rate even while a past day is on screen, because it is stamped now. The summary's back control returns to the savings view rather than the balance card, because the view travels in the URL (?view=).
- **A committed swipe eats the click it causes**: the pool strip is one large link, so a drag that changes view also fired a click and opened the summary instead. `useSwipeViews` arms a one-shot capture listener on `window` for that click only, and disarms itself if none arrives, because a listener left armed would eat the next deliberate tap. The rule lives in an exported `createClickSwallower(target)` so it is testable without a DOM.
- **The currency switch is in the header**: a savings screen states one pot, so answering "what are my euros worth in dollars?" used to mean Settings -> toggle -> reload -> swipe -> strip. The header switch writes the preference through the one exported `setDisplayCurrency` Settings also calls, so the two controls cannot write it differently, and it is labelled with the currency it moves TO. Every money figure measures itself with `useFitText`, which is why a six-figure pool, cash balance or patrimony gives way instead of pushing past the card.
- **A new expense starts at the rate the balance card is using**: `ExpenseForm` has always taken a `defaultRate`; the dashboard simply never passed it, so every new expense opened with a rate of 0,00. It is fed `contextRate`, which is the day's rate when a day filter is active and **the budget form's own rate otherwise -- not the month's**. The month rate is the first of the month carried forward, so on a budget whose form holds a custom rate it handed a new expense a price the balance card was not even displaying, and the expense's dollar equivalent quietly disagreed with the figure on screen. A day with no published observation falls back to the form's rate for the same reason, exactly as the card does. The field stays editable: a day picked in the form's own calendar re-reads that day's rate from `exchange-rate/history`, but only while the field still holds the rate the form filled in, so a custom rate the user typed is never overwritten.
- **Long rate ranges are honest about what is stored**: `1A` and `Todo` showed a truncated window because the archive that fills them is a bulk download, and it was being given the same two-second budget as the daily rate -- which a history of thousands of entries never fits inside. Bulk calls get their own budget, the archive is pulled by the refresh button rather than by the request that has to draw the chart, and the chart states the span it really has. `ensureFresh` only backfills history after a fetch that actually succeeded, so a cold start with no connection costs the daily timeout and no more.
- **Back closes what is open**: a hardware or gesture back in a WebView is a history navigation, not a key event, so menus, dialogs and dropdowns never saw it and the app navigated away underneath them. `useDismissOnBackButton` stands a sentinel history entry while a layer is open; back pops it and closes the layer instead. It is wired into `Modal` (every dialog in the app), `Dropdown` and the header's overflow menu, and it re-arms the sentinel so back keeps closing rather than escaping on the second press. The header's popover dismissal is `useMenuDismiss`, which wraps that same guard with tap-away and Escape.
- **One header, four screens**: `AppHeader` is rendered by Dashboard, Ahorros, Análisis and Configuración. It used to be `DashboardHeader`, imported by the Dashboard and nothing else, so the other three hand-rolled their own into the layout's header slot: four gutters (`px-3` against the pages' `px-4`, plus a second `px-4` on two of them) and two title sizes that jumped as you navigated. The gutter belongs to the layout alone, the title is a real `<h1>` on every screen, and the view switcher is a full-width segmented control that stays readable on a phone -- the old pill hid the view name below the `sm` breakpoint, which is exactly where a `title` tooltip never appears. It doubles as the swipe affordance, since the three dashboards are a swipe with no other sign they are swipeable. Theme and settings moved into an overflow menu, and the theme is `useTheme` rather than `useState` inside the Dashboard, so all four screens can reach it.
- **JavaScript Test Suite**: Vitest covers the pure money, rate and range logic that the PHP suite cannot reach, and renders components in both display currencies to prove they state one savings pot and do not throw at render.
- **A crash has to be readable, and a blank screen has to be a failure**: there was no error boundary anywhere, so one undefined identifier unmounted the whole app and left a featureless rectangle. That was a real 0.5.1 bug that passed a green build and 336 green assertions, because the bundler does not resolve JSX identifiers and no test imported the page. `AppErrorBoundary` now shows the message and a reload button instead of nothing; `color-scheme` follows the app's own toggle rather than the OS, which is what painted that blank canvas black and made it look like a device fault; and `pageComponents.test.js` reads every page and requires each component it renders to be imported or declared, so the same mistake fails the suite.


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

- **Temporary LAN Editing**: an Android-only **Escritorio remoto** option that exposes the app to a computer on the same Wi-Fi, editing budgets, expenses, debts, savings and transfers against the phone's single SQLite database.
- **NativePHP Plugin**: the local `budget-web/nativephp-remote-desktop` plugin adds `RemoteDesktop.Start/Status/Stop`. It opens a `ServerSocket` on the Wi-Fi interface (port `8080`), finds the phone's LAN IPv4, serves assets, and forwards requests into the embedded PHP runtime.
- **Pairing Flow**: The phone displays a local URL and temporary pairing code. A computer opens the URL, enters the code, receives an HttpOnly remote-session cookie, and can then use the complete BKeeper web interface. QR-code pairing is intentionally deferred to a later release.
- **Automatic Shutdown**: Remote access expires automatically after 15 minutes by default, with a visible countdown and an immediate **Desconectar escritorio** action. Sessions, pairing state, and the listening socket are cleared when the server stops.
- **Isolated Browser State**: LAN requests use an explicit cookie header, keeping the computer's Laravel session separate from the phone WebView's cookie jar while still using the same application database and PHP execution lane.
- **Security Boundaries**: `/remote-desktop/status`, `/start` and `/stop` are blocked to remote clients, so a paired computer cannot fetch the pairing token or drive the listener. Bodies are size-limited, and this is for trusted LANs only.
- **Device Gating**: The settings option appears only when NativePHP reports an Android runtime with the compiled `RemoteDesktop.Start` bridge function. Web and unsupported platforms do not expose the feature.
- **Backend and UI**: Added `RemoteDesktopManager`, `RemoteDesktopController`, start/status/stop routes, native capability detection, and a centered mobile settings panel with activation, address/code copy actions, expiration countdown, errors, and disconnect controls.
- **Android Build Requirement**: The feature compiles against Android API 26+ and requires Java 17 or newer for the Android Gradle Plugin. The project was validated with the installed Java 21 runtime (`C:\Users\DANIE\.jdks\jbr-21.0.11`).
- **Validation**: NativePHP plugin validation, Android Kotlin compilation (`compileDebugKotlin`), the production Vite build, and the Laravel test suite all passed. Physical-device LAN testing remains necessary to verify router/client isolation and foreground Android behavior.
- **Security Limitation**: The current implementation uses local HTTP and is not intended for public-internet exposure. A production-grade remote service would require TLS, durable user authentication, device pairing/revocation, and optimistic-lock conflict handling for simultaneous phone/PC edits.

### alpha 0.4.1 — Remote Desktop White-Screen Fix & Reproducible Android Patches

- **Root Cause of the White Screen**: `serveStatic()` only served paths under `build/`, so Vite asset requests fell through to PHP and came back as HTML under a JavaScript MIME type; the browser refused the script and React never mounted. Pairing is pure Kotlin, so it still appeared to work.
- **Asset Resolution Rewritten**: `serveStatic()` now mirrors the phone WebView's own strategy -- requested path, then `vendor/`, then `build/` -- instead of a prefix allow-list. Correct MIME types and cache headers were added; path traversal stays blocked.
- **HTTP Response Hardening**: `writeRawResponse()` now finds the header/body separator, preserves or synthesizes a status line, strips stale length headers, and guarantees a `Content-Type` so HTML always parses.
- **Origin and Cookie Re-Hosting**: `http://` and `https://127.0.0.1` are rewritten to the LAN origin in the body, in `Location` and in `Set-Cookie`, and cookie `Domain`/`Secure` are stripped so a session survives plain HTTP. This did not fix the origin problem -- see 0.4.4.
- **Correct Status Lines**: Added a reason-phrase table. The server previously emitted invalid lines such as `HTTP/1.1 303 OK` and `404 OK`; the pairing redirect is now a proper `303 See Other`.
- **Visible Failures**: A blank upstream response now returns a styled `502` page naming the failing method and path, instead of silently producing empty output. Future regressions will be diagnosable from the browser.
- **Reproducible Android Patches**: the remote desktop needs three Kotlin edits inside the generated `nativephp/android` scaffold, which `native:install` and the plugin compiler both regenerate. They live in `Support\AndroidBridgePatches` and run from a `post_compile` hook:
  1. `PHPBridge.handleLaravelRequest()` gains an overload accepting an explicit `Cookie` header, so a LAN client keeps its own session instead of being merged into — or overwriting — the phone's cookie store.
  2. `MainActivity.phpBridge` is made public so plugin bridge functions can dispatch into the same persistent PHP runtime.
  3. `ShareFunctions` learns that `.json` is `application/json`, so a backup handed to the share sheet is not offered as the `*/*` catch-all.
- **Why a hook rather than a manual step**: the three targets are perishable at two different points -- `PHPBridge.kt` and `MainActivity.kt` are reset by `native:install`, while `ShareFunctions.kt` does not exist until the plugin compiler has run.
- **Patch Design**: matching is regex-based and line-ending aware, and *every* match is rewritten -- patching one of several identical sites would otherwise report success and ship a half-patched APK. An out-of-band match count fails rather than applying a partial edit.
- **A failed patch is loud but NOT fatal**: `PluginHookRunner::runPluginHook()` downgrades a non-zero exit to a warning and proceeds to Gradle, so the hook cannot abort the build. Treat a `[FAILED]` line as *do not install this APK*.
- **The LAN re-host fix is not a patch**: it lives in the plugin's own `RemoteDesktopServer.kt`, which the compiler re-copies on every build. The hook only *asserts* it is present, so a regression is caught instead of shipped.
- **Manual escape hatch**: `php packages/nativephp-remote-desktop/patch-android.php [--check]` still applies or reports the same patches, delegating to the shared class rather than duplicating it. `--check` exits non-zero when anything is missing, making it usable as a CI or pre-build guard.
- **Validation**: the cycle was verified from a pristine vendor baseline -- files restored, patches applied from scratch, re-run as a no-op, `--check` clean. The generated Kotlin was inspected to confirm indentation survived.

### alpha 0.4.3 — Remote Desktop & Import/Export
- **Reworked native php calls**: Now all features should work

### alpha 0.4.4 — Remote Desktop Origin & Pairing Hardening

- **White screen root cause**: `writeRawResponse()` converted the body to bytes *before* running the re-host rewrite, so the rewritten string was thrown away and the original bytes were sent.
- **Laravel generates the right URLs**: `HandleRemoteDesktopOrigin` reads `X-Remote-Desktop-Origin` and rebinds `URL::useOrigin()`, `URL::useAssetOrigin()` and the Vite resolver for that request, so `@vite` emits LAN URLs natively.
- **No `trustProxies()`**: the middleware binds the origin itself, and trusting every peer would let any `X-Forwarded-*` rewrite it. Overrides are wrapped in `try`/`finally` because NativePHP keeps one warm interpreter.
- **Pairing**: only a SHA-256 digest is stored and compared in constant time, 5 failures trigger a 15-minute per-IP lockout, and the TTL is checked on every connection. `/remote-desktop/*` returns `404` to remote clients.
- **Verification**: PHP is covered by tests (108 passing, 1 pre-existing skip). **The Kotlin has not been compiled** — no Android build has run against these changes, so device behaviour is unconfirmed.

### alpha 0.4.5 — Dashboard UI Tightening, Análisis & Touch Fixes

- **One owner for the month figures**: the Balance card no longer repeats `Ingresos` / `Gastos`; `MonthSummaryStrip` is the single surface for them. The dashboard was showing two differently-sourced numbers under one label.
- **`Gastos` now means one thing**: the strip was summing `visibleCategories`, which honours the 7d/1d filter, so it disagreed with the balance card and the graph. All three now call the shared `calculateCashExpenses()` helper.
- **Balance figure matches the other dashboard heroes**: the hero now renders at 48px like the Savings hero unless the value would genuinely overflow. `useFitText` only searches when the value clips, and now re-measures after webfonts load.
- **Savings tiles and movement rows never truncate**: the pool line, movement tag and each `Bs/$` line run through `useFitText` and shrink instead of clipping. The pieces had to become real components because the fit search is a hook and cannot run inside a `.map`.
- **Debt form "Estado actual" panel readable in dark mode**: the row labels used `text-gray-500` with no `dark:` variant and the amounts carried no colour, so the panel inherited the modal foreground at low contrast. Every value is now themed.
- **Clear actions consolidated into Settings**: the dashboard menu and the Settings card both offered deletes with different wording and reach. The menu now offers only `Llenar datos de prueba`, and `StorageCard` owns all three deletes.
- **Settings clear actions now do what they promise**: `Limpiar datos del día` called a route that was never registered, so it had never worked. `Limpiar todos los datos` used `truncate()`, which on SQLite resets AUTOINCREMENT and skipped `transfers`. All three leave `exchange_rates` untouched.
- **BCV history defaults to 1M with a permanent 30D figure**: the shorter default cannot supply a full 30-day lookback, so the badge falls back to the oldest point available and is marked with a `*`, rather than being silently wrong. `Historial` also surfaces forward-published rates.
- **Tightened the other two hero cards**: `items-start` left dead space beneath the small titles on the Savings and BCV cards, since the row was sized by its larger button. The rows are now `items-center`.
- **Rate badge shares the `$` line**: the pill, error dot and refresh button sat on an `items-end` row, pinning the pill to the glyph baseline so it looked like it was floating. The row is now `items-center`.
- **Summary strip dividers strengthened**: `divide-gray-100/800` was effectively invisible; now `divide-x-2 divide-gray-200 dark:divide-gray-700`, with `px-5 py-4` and per-column padding so no figure sits flush against a rule.
- **Graph header**: the `Presupuesto cubierto` / `excedido` badge now sits on the same line as the metric title, right-aligned. It shares the row with the *title* only — the amount keeps its own full-width line beneath, so the badge can no longer squeeze the figure as it did before.
- **`Tasa Diaria BCV` is now a checkbox**: the custom switch lit up exactly when the rate was automatic, because its active state was bound to `!is_custom_rate`. Checked = use the latest daily BCV rate; unchecked = the typed value is kept.

- **`Ánálisis` is a destination of its own**: the summary strip's three figures navigate to `/insights`, and the panel grows out of the strip through a shared `layoutId`. It is a real route because it needs its own URL and back control.
- **Every figure is derived, never duplicated**: `resources/js/lib/insights.js` holds `buildInsights()`, pure functions alongside `budgetExpenses.js` / `debtMath.js`, so the arithmetic is testable without mounting React. `daysElapsed()` keeps the projection honest.
- **Ánálisis figures that looked right and were not** — four of them, each a case of the code being correct and the answer still wrong:
  · The hero’s `useFitText` bounds were `{ min: 22, max: 44 }` against the balance card’s `{ min: 30, max: 48, emergencyMin: 22 }`, so the two heroes never matched. They now share the card’s parameters and its `text-5xl` baseline.
  · `Gasto de presupuesto` divided each category by the plan total, which is **100% by construction** whenever a month has one plan category — a number that cannot mean anything. It now reports plan against `available_balance_bs` using the same `available >= plan` rule the dashboard’s `isBudgetOk` already applies, and the per-category shares stay plain labels. A zero available balance stays neutral rather than warning, since there is nothing to compare against.
  · The savings rate counted only `kind === 'transaction' && type === 'deposit'`, so money moved into a pool as a **transfer** was silently dropped and the rate read 0% for anyone who funds savings that way. Flow is now counted by direction, mirroring the rule the balance graph already uses.
  · Presupuesto expenses were tagged `Gasto` in the activity feed, because the tone map had no entry for them and they fell through to the default. They now carry the same indigo `Presupuesto` badge the expense card already uses.
- **The balance graph can be touched again**: `drag="x"` on the view wrapper made framer's drag compete with the chart's own `onTouchMove`, so the graph could not be inspected on touch at all. The wrapper is now a plain `pan-y` surface.
- **The swipe threshold was backwards in both directions**: the old rule was `Math.abs(offset.x) * velocity.x > 10000`, so a 20px twitch committed as a swipe while a slow 200px drag was rejected. Distance now decides.
- **Press feedback on every control**: `useHapticFeedback` adds a 10ms `navigator.vibrate` on press for anything inside `.touch-feedback`, through one delegated listener. The class was already the app-wide convention, so no call site changed.
- **No JS test runner**: the threshold logic was verified against 14 cases and then the harness was removed. `package.json` has no `test` script and neither vitest nor jest is installed, so standing tests up was a toolchain decision left to the maintainer rather than something added uninvited.

### alpha 0.5.0 — Euro Display Currency, Test Suite & Truthful Filtering

- **Every figure can be read in dollars or euros**: `exchange_rates` became currency-scoped, keyed by `(date_iso, currency)`, with euros fetched from the same endpoints as dollars -- one URL template rather than a second implementation that could drift.
- **The two rate rules live in one tested function**: a rate picked from a specific day uses that day's published rate *for the currency on screen*, so a euro figure is a real historical euro rate. A custom rate is applied verbatim, with only the symbol changed.
- **Savings are stored in dollars, so euros need a cross rate.** 
- **The preference is a display setting, not a stored one**, on the same `localStorage` convention the theme uses, because the app allows signed-out use. A pre-paint script sets it before React mounts.
- **`lib/money.js` was split rather than grown.** Formatting stays pure in `money.js`; the currency context and the pure conversions live in `lib/currency.jsx`; `hooks/useFigure.jsx` bridges a stored figure to the one the user reads. A component that only needs a number never pulls in a context.
- **Two guards now stand where nothing stood before**: `useCurrencyGuard.test.js` fails if any component hard-codes a dollar sign, and if a currency value is rendered by a component that does not bind it. That second mistake ships a white screen.
- **A JS test suite exists.** `npm test` runs Vitest over the pure logic the PHP suite cannot reach: the swipe threshold, day-range rules, debt and savings arithmetic, insights derivations, and currency rules.
- **Filtering is now truthful under a day filter.** Four surfaces derived the same answers separately and disagreed: the balance hero ignored credit and debt payments, the graph skipped debt payments, the plan tint compared a month total against a month balance. All four now read one `scopeMonth()`.
- **Three pre-existing bugs fell out of that work.** The 7-day window started at 23:59:59 of its first day, silently dropping that whole day. `creditPurchasesAsOf` omitted the backend's `debt_id` filter. And `rangeHelpers` had to leave the Dashboard page to be importable.
- **A real financial export was found committed to the repository.** `database/data/september.private.json` was tracked from the first commit and had reached `origin/main`. It is now untracked and ignored, but remains recoverable from history.

### alpha 0.5.1 — Unified App Header

- **There was never one header.** `DashboardHeader` was imported by `Dashboard.jsx` and nothing else, so Savings, Ánálisis and Configuración each hand-rolled a second header: four gutters and two title sizes that jumped as you navigated.
- **The view switcher was invisible on the one device that needed it.** The old pill carried `hidden sm:inline` on the view name, so on a phone -- where the `title` tooltip never appears -- you got a bare icon.
- **Four header buttons became two.** A currency pill, plus an overflow menu holding the theme and settings. The currency switch keeps its "moves TO" semantics, because a switch labelled with the currency you are already in reads as a no-op.
- **The theme is reachable from every screen now.** It was `useState` inside `Dashboard.jsx`, so the other three headers simply had no theme control. It is `useTheme`, alongside the other app-wide display preference that already lived in `localStorage`.
- **The title is a real `<h1>` on every screen.** Three pages used an `<h2>` as their page title, the dashboard had no heading at all, and one screen rendered a second `<h1>` inside its own panel.
- **"Ir a hoy" no longer shifts the layout.** It was mounted and unmounted with `isNotToday`, shoving the title sideways every time the month changed. It stays in place, dimmed and disabled.
- **The overflow menu is a keyboard widget.** Arrow keys walk its rows, opening lands focus on the first one, and Escape or the Android back button closes it and returns focus to the trigger. All three are now `useMenuDismiss`.
- **The shell gaps, closed.** `env(safe-area-inset-bottom)` (only the top inset was handled, so the Android home indicator could overlap content), a `theme-color` meta that tracks the light/dark toggle, `color-scheme`, and a skip link to `<main>`.
- **A test that did not test its claim.** The old suite asserted the view name was in the markup, which `renderToStaticMarkup` emits whether or not CSS hides it -- so the phone case could fail and the test would stay green.
- **Version drift, fixed.** `package.json` still said `0.4.1-alpha` while the changelog documented 0.5.0, so Configuración had been showing a version two releases behind to anyone who looked.

### alpha 0.5.2 — Settings Crash, Credit Badge & Light-Theme Ink

- **Opening Configuración was a black screen, and the bug was a missing import.** 0.5.1 gave every page the new `AppHeader` but not to Settings, so the page rendered a component out of scope and the whole tree unmounted.
- **`color-scheme` was making the crash look like a device fault.** 0.5.1 set `<meta name="color-scheme" content="light dark">`, which tells the browser to follow the *OS*. That contradicts the app's own toggle and paints the blank canvas black.
- **There is an error boundary now.** There was none anywhere, so any render error cost the whole app and the user saw a featureless rectangle with no way to read what happened. `AppErrorBoundary` shows the message and a reload button, and still logs the stack.
- **A test would have caught it, so there is one.** `pageComponents.test.js` reads every page and requires each component it renders to be imported or declared. It fails on the exact fault, proved by removing the import again.
- **CrCrédito is now a tag in "Actividad reciente".** Credit purchases were never missing from the list; they were badged `Gasto`, which tells the reader their cash is gone when a credit purchase has not left the balance yet. (0.5.3 splits the predicate.)
- **The activity amounts are whole.** They were a fixed `w-16` *and* `truncate`, so a large amount was cut before the ellipsis ever mattered. They size to their content now and the label absorbs the squeeze.
- **Three headings had no light-theme colour at all.** The Mes/7d/1d active filter and both history headings specified only `dark:text-white`; in light mode the label inherited whatever colour it landed on.
- **The `≈ Bs … · tasa BCV` line stays inside its tile.** 0.5.1 put `whitespace-nowrap` on the neighbouring label, which was right, and the same instinct was carried onto the bolivar line, which was not: a long unbreakable number inside a shrinkable box overflowed the card. It wraps now.
- **"Externo (no afecta el saldo disponible)" is one line** on the retiro path. The depósito path is a native `<select>`, whose option text cannot be nowrap'd the same way and is left alone.

### alpha 0.5.3 — Credit Tagging, Unassigned Credit Totals, Debt Names

- **A credit purchase linked to a debt was badged as cash.** The `CrÉdito` tag reused `isCreditExpense`, whose `debt_id == null` test exists only to avoid totalling a debt's charges twice. Filed under a debt, the row claimed the cash had left. `isCreditCategory` now drives the tag.
- **Unassigned credit purchases were subtracted twice, and the error hid as zero.** The SQL already excludes debt-linked charges, so subtracting them again in JS emptied the figure, and `Math.max(0, ...)` showed that as *nothing* -- which reads as "everything is assigned".
- **Debt names shrink to fit instead of being cut off.** `truncate` cut them mid-word. The existing `useFitText` hook now sizes each label, floored at 9px so a name never becomes unreadable, wrapping below that rather than hiding its end.
- **Two tests that locked in the old behaviour were corrected, not deleted.** Both asserted the bug. They now pin the credit tag and the backend-filtered total. Suite: 362 passing, up from 360.


## Build and Current-Phase Checks

Prerequisites: PHP 8.3+, Node.js, Composer, Java 17+, Android SDK.

1. **Install Dependencies**:
   ```bash
   composer install
   npm install
   ```
   > **Known peer conflict**: `@vitejs/plugin-react@4.7.0` does not declare support for
   > Vite 8, which this project already runs, so a plain `npm install` fails to resolve
   > the tree. Use `npm install --legacy-peer-deps`. This predates the euro work; vitest
   > 4 is compatible with Vite 8 and is installed the same way.
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

4. **Run the tests**:
   ```bash
   php artisan test    # backend
   npm test            # frontend: money, rates, ranges, insights, currency rules
   ```
   The frontend suite exists because the money and filtering logic is where the
   subtle bugs live, and PHPUnit cannot reach any of it. Neither suite can render a
   React component, which is why `useCurrencyGuard.test.js` checks components at
   the source level for the two mistakes that ship a white screen, and
   `pageComponents.test.js` checks every page for a component it renders but never
   imported -- the mistake that shipped a black screen in 0.5.1. It reads the page
   files rather than mounting them, so it is the only guard covering the pages, which
   nothing else imports. Both suites must pass before a release, and neither can be
   run while `npm run build` is rewriting `public/build/manifest.json`.
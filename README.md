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

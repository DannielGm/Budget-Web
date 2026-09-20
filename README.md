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

## Finished Phases

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

### alpha 0.2.5 — Performance, UI Polish & Graphing
- **Performance Optimizations**: Drastically reduced load times by muting NativePHP's JumpBridge off-device, lazy-loading savings ledgers via Inertia, memoising Budget aggregates, and optimizing BCV API caching.
- **Advanced Graphing**: Multi-metric "Flujo" graph tracking Available Budget, Expenses, and Savings.
- **Presupuesto Threshold**: Dotted threshold line on charts with dynamic green/red color coding based on affordability.
- **Planning Categories**: Reworked category logic where `is_presupuesto` flag enables planning without affecting real cash balance.
- **Category Accordion**: Modern accordion dialog for quick category switching, creation, and deletion.
- **Additive Transactions**: Re-implemented "Add to current" logic for Incomes and Debt payments.
- **Debt History**: Individual payment tracking with a full viewable/deletable history log.
- **Historical Rates**: Calendar-based historical BCV rate picker for budget configuration.
- **Dynamic Mockups**: Improved seeder to generate 4-month trends (3 up, 1 down) from any starting month.

## Planned Phases

### alpha 0.3.0 — 
- *To be determined*

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

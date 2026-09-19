# Presupuesto Web — Laravel + React Migration Fork

Project: `E:\Projects\Budget-Web`

Laravel 11, SQLite, React (Inertia.js), and Tailwind CSS. This is a web-based migration of the Budget Android app, designed for cross-platform availability while maintaining the authoritative financial logic and "Single Screen" UX.

## Implemented

- **Core Logic Parity**: Ported the "September" financial formulas (Cash vs. Credit, Debt calculation, etc.) from Kotlin to PHP.
- **Carry-forward Engine**: Automated rollover of closing balances and unpaid debt between months.
- **Web Dashboard**: Responsive React-based UI that replicates the Android dashboard structure.
- **Interactive Graph**: Visual budget tracking powered by Recharts, showing balance movements over time.
- **Persistent Storage**: Backed by a clean SQLite schema with Eloquent models for Budgets, Categories, Expenses, and Debts.
- **Seeded Data**: Initial migration automatically imports the authoritative September data from the Android project.
- **Theme Toggle**: Full support for Light and Dark modes.

## Privacy

`database/data/september.private.json` contains real financial data. It is Git-ignored but **not encrypted**. The local SQLite database (`database/database.sqlite`) stores all sensitive information. Ensure this environment is kept private and secure.

## Finished phases

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

## Planned phases

### alpha 0.2.0 — Binance Integration
- Introduce the dedicated Binance transaction detail and history view.
- Replace manual conversions with a traceable trade reconciliation system.

## Build and current-phase checks

Prerequisites: PHP 8.3+, Node.js, and Composer.

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
3. **Run Development Server**:
   ```bash
   # Terminal 1
   php artisan serve
   # Terminal 2
   npm run dev
   ```

The application will be accessible at `http://localhost:8000`.

## Verification status

**alpha 0.1.0** successfully initialized and verified.

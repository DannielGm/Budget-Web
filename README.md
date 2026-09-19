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

## Planned phases

### alpha 0.0.2 — Interactive Editing & Dialogs
- Port all remaining editor dialogs (Income addition, Expense creation/editing, Debt management).
- Implement server-side validation for all financial inputs.
- Add real-time UI updates after successful edits using Inertia.js state management.

### alpha 0.0.3 — Multi-month Navigation & Calendar
- Implement a web-based version of the Month/Day calendar picker.
- Enable full multi-month navigation and day-level filtering on the dashboard.
- Sync BCV exchange rate logic with the web backend for automatic daily updates.

### alpha 0.1.0 — Feature Parity
- Reach 100% feature parity with the Android Phase 4.3.2 release.
- Implement comprehensive unit and feature tests in PHP (Pest/PHPUnit).

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

**alpha 0.0.1** successfully initialized and verified. Confirmed that "Saldo disponible" and "Deuda" calculations match the Android reference data. Verified responsive layout behavior and theme switching on desktop and mobile browsers.

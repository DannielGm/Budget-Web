# Alpha 0.0.2 — Interactive Editing & Dialogs

This phase focuses on migrating the interactive editing features from the Android project to the web. This includes creating/editing expenses, managing income and exchange rates, and updating debt payments.

## User Review Required

> [!IMPORTANT]
> The "Remaining features" migration mentioned by the user will be handled in subsequent phases (e.g., Binance integration in Alpha 0.2.0). Alpha 0.0.2 is strictly about the CRUD operations for the core budget entities.

## Proposed Changes

### [Backend] API Routes & Controllers

#### [MODIFY] [web.php](file:///E:/Projects/Budget-Web/routes/web.php)
- Add routes for:
    - `POST /expenses` (store)
    - `PATCH /expenses/{expense}` (update)
    - `DELETE /expenses/{expense}` (destroy)
    - `PATCH /budgets/{budget}` (update income/rate/opening balance)
    - `POST /debts` (store)
    - `PATCH /debts/{debt}` (update payment)
    - `DELETE /debts/{debt}` (destroy)

#### [MODIFY] [BudgetController.php](file:///E:/Projects/Budget-Web/app/Http/Controllers/BudgetController.php)
- Implement `update` for Budget.
- Create (or use) `ExpenseController` and `DebtController` for their respective CRUD operations.
- Ensure all financial inputs are validated (numeric, min:0).

### [Frontend] Components & Modals

#### [NEW] [ExpenseForm.jsx](file:///E:/Projects/Budget-Web/resources/js/Components/Budget/ExpenseForm.jsx)
- A modal form for adding/editing expenses.
- Fields: Label, Amount (Bs), Rate (defaults to budget income rate), Timestamp.

#### [NEW] [BudgetForm.jsx](file:///E:/Projects/Budget-Web/resources/js/Components/Budget/BudgetForm.jsx)
- A modal form for editing the budget.
- Fields: Income (Bs), Income Rate (BCV), Opening Balance.

#### [NEW] [DebtForm.jsx](file:///E:/Projects/Budget-Web/resources/js/Components/Budget/DebtForm.jsx)
- A modal form for managing debt.
- Fields: Label, Opening Amount (Bs), Payment (Bs).

#### [MODIFY] [Dashboard.jsx](file:///E:/Projects/Budget-Web/resources/js/Pages/Dashboard.jsx)
- State management for showing/hiding modals.
- Integration of `ExpenseForm`, `BudgetForm`, and `DebtForm`.
- Add "Edit" and "Delete" icons to expense rows (visible on hover or click).
- Implement the "Deuda" section in the UI (currently missing or partial).

## Verification Plan

### Automated Tests
- Run `php artisan test` after implementing controller methods.
- Create new feature tests for Expense CRUD.

### Manual Verification
- Verify that adding an expense updates the "Saldo disponible" and "Graph" immediately (via Inertia reload).
- Verify that changing the exchange rate updates all USD conversions across the dashboard.
- Verify that deleting an expense restores the balance correctly.

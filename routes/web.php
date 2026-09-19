<?php

use App\Http\Controllers\BudgetController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\SavingTransactionController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

// The budget screens are intentionally public: signing in is optional for now.
// Authentication remains available through the account menu in the dashboard
// header, but it is not required to open or use the app.
Route::get('/', [BudgetController::class, 'index'])->name('dashboard');

// Manual "refresh BCV rate" endpoint used by the balance card.
Route::post('/exchange-rate/refresh', [BudgetController::class, 'refreshRate'])->name('exchange-rate.refresh');

Route::patch('/budgets/{budget}', [BudgetController::class, 'update'])->name('budgets.update');
Route::patch('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update');

Route::get('/settings', [BudgetController::class, 'settings'])->name('settings');
Route::post('/settings/clear', [BudgetController::class, 'clearAll'])->name('settings.clear');

Route::post('/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
Route::patch('/expenses/{expense}', [ExpenseController::class, 'update'])->name('expenses.update');
Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->name('expenses.destroy');

Route::post('/debts', [DebtController::class, 'store'])->name('debts.store');
Route::patch('/debts/{debt}', [DebtController::class, 'update'])->name('debts.update');
Route::delete('/debts/{debt}', [DebtController::class, 'destroy'])->name('debts.destroy');

Route::post('/savings', [SavingTransactionController::class, 'store'])->name('savings.store');
Route::patch('/savings/{transaction}', [SavingTransactionController::class, 'update'])->name('savings.update');
Route::delete('/savings/{transaction}', [SavingTransactionController::class, 'destroy'])->name('savings.destroy');

Route::get('/export', [ExportController::class, 'export'])->name('export');
Route::post('/import', [ExportController::class, 'import'])->name('import');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

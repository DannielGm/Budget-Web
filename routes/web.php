<?php

use App\Http\Controllers\BudgetController;
use App\Http\Controllers\DebtController;
use App\Http\Controllers\ExpenseController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\SavingTransactionController;
use App\Http\Controllers\TransferController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

// The budget screens are intentionally public: signing in is optional for now.
// Authentication remains available through the account menu in the dashboard
// header, but it is not required to open or use the app.
Route::get('/', [BudgetController::class, 'index'])->name('dashboard');

// Manual "refresh BCV rate" endpoint used by the balance card.
Route::post('/exchange-rate/refresh', [BudgetController::class, 'refreshRate'])->name('exchange-rate.refresh');
Route::get('/exchange-rate/history', [BudgetController::class, 'historicalRate'])->name('exchange-rate.history');

Route::patch('/budgets/{budget}', [BudgetController::class, 'update'])->name('budgets.update');
Route::post('/categories', [CategoryController::class, 'store'])->name('categories.store');
Route::patch('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');

Route::get('/settings', [BudgetController::class, 'settings'])->name('settings');
Route::post('/settings/clear', [BudgetController::class, 'clearAll'])->name('settings.clear');
Route::post('/settings/seed-mock', [BudgetController::class, 'seedMock'])->name('settings.seed-mock');
Route::post('/settings/clear-month', [BudgetController::class, 'clearMonth'])->name('settings.clear-month');

Route::post('/expenses', [ExpenseController::class, 'store'])->name('expenses.store');
Route::patch('/expenses/{expense}', [ExpenseController::class, 'update'])->name('expenses.update');
Route::delete('/expenses/{expense}', [ExpenseController::class, 'destroy'])->name('expenses.destroy');

Route::post('/debts', [DebtController::class, 'store'])->name('debts.store');
Route::patch('/debts/{debt}', [DebtController::class, 'update'])->name('debts.update');
Route::delete('/debts/{debt}', [DebtController::class, 'destroy'])->name('debts.destroy');
Route::delete('/debt-payments/{payment}', [DebtController::class, 'destroyPayment'])->name('debt-payments.destroy');

Route::post('/savings', [SavingTransactionController::class, 'store'])->name('savings.store');
Route::patch('/savings/{transaction}', [SavingTransactionController::class, 'update'])->name('savings.update');

Route::post('/transfers', [TransferController::class, 'store'])->name('transfers.store');
Route::delete('/savings/{transaction}', [SavingTransactionController::class, 'destroy'])->name('savings.destroy');

Route::patch('/transfers/{transfer}', [TransferController::class, 'update'])->name('transfers.update');
Route::delete('/transfers/{transfer}', [TransferController::class, 'destroy'])->name('transfers.destroy');


Route::get('/export', [ExportController::class, 'export'])->name('export');
Route::post('/import', [ExportController::class, 'import'])->name('import');

// File transport for the compiled mobile build. Its WebView can neither save a
// downloaded response nor open a file input, so the backup is written into the
// app's own storage and handed to the OS Save-As dialog / share sheet instead,
// and the chosen file comes back through a native event listener rather than a
// request body.
Route::post('/backup/export', [ExportController::class, 'exportNative'])->name('backup.export');
Route::post('/backup/import/pick', [ExportController::class, 'pickImportFile'])->name('backup.import.pick');
Route::get('/backup/status', [ExportController::class, 'status'])->name('backup.status');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';

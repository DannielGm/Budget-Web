<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Budget extends Model
{
    protected $primaryKey = 'month_id';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'month_id',
        'month_label',
        'income_bs',
        'income_rate',
        'opening_balance_bs',
    ];

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class, 'month_id', 'month_id')->orderBy('position');
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'month_id', 'month_id')->orderBy('position');
    }

    public function debts(): HasMany
    {
        return $this->hasMany(Debt::class, 'month_id', 'month_id')->orderBy('position');
    }

    public function savingsTransactions(): HasMany
    {
        return $this->hasMany(SavingTransaction::class, 'month_id', 'month_id')->orderBy('timestamp', 'asc');
    }

    public function getCashBsAttribute(): string
    {
        return once(fn() => (string) $this->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', true)
            ->sum('amount_bs'));
    }

    public function getCreditPurchasesBsAttribute(): string
    {
        return once(fn() => (string) $this->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', false)
            ->sum('amount_bs'));
    }

    public function getDebtPaymentsBsAttribute(): string
    {
        return once(fn() => (string) $this->debts()->sum('payment_bs'));
    }

    public function getNetSavingsBsAttribute(): string
    {
        return once(function () {
            $depositsBs = $this->savingsTransactions()->where('type', 'deposit')->sum('amount_bs');
            $withdrawalsBs = $this->savingsTransactions()->where('type', 'withdrawal')->sum('amount_bs');
            return bcsub((string)$depositsBs, (string)$withdrawalsBs, 2);
        });
    }

    public function getTotalSavingsUsdAttribute(): string
    {
        return once(function () {
            $depositsUsd = $this->savingsTransactions()->where('type', 'deposit')->sum('amount_usd');
            $withdrawalsUsd = $this->savingsTransactions()->where('type', 'withdrawal')->sum('amount_usd');
            return bcsub((string)$depositsUsd, (string)$withdrawalsUsd, 2);
        });
    }

    public function getAvailableBalanceBsAttribute(): string
    {
        // Available Budget = Opening + Income - CashExpenses(EXCLUDING Presupuesto) - DebtPayments - NetSavings
        $balance = bcadd($this->opening_balance_bs, $this->income_bs, 2);
        $balance = bcsub($balance, $this->cash_bs, 2);
        $balance = bcsub($balance, $this->debt_payments_bs, 2);
        $balance = bcsub($balance, $this->net_savings_bs, 2);
        return $balance;
    }

    public function getTrueBudgetBsAttribute(): string
    {
        // True Budget = Available Balance + (Total Savings USD * Current BCV Rate)
        $savingsValueInBs = bcmul($this->total_savings_usd, $this->income_rate, 2);
        return bcadd($this->available_balance_bs, $savingsValueInBs, 2);
    }

    public function getBalanceBsAttribute(): string
    {
        // Maintained for backward compatibility in the dashboard, maps to available balance
        return $this->available_balance_bs;
    }

    public function getDebtBsAttribute(): string
    {
        $debtsRemaining = $this->debts->sum(fn($d) => bcsub($d->opening_bs, $d->payment_bs, 2));
        return bcadd($this->credit_purchases_bs, (string)$debtsRemaining, 2);
    }
}

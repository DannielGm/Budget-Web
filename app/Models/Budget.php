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

    public function transfers(): HasMany
    {
        return $this->hasMany(Transfer::class, 'month_id', 'month_id')->orderBy('timestamp', 'asc');
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


    public function getTotalDepositsBsAttribute(): string
    {
        return (string) $this->savingsTransactions()
            ->where('type', 'deposit')
            ->sum('amount_bs');
    }

    public function getTotalWithdrawalsBsAttribute(): string
    {
        return (string) $this->savingsTransactions()
            ->where('type', 'withdrawal')
            ->sum('amount_bs');
    }

    public function getAvailableBalanceBsAttribute(): string
    {
        // Available Budget = Opening + Income - CashExpenses - DebtPayments - TotalDeposits + TotalWithdrawals - TransfersOut + TransfersIn
        $balance = bcadd($this->opening_balance_bs, $this->income_bs, 2);
        $balance = bcsub($balance, $this->cash_bs, 2);
        $balance = bcsub($balance, $this->debt_payments_bs, 2);
        $balance = bcsub($balance, $this->total_deposits_bs, 2);
        $balance = bcadd($balance, $this->total_withdrawals_bs, 2);

        $transfersOut = once(fn() => $this->transfers()->where('source_type', 'cash')->sum('amount_bs'));
        $transfersIn = once(fn() => $this->transfers()->where('destination_type', 'cash')->sum('amount_bs'));

        $balance = bcsub($balance, (string)$transfersOut, 2);
        $balance = bcadd($balance, (string)$transfersIn, 2);

        return $balance;
    }

    public function getTrueBudgetBsAttribute(): string
    {
        // True Budget = Available Balance + (Total Savings USD * Current BCV Rate)
        $depositsUsd = (string) $this->savingsTransactions()->where('type', 'deposit')->sum('amount_usd');
        $withdrawalsUsd = (string) $this->savingsTransactions()->where('type', 'withdrawal')->sum('amount_usd');
        $totalSavingsUsd = bcsub($depositsUsd, $withdrawalsUsd, 2);
        $savingsValueInBs = bcmul($totalSavingsUsd, $this->income_rate, 2);
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

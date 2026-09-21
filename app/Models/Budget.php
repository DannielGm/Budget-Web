<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

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

    public const SAVINGS_POOLS = ['Digital', 'Bank', 'Physical'];

    /**
     * Canonical spelling for every accepted pool name. Legacy rows and the
     * Spanish labels used across the UI map here so a pool can never be split
     * in two (e.g. 'Banco' vs 'Bank').
     */
    public const SAVINGS_POOL_ALIASES = [
        'binance' => 'Digital',
        'digital' => 'Digital',
        'banco' => 'Bank',
        'bank' => 'Bank',
        'fisico' => 'Physical',
        'physical' => 'Physical',
    ];

    /** Resolve any pool spelling to its canonical name (null when empty). */
    public static function normalizeSavingsPool(?string $value): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        // Str::ascii strips the accent so 'Físico'/'Fisico' both match.
        return self::SAVINGS_POOL_ALIASES[strtolower(Str::ascii(trim($value)))] ?? $value;
    }

    /**
     * Independent per-pool savings balances (USD). Each pool aggregates its
     * manual SavingTransactions plus Transfer legs that move money in or out
     * of that pool (source_type/destination_type === 'saving').
     */
    public function getSavingsPoolsAttribute(): array
    {
        return once(function () {
            $transactions = $this->savingsTransactions;
            $transfers = $this->transfers;

            return collect(self::SAVINGS_POOLS)->map(function (string $pool) use ($transactions, $transfers) {
                $balance = '0';

                foreach ($transactions as $t) {
                    if (self::normalizeSavingsPool($t->category) !== $pool) {
                        continue;
                    }
                    $balance = $t->type === 'deposit'
                        ? bcadd($balance, $t->amount_usd, 2)
                        : bcsub($balance, $t->amount_usd, 2);
                }

                foreach ($transfers as $tr) {
                    if ($tr->destination_type === 'saving' && self::normalizeSavingsPool($tr->destination_id) === $pool) {
                        $balance = bcadd($balance, (string) $tr->amount_usd, 2);
                    }
                    if ($tr->source_type === 'saving' && self::normalizeSavingsPool($tr->source_id) === $pool) {
                        $balance = bcsub($balance, (string) $tr->amount_usd, 2);
                    }
                }

                return ['name' => $pool, 'balance_usd' => $balance];
            })->values()->all();
        });
    }

    /** Total savings = the sum of the three independent pools. */
    public function getTotalSavingsUsdAttribute(): string
    {
        $total = '0';
        foreach ($this->savings_pools as $pool) {
            $total = bcadd($total, $pool['balance_usd'], 2);
        }

        return $total;
    }

    public function getCashBsAttribute(): string
    {
        return once(fn() => (string) $this->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', 1)
            ->where('categories.is_presupuesto', 0)
            ->sum('amount_bs'));
    }

    public function getCreditPurchasesBsAttribute(): string
    {
        return once(fn() => (string) $this->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', 0)
            ->where('categories.is_presupuesto', 0)
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

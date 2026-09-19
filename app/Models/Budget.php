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

    public function getCashBsAttribute(): string
    {
        return (string) $this->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', true)
            ->sum('amount_bs');
    }

    public function getCreditPurchasesBsAttribute(): string
    {
        return (string) $this->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', false)
            ->sum('amount_bs');
    }

    public function getBalanceBsAttribute(): string
    {
        $balance = bcadd($this->opening_balance_bs, $this->income_bs, 2);
        return bcsub($balance, $this->cash_bs, 2);
    }

    public function getDebtBsAttribute(): string
    {
        $debtsRemaining = $this->debts->sum(fn($d) => bcsub($d->opening_bs, $d->payment_bs, 2));
        return bcadd($this->credit_purchases_bs, (string)$debtsRemaining, 2);
    }
}

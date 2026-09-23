<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    protected $fillable = [
        'month_id',
        'label',
        'opening_bs',
        'payment_bs',
        'position',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class, 'month_id', 'month_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(DebtPayment::class)->orderBy('timestamp', 'asc');
    }

    public function categories(): HasMany
    {
        return $this->hasMany(Category::class);
    }

    public function getCreditExpensesBsAttribute(): string
    {
        return once(fn() => (string) Expense::whereIn(
            'category_name',
            $this->categories()->pluck('name')
        )->where('month_id', $this->month_id)->sum('amount_bs'));
    }
}

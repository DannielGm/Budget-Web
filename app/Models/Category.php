<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Category extends Model
{
    protected $fillable = [
        'month_id',
        'name',
        'cash_expense',
        'is_presupuesto',
        'position',
        'debt_id',
    ];

    protected $casts = [
        'cash_expense' => 'boolean',
        'is_presupuesto' => 'boolean',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class, 'month_id', 'month_id');
    }

    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class, 'month_id', 'month_id')
            ->where('category_name', $this->name)
            ->orderBy('position');
    }
}

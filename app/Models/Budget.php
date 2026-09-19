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
}

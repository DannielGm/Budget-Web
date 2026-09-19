<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'month_id',
        'category_name',
        'label',
        'amount_bs',
        'rate',
        'timestamp',
        'position',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class, 'month_id', 'month_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DebtPayment extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'debt_id',
        'amount_bs',
        'method',
        'timestamp',
    ];

    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class);
    }
}

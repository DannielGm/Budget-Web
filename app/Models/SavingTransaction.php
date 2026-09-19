<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavingTransaction extends Model
{
    protected $table = 'savings_transactions';

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'month_id',
        'type', // 'deposit' or 'withdrawal'
        'category', // e.g. 'Binance', 'Bank', 'Physical'
        'amount_usd',
        'exchange_rate',
        'amount_bs', // Calculated before save: amount_usd * exchange_rate
        'timestamp',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class, 'month_id', 'month_id');
    }
}

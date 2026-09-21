<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transfer extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'month_id',
        'source_type',
        'source_id',
        'destination_type',
        'destination_id',
        'amount_bs',
        'amount_usd',
        'rate',
        'timestamp',
        'note',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class, 'month_id', 'month_id');
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExchangeRate extends Model
{
    protected $primaryKey = 'date_iso';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'date_iso',
        'rate_bs_per_usd',
        'fetched_at',
    ];
}

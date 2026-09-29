<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A bolivar rate for one currency on one day.
 *
 * The key is (date_iso, currency): the dollar and euro series are stored side by
 * side so a day's rate for either is one row, and neither series can overwrite
 * the other.
 */
class ExchangeRate extends Model
{
    public const USD = 'USD';

    public const EUR = 'EUR';

    /**
     * The bolivar per unit of whichever currency this row holds.
     *
     * $incrementing and $keyType stay even though $primaryKey is null: with the
     * key gone, they are what tells Eloquent this is not an auto-incrementing
     * numeric row, and removing them makes a plain create() fail on setAttribute.
     */
    protected $primaryKey = null;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'date_iso',
        'currency',
        'rate_bs_per_usd',
        'fetched_at',
    ];

    /**
     * The rate for one currency on one day. The table has a composite key, so a
     * plain find() cannot address a row; every read goes through here instead,
     * which makes the currency an explicit part of the question.
     */
    public static function forDay(string $dateIso, string $currency = self::USD): ?self
    {
        return static::where('date_iso', $dateIso)
            ->where('currency', $currency)
            ->first();
    }

    /** Rows for one currency, so a query can never mix the two series. */
    public function scopeCurrency($query, string $currency)
    {
        return $query->where('currency', $currency);
    }
}

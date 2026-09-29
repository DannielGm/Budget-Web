<?php

namespace App\Support;

use App\Models\ExchangeRate;
use Illuminate\Http\Request;

/**
 * Which currency the figures are being displayed in.
 *
 * The preference is the user's, not a property of the data, so it lives with
 * the theme in the browser rather than on a user row: the app supports
 * signed-out use, and a stored preference would have nowhere to live for a
 * guest. That makes it invisible to the server, so the toggle writes a cookie
 * alongside localStorage and this reads it back.
 *
 * The cookie is the server's copy; localStorage is the browser's. Both are
 * written by the same click and the reload that follows reads each from its
 * own store, so the two cannot drift. Anything unrecognised falls back to
 * dollars, which is the default and the series every older record holds.
 */
class DisplayCurrency
{
    public const COOKIE = 'display_currency';

    /** @return string one of the ExchangeRate currency constants */
    public static function current(?Request $request = null): string
    {
        $value = ($request ?? request())->cookie(self::COOKIE);

        return $value === ExchangeRate::EUR ? ExchangeRate::EUR : ExchangeRate::USD;
    }

    /** The other supported series, for the rate history's comparison line. */
    public static function counterpart(string $currency): string
    {
        return $currency === ExchangeRate::EUR ? ExchangeRate::USD : ExchangeRate::EUR;
    }
}

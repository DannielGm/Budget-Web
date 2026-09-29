/**
 * The display currency: which symbol the user reads figures in, and which rate
 * converts them.
 *
 * A display preference rather than a stored one, for the same reason the theme
 * is: the app allows signed-out use, so a preference tied to an account row
 * would have nowhere to live for a guest. It follows the theme's existing
 * localStorage convention and defaults to dollars, so nothing changes until the
 * user opts in.
 *
 * It is its own module rather than part of money.js because the context is React
 * state, not formatting: money.js stays pure and testable, and a component that
 * only needs a number never pulls in a context.
 */
import { createContext, useContext } from 'react';
import { fmtUsd } from '@/lib/money';

export const USD = 'USD';
export const EUR = 'EUR';

export const CURRENCIES = { USD: '$', EUR: '\u20AC' };

const CurrencyContext = createContext(USD);

export function CurrencyProvider({ currency = USD, children }) {
    return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    return useContext(CurrencyContext);
}

/** The symbol for a currency, defaulting to the dollar sign. */
export function currencySymbol(currency = USD) {
    return CURRENCIES[currency] || CURRENCIES[USD];
}

/**
 * The other supported series, for the rate history's comparison line.
 * The mirror of App\Support\DisplayCurrency::counterpart, so the two agree on
 * which series is "the other one" without either inventing the answer.
 */
export function counterpartOf(currency = USD) {
    return currency === EUR ? USD : EUR;
}

/** The label a rate carries, e.g. "Bs/$" or "Bs/€". */
export function rateUnitLabel(currency = USD) {
    return currency === EUR ? 'Bs/\u20AC' : 'Bs/$';
}


/**
 * The rate a figure should be converted at.
 *
 * One rule, one source. The budget form's value is the month's rate, whatever
 * it is: a custom number the user typed, or the BCV figure refreshMonthRates()
 * kept in step. There is no separate "custom" case, because there is no longer
 * a competing BCV-derived value to prefer over it -- that was the bug. The
 * custom branch used to return `monthRate`, which the payload filled with the
 * BCV rate, so a custom rate was saved and then never displayed anywhere.
 *
 * The one exception is a day filter: a picked day shows that day's published
 * rate for the currency on screen, because picking a specific day is the whole
 * point of the day view, and using the month's number would make it inert.
 */
export function rateFor({
    dateRate = null,
    effectiveRate = 0,
    dateFilter = null,
} = {}) {
    return dateFilter && Number(dateRate) > 0
        ? Number(dateRate)
        : Number(effectiveRate) || 0;
}

/**
 * A bolivar amount in the display currency.
 *
 * A missing or zero rate yields 0, matching the guard the old `usdOf` helper
 * used, so a rate that has not loaded shows nothing rather than Infinity.
 */
export function convert(amountBs, rate) {
    const r = Number(rate);
    if (!Number.isFinite(r) || r <= 0) return 0;
    return (Number(amountBs) || 0) / r;
}

/**
 * A figure held in one currency, read in another, both at the same day's rates.
 *
 * Two rules, and the first is the one that kept being broken:
 *
 *  - The currency already on screen is NOT converted. The amount comes back
 *    untouched and no rate is consulted, so a pot the user stated in dollars is
 *    never re-priced on the way to a dollar screen. Dividing it by the form's
 *    rate used to turn $100 into $91 the moment a custom rate was typed.
 *
 *  - A real conversion pairs the two series from the SAME day: the amount is
 *    valued in bolivars at its own currency's rate, and that figure is read in
 *    the display currency at that currency's rate for the same day. One side
 *    from today and the other from a picked day is not a rate the user can
 *    check, which is what "cross-rate" used to mean here.
 *
 * A missing rate yields null rather than a number, so a caller can leave the
 * figure out instead of printing a fabricated one.
 */
export function convertBetween(amount, from, to, { usdRate = 0, eurRate = 0 } = {}) {
    const value = Number(amount) || 0;
    if (from === to) return value;

    const rateOf = (currency) => {
        const rate = Number(currency === EUR ? eurRate : usdRate);
        return Number.isFinite(rate) && rate > 0 ? rate : null;
    };

    const fromRate = rateOf(from);
    const toRate = rateOf(to);
    if (fromRate === null || toRate === null) return null;

    return value * fromRate / toRate;
}

/**
 * A savings pool balance in one currency.
 *
 * A pool holds two pots rather than one balance in a marked currency: the
 * dollars and the euros kept in the same place are different money, so the
 * figure is read by name instead of converted into whatever is on screen.
 * A pot with no movements yet is 0, matching what the table stores.
 */
export function potAmount(pool, currency = USD) {
    return Number(pool?.[currency === EUR ? 'balance_eur' : 'balance_usd']) || 0;
}

/**
 * A pool's whole value in bolivars: each pot at its own series' rate.
 *
 * Bs is the one unit both pots convert into without inventing anything, and it
 * is the unit the balance, the debts and the graph are already kept in, so the
 * blended figure is the two pots added up in Bs and divided once by whatever
 * the screen is showing.
 */
export function potInBs(pool, { usdRate = 0, eurRate = 0 } = {}) {
    return (potAmount(pool, USD) * (Number(usdRate) || 0))
        + (potAmount(pool, EUR) * (Number(eurRate) || 0));
}

/** The formatted label for a figure, e.g. "\u20AC 1.234,56". */
export function fmtForeign(value, currency = USD, digits = 2) {
    return `${currencySymbol(currency)} ${fmtUsd(value, digits)}`;
}

/**
 * Apply a display-currency change, for every control that offers one.
 *
 * It lives here rather than in the Settings partial because the switch is
 * reachable from the dashboard header too, and two copies of "write the
 * preference, then reload" is exactly how a preference ends up written one way
 * by Settings and another way by the header. One function, one behaviour.
 *
 * The reload is the one honest way to re-render every figure with the new
 * symbol; the alternative is threading the change through every component, which
 * is where the two would drift apart.
 */
export function setDisplayCurrency(next) {
    if (next !== USD && next !== EUR) return;
    if (typeof window === 'undefined') return;
    localStorage.currency = next;
    document.documentElement.dataset.currency = next;
    // The server needs the same answer to re-derive the stored rate for the
    // series on screen, and it cannot see localStorage. A cookie is the one store
    // both sides read, so it is written beside the localStorage entry rather
    // than replacing it.
    document.cookie = `display_currency=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
}

/**
 * The bridge between a figure the app stores and the one the user reads.
 *
 * Each screen used to pick its own divisor: some by the month's rate, some by
 * the day's, some by whatever was passed in. Those could disagree, and in euro
 * mode every one of them would need the same conversion repeated. These hooks
 * are the single place that answers "which symbol, and which rate", so a
 * component only has to say which number it holds.
 */
import { useCallback, useMemo } from 'react';
import { usePage } from '@inertiajs/react';
import {
    useCurrency, rateFor, convert, convertBetween, fmtForeign, currencySymbol,
    rateUnitLabel, USD, EUR,
} from '@/lib/currency';

/**
 * One currency's rate for a given day or range, from the payload's two series.
 *
 * Pure, so the hooks below and useSeriesRates() answer with one rule instead of
 * two lookups that can drift apart. A day BCV did not publish falls back to that
 * series' latest observation -- the same fallback the controller applies when it
 * builds the payload -- so both halves of a conversion come from one day.
 */
function seriesRate(rates, currency, dateFilter) {
    const series = rates?.[currency === EUR ? 'eur' : 'usd'] || {};
    const day = Number(series.day) || 0;
    const latest = Number(series.latest) || 0;

    return dateFilter && day > 0 ? day : latest;
}

/** Both series for the day on screen, as the pair convertBetween() wants. */
function useSeriesRates() {
    const { rates = {}, dateFilter = null } = usePage().props || {};

    return useMemo(() => ({
        usdRate: seriesRate(rates, USD, dateFilter),
        eurRate: seriesRate(rates, EUR, dateFilter),
    }), [rates, dateFilter]);
}

/**
 * @param amountBs  a bolivar amount, when that is what the figure is
 * @param amountUsd a dollar amount (savings are stored in dollars)
 */
export function useFigure({ amountBs = null, amountUsd = null } = {}) {
    const currency = useCurrency();
    const { rates = {}, dateFilter = null } = usePage().props || {};

    // The month's rate: the budget form's value, used for whatever currency is
    // on screen. `effective` is not per-series because it is not BCV's -- it is
    // the one number the user settled on for this month, and a custom one has no
    // series to belong to.
    const effectiveRate = rates?.effective ?? 0;
    // The cross-rate still needs both real series: savings are stored in
    // dollars, so a euro display has to derive EUR/USD from them.
    const eurLatest = rates?.eur?.latest ?? null;
    const usdLatest = rates?.usd?.latest ?? null;
    const dayRate = (currency === EUR ? rates?.eur : rates?.usd)?.day ?? null;
    const seriesRates = useSeriesRates();

    return useMemo(() => {
        const rate = rateFor({ dateRate: dayRate, effectiveRate, dateFilter });

        // A dollar figure in the display currency is the number itself; only the
        // other direction is a conversion, and it pairs both series from the day
        // on screen. No cross-rate means nothing to go missing, so the fallback
        // is only here for a series that has not loaded.
        const value = amountUsd !== null
            ? (convertBetween(amountUsd, USD, currency, seriesRates) ?? 0)
            : convert(amountBs, rate);

        return {
            currency,
            symbol: currencySymbol(currency),
            rate,
            value,
            /** Ready to print, e.g. "\u20AC 1.234,56". */
            formatted: fmtForeign(value, currency),
            /** Just the number, for components that place the symbol themselves. */
            number: value,
        };
    }, [currency, amountBs, amountUsd, dateFilter, effectiveRate, dayRate, seriesRates]);
}

/**
 * The unit label for a rate, e.g. "Bs/$" or "Bs/\u20AC". It follows the currency the
 * figures are shown in, so a euro screen never labels a rate as bolivar per
 * dollar. An explicit currency wins, for the rate history's comparison line,
 * which is labelled with the series it shows rather than the display one.
 */
export function useRateLabel(currency = null) {
    return rateUnitLabel(currency ?? useCurrency());
}

/** The symbol for the display currency, for components that render it inline. */
export function useCurrencySymbol() {
    return currencySymbol(useCurrency());
}

/**
 * A foreign-currency figure for a bolivar amount, already divided.
 *
 * Many call sites hold a bolivar amount plus a rate that may or may not be the
 * one for the currency on screen. This takes both and returns the number, so a
 * component does not have to know which rate applies  Ethe same lookup
 * `rateFor` performs for the pure `useFigure` case.
 */
export function useBolivarFigure() {
    const currency = useCurrency();
    const { rates = {}, dateFilter = null } = usePage().props || {};

    const effectiveRate = rates?.effective ?? 0;
    const dayRate = (currency === EUR ? rates?.eur : rates?.usd)?.day ?? null;

    return useCallback(
        (amountBs, fallbackRate = null) => {
            // A rate passed in by the caller wins only when the payload carries
            // none, which happens before the first fetch resolves.
            const rate = rateFor({ dateRate: dayRate, effectiveRate, dateFilter }) || fallbackRate;

            return convert(amountBs, rate);
        },
        [currency, dateFilter, effectiveRate, dayRate],
    );
}

/**
 * A currency's BCV rate for the day or range on screen.
 *
 * A picked day shows that day's published rate for the series; without a day it
 * is the latest real observation, because a balance is worth its value today and
 * not on the 1st.
 *
 * This is the rate to value a figure held in `currency` in bolivars, and one side
 * of a conversion into another currency. It is deliberately not the form's rate:
 * that belongs to the currency on screen, and using it to value the other one
 * would pair a euro rate with a dollar figure. For a pot already in the currency
 * on screen the app's own rate is the right one, being the figure every other
 * bolivar line on the screen uses.
 */
export function useRateInBs(currency = USD) {
    const { rates = {}, dateFilter = null } = usePage().props || {};

    return seriesRate(rates, currency, dateFilter);
}

/**
 * A currency's rate as of today, whatever day is on screen.
 *
 * A movement carries the moment it happened, so a form opened while a past day
 * is being reviewed still offers today's real rate: pricing a deposit being made
 * now at a rate from last week would be wrong, not helpful.
 */
export function useTodayRateInBs(currency = USD) {
    const { rates = {} } = usePage().props || {};

    return seriesRate(rates, currency, null);
}


import { describe, expect, it } from 'vitest';
import { rateFor, convert, convertBetween, currencySymbol, potAmount, potInBs, USD, EUR } from './currency.jsx';


describe('rateFor — the budget form’s rate is the month’s rate', () => {
    it('uses the form’s value, custom or not', () => {
        // There is no custom case any more. Whatever the form holds IS the
        // month’s rate, so 36.50 is honoured and so is a BCV figure. The old
        // version branched on isCustomRate and returned monthRate, which the
        // payload filled with the BCV rate -- so a custom rate was saved and
        // then never displayed anywhere. That was the bug.
        expect(rateFor({ effectiveRate: 36.5 })).toBe(36.5);
        expect(rateFor({ effectiveRate: 855.66 })).toBe(855.66);
    });

    it('never returns Infinity for a rate that has not loaded', () => {
        expect(rateFor({ effectiveRate: 0 })).toBe(0);
        expect(rateFor({})).toBe(0);
        expect(rateFor({ effectiveRate: null })).toBe(0);
    });
});

describe('rateFor — a picked day uses that day rate', () => {
    it('uses the historical rate for the selected day', () => {
        const rate = rateFor({
            dateRate: 972.65,
            effectiveRate: 926.55,
            dateFilter: '2026-09-12',
        });

        expect(rate).toBe(972.65);
    });

    it('falls back to the form’s rate with no day selected', () => {
        const rate = rateFor({ dateRate: 972.65, effectiveRate: 926.55, dateFilter: null });

        expect(rate).toBe(926.55);
    });

    it('falls back when the day has no published rate', () => {
        const rate = rateFor({ dateRate: 0, effectiveRate: 926.55, dateFilter: '2026-09-13' });

        expect(rate).toBe(926.55);
    });
});

describe('convert', () => {
    it('divides a bolivar amount by the rate', () => {
        expect(convert(1000, 100)).toBe(10);
    });

    it('is 0 for an unusable rate instead of Infinity', () => {
        expect(convert(1000, 0)).toBe(0);
        expect(convert(1000, null)).toBe(0);
        expect(convert(1000, 'abc')).toBe(0);
    });
});

describe('convertBetween — the same amount, read in the other currency', () => {
    const rates = { usdRate: 855.66, eurRate: 972.65 };

    it('does not convert the currency already on screen', () => {
        // The rule that kept being broken: a balance the user stated in dollars
        // came back re-priced, because it was valued in bolivars and divided by
        // the form's rate on the way to a dollar screen. No rate is consulted
        // here at all, which is why the empty case is not a failure.
        expect(convertBetween(50, USD, USD, rates)).toBe(50);
        expect(convertBetween(50, USD, USD, {})).toBe(50);
        expect(convertBetween(0, EUR, EUR, rates)).toBe(0);
    });

    it('pairs both series from the same day when it does convert', () => {
        // A dollar is worth FEWER euros than a euro is worth dollars, and the
        // factor has to read that way round: at 855.66 Bs/$ and 972.65 Bs/euro,
        // 50 dollars is 50 x (855.66 / 972.65) = 43.99 euros, and 50 euros is
        // 56.84 dollars. The helper this replaced had the pair the other way up
        // and so stated $50 as EUR 56.84 -- a dollar balance inflated by nearly a
        // third every time a euro screen showed it.
        expect(convertBetween(50, USD, EUR, rates)).toBeCloseTo(43.985, 2);
        expect(convertBetween(50, EUR, USD, rates)).toBeCloseTo(56.84, 2);
    });

    it('is null rather than a number when a series has not loaded', () => {
        expect(convertBetween(50, USD, EUR, { usdRate: 855.66, eurRate: 0 })).toBeNull();
        expect(convertBetween(50, USD, EUR, {})).toBeNull();
    });

    it('refuses a rate that is not a positive number', () => {
        expect(convertBetween(50, USD, EUR, { usdRate: -1, eurRate: 972.65 })).toBeNull();
        expect(convertBetween(50, USD, EUR, { usdRate: 'abc', eurRate: 972.65 })).toBeNull();
    });
});

describe('currencySymbol', () => {
    it('is $ for dollars and the euro sign for euros', () => {
        expect(currencySymbol(USD)).toBe('$');
        expect(currencySymbol(EUR)).toBe('\u20AC');
    });

    it('falls back to the dollar sign for anything unknown', () => {
        expect(currencySymbol('XXX')).toBe('$');
    });
});

/**
 * A pool is not marked as one currency: the dollars and the euros kept in the
 * same place are different money, and these are the only two readers of that
 * pair. They are pure, so the rule is asserted rather than trusted to a screen.
 */
describe('potAmount — a pool holds a dollar pot and a euro pot', () => {
    it('reads the pot for the currency asked for', () => {
        const pool = { name: 'Bank', balance_usd: '25.00', balance_eur: '10.50' };

        expect(potAmount(pool, USD)).toBe(25);
        expect(potAmount(pool, EUR)).toBe(10.5);
    });

    it('is 0 for a pot that has never been saved into', () => {
        expect(potAmount({ balance_usd: '5' }, EUR)).toBe(0);
        expect(potAmount(undefined, USD)).toBe(0);
    });

    it('defaults to the dollar pot', () => {
        expect(potAmount({ balance_usd: '7', balance_eur: '9' })).toBe(7);
    });
});

describe('potInBs — both pots in the one unit they share', () => {
    it('values each pot at its own series rate', () => {
        const pool = { balance_usd: '10', balance_eur: '10' };

        // 10 x 36.5 Bs/$ plus 10 x 43.8 Bs/euro.
        expect(potInBs(pool, { usdRate: 36.5, eurRate: 43.8 })).toBeCloseTo(803, 6);
    });

    it('keeps the euro pot out of a figure whose euro series has not loaded', () => {
        const pool = { balance_usd: '10', balance_eur: '10' };

        expect(potInBs(pool, { usdRate: 36.5, eurRate: 0 })).toBe(365);
    });

    it('is 0 rather than Infinity when no series has loaded', () => {
        expect(potInBs({ balance_usd: '10', balance_eur: '10' }, {})).toBe(0);
    });
});

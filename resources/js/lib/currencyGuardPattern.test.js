// Proves the guard's pattern can actually fail.
//
// A check that cannot fail proves nothing, and this one already had a blind
// spot: the graph rendered `$${fmtUsd(value)}` in euro mode and the guard passed
// for a long time. The three cases below are the shapes the pattern must
// separate, and the middle one is the spelling that used to slip through.
import { describe, expect, it } from 'vitest';

/** The guard's pattern, from useCurrencyGuard.test.js. */
const hardCoded = (source) => /\$\s+\{/.test(source) || /\$\$\{/.test(source) || /Bs\/\$/.test(source);

describe('the hard-coded dollar check can tell a symbol from a template', () => {
    it('flags a symbol written into a template literal', () => {
        // The graph's own bug, verbatim.
        expect(hardCoded('`$${fmtUsd(value)}`')).toBe(true);
        expect(hardCoded("{metric === 'savings' ? `$${fmtUsd(dailyChange)}` : ''}")).toBe(true);
    });

    it('flags a symbol in plain text before a value', () => {
        expect(hardCoded('$ {amount}')).toBe(true);
    });

    it('flags a dollar in a unit label', () => {
        expect(hardCoded("rateLabel = 'Bs/$'")).toBe(true);
    });

    it('does not flag ordinary template interpolation', () => {
        // Every template in the app looks like this. A pattern that matched
        // these would fail all 200+ file checks and say nothing useful.
        expect(hardCoded('`Bs ${fmtBs(value)}`')).toBe(false);
        expect(hardCoded('`${symbol} ${fmtUsd(amount)}`')).toBe(false);
        expect(hardCoded('${dailyChange > 0 ? "+" : ""}')).toBe(false);
    });

    it('does not flag a repaired component', () => {
        // What BudgetGraph now does instead.
        expect(hardCoded('`Bs ${fmtBs(value)}`')).toBe(false);
        expect(hardCoded('formatSavings(value)')).toBe(false);
    });
});

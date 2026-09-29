import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BudgetForm, { applyDailyRateSwitch } from '@/Components/Budget/BudgetForm';
import { CurrencyProvider, USD, EUR } from '@/lib/currency';

/**
 * The daily BCV switch.
 *
 * Both reported bugs lived in this one handler and neither was catchable by the
 * build or by a source scan, because neither crashed: the switch wrote the
 * MONTH's rate (the 1st carried forward) while promising a daily figure, and it
 * was wired to the negation of is_custom_rate, so the box showed checked while
 * the state it wrote meant "custom". The rule is therefore a pure function with
 * the component calling it, so pressing it is assertable.
 */
describe('the daily BCV switch', () => {
    it('writes today’s published rate when switched on', () => {
        expect(applyDailyRateSwitch(true, 855.66, '36.50')).toEqual({
            is_custom_rate: false,
            income_rate: 855.66,
        });
    });

    it('keeps the user’s number when switched off', () => {
        // The custom-rate bug: overwriting this on the way out is what made a
        // saved custom rate look like it had been discarded.
        expect(applyDailyRateSwitch(false, 855.66, '36.50')).toEqual({
            is_custom_rate: true,
            income_rate: '36.50',
        });
    });

    it('keeps the current rate when no daily rate has loaded', () => {
        // Never write 0: a rate that has not arrived must not wipe a real one.
        expect(applyDailyRateSwitch(true, 0, '36.50')).toEqual({
            is_custom_rate: false,
            income_rate: '36.50',
        });
    });

    it('turning the switch off keeps whatever is in the field, not the old one', () => {
        // Turning it ON replaces the typed number, so switching back off cannot
        // restore it -- there is nothing to restore. "Off" means "this number is
        // mine", and the number in the field is now the BCV one. Asserting a
        // round-trip back to the typed value would be asserting a memory the
        // form does not have.
        const typed = '42.00';
        const on = applyDailyRateSwitch(true, 855.66, typed);
        const backOff = applyDailyRateSwitch(false, 855.66, on.income_rate);

        expect(on.income_rate).toBe(855.66);
        expect(backOff.income_rate).toBe(855.66);
        expect(backOff.is_custom_rate).toBe(true);
    });
});

describe('the budget form renders', () => {
    const budget = {
        month_id: '2026-09',
        month_label: 'Septiembre',
        income_bs: 1000,
        income_rate: '36.50',
        opening_balance_bs: 500,
        is_custom_rate: true,
    };

    // The form's body sits inside Modal, whose Headless UI Transition renders
    // nothing until it mounts, so static markup proves only that the component
    // does not throw on the way there. The rule it carries is asserted above.
    it.each([[USD], [EUR]])('does not throw in %s mode', (currency) => {
        expect(() => renderToStaticMarkup(
            <CurrencyProvider currency={currency}>
                <BudgetForm
                    show={false}
                    onClose={() => {}}
                    budget={budget}
                    rates={{
                        effective: budget.income_rate,
                        usd: { latest: '855.66', day: null },
                        eur: { latest: '972.65', day: null },
                    }}
                />
            </CurrencyProvider>,
        )).not.toThrow();
    });
});

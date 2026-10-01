import { describe, expect, it } from 'vitest';
import { buildInsights, daysInMonth, daysElapsed } from './insights.js';
import  { EUR, USD } from './currency.jsx';

const at = (day) => new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00`).getTime();

function fixture() {
    return {
        month_id: '2026-09',
        income_bs: 1000,
        opening_balance_bs: 500,
        available_balance_bs: 500,
        credit_purchases_bs: 100,
        savings_pools: [{ balance_usd: '60', balance_eur: '50' }],
        categories: [
            { name: 'Comida', cash_expense: true, is_presupuesto: false },
            { name: 'Educacion', cash_expense: false, is_presupuesto: true },
        ],
        expenses: [
            { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(10) },
            { id: 2, category_name: 'Educacion', amount_bs: '200', timestamp: at(11) },
        ],
        debts: [],
    };
}

const insights = (overrides = {}, opts = {}) => buildInsights(
    { ...fixture(), ...overrides },
    { savingsLedger: [], rate: 10, todayIso: '2026-09-15', ...opts },
);

describe('daysInMonth / daysElapsed', () => {
    it('handles a leap February and a normal month', () => {
        expect(daysInMonth('2024-02')).toBe(29);
        expect(daysInMonth('2026-02')).toBe(28);
        expect(daysInMonth('2026-09')).toBe(30);
    });

    it('counts up to today for the running month', () => {
        expect(daysElapsed('2026-09', '2026-09-15')).toBe(15);
    });

    it('counts the whole month once it has passed', () => {
        // A past month is fully spent, which collapses the burn projection onto
        // the real total instead of extrapolating from a stale day.
        expect(daysElapsed('2026-09', '2026-10-02')).toBe(30);
    });

    it('never reports zero, which would divide the burn rate by zero', () => {
        expect(daysElapsed('2026-09', '2026-09-01')).toBe(1);
    });
});

describe('buildInsights — the month figures', () => {
    it('counts cash spend and excludes presupuesto categories', () => {
        expect(insights().cashBs).toBe(100);
    });

    it('nets income against cash, credit and debt payments', () => {
        expect(insights().netBs).toBe(800);
    });

    it('derives a live burn rate and a projection from the day count', () => {
        const d = insights();

        expect(d.burnBs).toBeCloseTo(100 / 15, 6);
        expect(d.projectedCashBs).toBeCloseTo((100 / 15) * 30, 6);
    });
});

describe('buildInsights — plan against the available balance', () => {
    it('reports the plan as a share of the available balance', () => {
        const d = insights();

        // 200 of 500 available.
        expect(d.planTotalBs).toBe(200);
        expect(d.planAgainstAvailablePct).toBeCloseTo(40, 6);
        expect(d.planFitsBalance).toBe(true);
    });

    it('flags a plan that does not fit', () => {
        const d = insights({ available_balance_bs: 100 });

        expect(d.planAgainstAvailablePct).toBeCloseTo(200, 6);
        expect(d.planFitsBalance).toBe(false);
    });

    it('treats a zero balance as neutral rather than over plan', () => {
        // Nothing to compare against, so a warning would be a false alarm.
        const d = insights({ available_balance_bs: 0 });

        expect(d.planAgainstAvailablePct).toBeNull();
        expect(d.planFitsBalance).toBe(true);
    });

    it('still reports 100% share for a single plan category', () => {
        // Pinned deliberately: that is a share of the plan total, and the
        // plan-vs-available figure is the one that answers "is it affordable".
        expect(insights().planRows[0].sharePct).toBeCloseTo(100, 6);
    });
});

describe('buildInsights — savings flow counts by direction', () => {
    it('counts a transfer into a pool as a deposit', () => {
        // Regression: filtering on type === 'deposit' dropped transfers, so the
        // rate read 0% for anyone who funds savings that way.
        const d = insights({}, {
            savingsLedger: [{ id: 1, kind: 'transfer', source_type: 'cash', destination_type: 'saving', amount_usd: '60', timestamp: at(12) }],
        });

        expect(d.deposits).toBe(60);
        expect(d.savingsRatePct).toBeCloseTo(60, 6);
    });

    it('counts a transfer out of a pool as a withdrawal', () => {
        const d = insights({}, {
            savingsLedger: [{ id: 1, kind: 'transfer', source_type: 'saving', destination_type: 'cash', amount_usd: '20', timestamp: at(12) }],
        });

        expect(d.withdrawals).toBe(20);
        expect(d.savingsRatePct).toBeCloseTo(-20, 6);
    });

    it('nets the two directions together', () => {
        const d = insights({}, {
            savingsLedger: [
                { id: 1, kind: 'transfer', source_type: 'cash', destination_type: 'saving', amount_usd: '60', timestamp: at(12) },
                { id: 2, kind: 'transaction', type: 'deposit', pool: 'Digital', amount_usd: '10', timestamp: at(13) },
                { id: 3, kind: 'transaction', type: 'withdraw', pool: 'Digital', amount_usd: '30', timestamp: at(14) },
            ],
        });

        expect(d.deposits).toBe(70);
        expect(d.withdrawals).toBe(30);
        expect(d.savingsRatePct).toBeCloseTo(40, 6);
    });

    it('ignores movements from another month', () => {
        const d = insights({}, {
            savingsLedger: [
                { id: 1, kind: 'transaction', type: 'deposit', amount_usd: '50', timestamp: new Date('2026-08-20T12:00:00').getTime() },
                { id: 2, kind: 'transaction', type: 'deposit', amount_usd: '10', timestamp: at(13) },
            ],
        });

        expect(d.deposits).toBe(10);
    });

    it('counts only the pot the currency on screen is saved in', () => {
        // A euro deposit folded into a dollar total is a figure in no currency at
        // all, which is the whole reason a movement says which pot it belongs to.
        // Rows without a marking are dollars: that is what they were.
        const ledger = [
            { id: 1, kind: 'transaction', type: 'deposit', pool: 'Digital', currency: USD, amount_usd: '60', timestamp: at(12) },
            { id: 2, kind: 'transaction', type: 'deposit', pool: 'Digital', currency: EUR, amount_usd: '50', timestamp: at(13) },
            { id: 3, kind: 'transaction', type: 'deposit', pool: 'Bank', amount_usd: '5', timestamp: at(14) },
        ];

        const dollars = insights({}, { savingsLedger: ledger });
        const euros = insights({}, { savingsLedger: ledger, currency: EUR });

        expect(dollars.deposits).toBe(65);
        expect(dollars.savingsTotal).toBe(60);
        expect(euros.deposits).toBe(50);
        expect(euros.savingsTotal).toBe(50);
    });
});

describe('buildInsights — activity typing', () => {
    it('does not report presupuesto spending as an ordinary expense', () => {
        // Regression: the tone map had no presupuesto entry, so plan spending
        // fell through to the default and was badged as cash leaving the balance.
        const types = insights().activity
            .filter((a) => a.id.startsWith('e-'))
            .map((a) => a.type)
            .sort();

        expect(types).toEqual(['expense', 'presupuesto']);
    });

    it('keeps the amount on a presupuesto row', () => {
        const presup = insights().activity.find((a) => a.type === 'presupuesto');

        expect(presup.amountBs).toBe(200);
    });

    it('badges a credit purchase as credit rather than as a cash gasto', () => {
        // A credit purchase has not left the balance yet, so reporting it as a
        // gasto tells the reader their cash is gone when it is not.
        const d = insights({
            categories: [
                { name: 'Comida', cash_expense: true, is_presupuesto: false },
                { name: 'Educacion', cash_expense: false, is_presupuesto: true },
                { name: 'Electrodomestico', cash_expense: false, is_presupuesto: false, debt_id: null },
            ],
            expenses: [
                { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(10) },
                { id: 2, category_name: 'Educacion', amount_bs: '200', timestamp: at(11) },
                { id: 3, category_name: 'Electrodomestico', amount_bs: '300', timestamp: at(12) },
            ],
        });

        const types = d.activity
            .filter((a) => a.id.startsWith('e-'))
            .map((a) => a.type)
            .sort();

        expect(types).toEqual(['credit', 'expense', 'presupuesto']);
        expect(d.activity.find((a) => a.type === 'credit').amountBs).toBe(300);
    });

    it('badges a credit purchase linked to a debt as credit, not as a cash gasto', () => {
        // Regression: the tag asked `isCreditExpense`, whose debt_id test exists so
        // the *total* is not double-counted. A purchase on credit that happened to
        // be attached to a debt was therefore badged as a cash gasto -- the one
        // badge that claims the money left the balance when it did not. Where the
        // charge is filed is a different question from what kind of purchase it is.
        const d = insights({
            categories: [
                { name: 'Comida', cash_expense: false, is_presupuesto: false, debt_id: 7 },
            ],
            expenses: [
                { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(10) },
            ],
        });

        expect(d.activity[0].type).toBe('credit');
    });

    it('keeps cash and plan rows correct while a debt-linked category is present', () => {
        // The debt_id rule must stay out of the tag without loosening the other
        // two: only a non-cash, non-plan purchase is credit.
        const d = insights({
            categories: [
                { name: 'Comida', cash_expense: true, is_presupuesto: false, debt_id: 7 },
                { name: 'Educacion', cash_expense: false, is_presupuesto: true, debt_id: 7 },
                { name: 'Electrodomestico', cash_expense: false, is_presupuesto: false, debt_id: 7 },
            ],
            expenses: [
                { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(10) },
                { id: 2, category_name: 'Educacion', amount_bs: '200', timestamp: at(11) },
                { id: 3, category_name: 'Electrodomestico', amount_bs: '300', timestamp: at(12) },
            ],
        });

        const types = d.activity
            .filter((a) => a.id.startsWith('e-'))
            .map((a) => a.type)
            .sort();

        expect(types).toEqual(['credit', 'expense', 'presupuesto']);
    });
});

describe('buildInsights -- the debt total', () => {
    const debt = {
        id: 1,
        label: 'Banco',
        opening_bs: '1000',
        credit_expenses_bs: '200',
        payment_bs: '300',
        payments: [],
    };

    it('counts unassigned credit as part of what is owed', () => {
        // Regression: the figure summed the named debts only, so this screen showed
        // less than the summary modal opened from the dashboard, which uses the
        // backend total and does include unassigned credit purchases.
        const d = insights({ debts: [debt], credit_purchases_bs: '150' });

        // 1000 + 200 - 300 = 900 on the named debt, plus 150 unfiled.
        expect(d.remainingBs).toBe(1050);
    });

    it('measures the debt progress bar against the same total', () => {
        const d = insights({ debts: [debt], credit_purchases_bs: '150' });

        // 300 paid out of 1050 still owed + 300 paid.
        expect(d.debtBaseBs).toBe(1350);
        expect(d.debtPaidPct).toBeCloseTo((300 / 1350) * 100, 5);
    });

    it('still totals correctly with no unassigned credit', () => {
        const d = insights({ debts: [debt], credit_purchases_bs: '0' });

        expect(d.remainingBs).toBe(900);
        expect(d.debtBaseBs).toBe(1200);
    });

    it('is owed money even with no named debts at all', () => {
        const d = insights({ debts: [], credit_purchases_bs: '150' });

        expect(d.remainingBs).toBe(150);
    });
});

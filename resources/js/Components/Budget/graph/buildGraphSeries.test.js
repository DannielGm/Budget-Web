import { describe, expect, it } from 'vitest';
import { buildGraphSeries } from './buildGraphSeries.js';
import { scopeMonth } from '@/lib/scopedMoney';

const at = (d) => new Date(`2026-09-${String(d).padStart(2, '0')}T12:00:00`).getTime();

function month() {
    return {
        month_id: '2026-09',
        income_bs: 1000,
        income_rate: '10',
        opening_balance_bs: 500,
        // Server month figure: 500 + 1000 - 100 cash - 300 debt - 200 transferred out
        available_balance_bs: 900,
        categories: [
            { name: 'Comida', cash_expense: true, is_presupuesto: false },
        ],
        expenses: [
            { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(12) },
        ],
        transfers: [
            { source_type: 'cash', destination_type: 'saving', amount_bs: '200', timestamp: at(12) },
        ],
        debts: [{
            id: 1,
            opening_bs: '1000',
            payment_bs: '300',
            credit_expenses_bs: '0',
            payments: [{ id: 'p1', amount_bs: '300', timestamp: at(12) }],
        }],
    };
}

const series = (budget, rangeMode = 'Mes', dateFilter = null, savingsLedger = []) => buildGraphSeries({
    budget,
    categories: budget.categories,
    rangeMode,
    dateFilter,
    today: '2026-09-15',
    savingsLedger,
});

describe('the graph reconciles with the balance card', () => {
    it('ends on the month balance', () => {
        const budget = month();
        const points = series(budget).points;

        expect(points.at(-1).available).toBe(scopeMonth(budget).availableBs);
    });

    it('ends on the day balance under a day filter', () => {
        // The regression: the debt payment was skipped when a date filter was
        // set, so the graph and the hero showed different balances.
        const budget = month();
        const scoped = scopeMonth(budget, { dateFilter: '2026-09-12', rangeDays: 1 });
        const points = series(budget, '1d', '2026-09-12').points;

        expect(points.at(-1).available).toBe(scoped.availableBs);
    });

    it('agrees for every range mode', () => {
        const budget = month();
        const rangeDays = { Mes: 30, '7d': 7, '1d': 1 };

        for (const [mode, days] of Object.entries(rangeDays)) {
            const scoped = scopeMonth(budget, { dateFilter: '2026-09-12', rangeDays: days });
            const points = series(budget, mode, mode === 'Mes' ? null : '2026-09-12').points;

            expect(points.at(-1).available).toBe(scoped.availableBs);
        }
    });
});

describe('the savings series is kept in Bs', () => {
    const ledger = [
        { kind: 'transaction', type: 'deposit', amount_bs: '200', amount_usd: '20', timestamp: at(10) },
        { kind: 'transaction', type: 'withdrawal', amount_bs: '50', amount_usd: '5', timestamp: at(14) },
    ];

    it('accumulates the bolivar amount, not the dollar one', () => {
        // month() already moves 200 Bs from cash into savings on the 12th, so
        // the ledger's 200 in and 50 out bring the total to 350. The dollar
        // amounts are 20 and 5, and income_rate is 10, so a dollar-based series
        // would have produced 225 here instead. The series must be Bs: the
        // display currency is applied at render.
        const points = series(month(), 'Mes', null, ledger).points;

        expect(points.at(-1).savings).toBe(350);
    });

    it('ignores the dollar amount the ledger also carries', () => {
        const budget = month();
        const withUsd = series(budget, 'Mes', null, ledger).metrics.savings;
        const scrambled = series(budget, 'Mes', null, ledger.map((e) => ({ ...e, amount_usd: '99999' }))).metrics.savings;

        // Changing amount_usd cannot move a bolivar series, which is the whole
        // point of keeping it in Bs.
        expect(scrambled).toBe(withUsd);
    });

    it('counts a transfer into savings by its bolivar amount', () => {
        // month() already has a 200 Bs cash -> saving transfer on the 12th.
        const points = series(month()).points;

        expect(points.at(-1).savings).toBe(200);
    });
});

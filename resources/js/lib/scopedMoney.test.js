import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { scopeMonth, inWindow, heroBalance } from './scopedMoney.js';

const at = (day) => new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00`).getTime();

function fixture() {
    return {
        month_id: '2026-09',
        income_bs: 1000,
        opening_balance_bs: 500,
        // Server figure: 500 + 1000 - 100 cash - 100 credit - 300 debt = 1000,
        // then -200 saved, +0 transfers.
        available_balance_bs: 700,
        credit_purchases_bs: '100',
        categories: [
            { name: 'Comida', cash_expense: true, is_presupuesto: false },
            { name: 'TC', cash_expense: false, is_presupuesto: false, debt_id: 1 },
            { name: 'Electro', cash_expense: false, is_presupuesto: false, debt_id: null },
            { name: 'Educacion', cash_expense: false, is_presupuesto: true },
        ],
        expenses: [
            { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(12) },
            { id: 2, category_name: 'TC', amount_bs: '100', timestamp: at(12) },
            { id: 3, category_name: 'Educacion', amount_bs: '200', timestamp: at(12) },
            { id: 4, category_name: 'Electro', amount_bs: '100', timestamp: at(12) },
        ],
        transfers: [
            { source_type: 'cash', destination_type: 'saving', amount_bs: '200', timestamp: at(12) },
        ],
        debts: [{
            id: 1,
            label: 'TC',
            opening_bs: '1000',
            payment_bs: '300',
            credit_expenses_bs: '100',
            payments: [{ id: 'p1', amount_bs: '300', timestamp: at(12) }],
        }],
    };
}

const ledger = [
    { id: 1, kind: 'transfer', source_type: 'cash', destination_type: 'saving', amount_bs: '200', timestamp: at(12) },
];

const day = (o = {}, extra = {}) => scopeMonth(fixture(), {
    savingsLedger: ledger,
    dateFilter: '2026-09-12',
    rangeDays: 1,
    ...extra,
    ...o,
});

describe('inWindow', () => {
    it('is true for everything with no filter', () => {
        expect(inWindow('2026-01-01', null, 30)).toBe(true);
    });

    it('matches the exact day for a 1d window', () => {
        expect(inWindow('2026-09-12', '2026-09-12', 1)).toBe(true);
        expect(inWindow('2026-09-11', '2026-09-12', 1)).toBe(false);
    });

    it('reaches back for a 7d window and clamps to the month', () => {
        expect(inWindow('2026-09-06', '2026-09-12', 7)).toBe(true);
        // A window ending on the 2nd starts at the 1st, not the 26th of August.
        expect(inWindow('2026-08-30', '2026-09-02', 7)).toBe(false);
    });

    it('never leaks into another month', () => {
        expect(inWindow('2026-08-31', '2026-09-12', 7)).toBe(false);
    });
});

describe('scopeMonth — no filter is a passthrough', () => {
    it('returns the server figure verbatim', () => {
        const s = scopeMonth(fixture(), { savingsLedger: ledger, dateFilter: null, rangeDays: 30 });

        expect(s.filtered).toBe(false);
        expect(s.availableBs).toBe(700);
    });

    it('does not re-derive the month totals', () => {
        const s = scopeMonth(fixture(), { savingsLedger: ledger, dateFilter: null, rangeDays: 30 });

        expect(s.cashBs).toBe(100);
        expect(s.creditBs).toBe(100);
        expect(s.debtPaidBs).toBe(300);
    });
});

describe('scopeMonth — a day view is fully truthful', () => {
    it('subtracts credit and debt payments, not just cash', () => {
        // The regression: the hero used opening + income - cash, ignoring the
        // 100 of credit and the 300 of debt paid, so it overstated the day.
        const s = day();

        expect(s.cashBs).toBe(100);
        expect(s.creditBs).toBe(100);
        expect(s.debtPaidBs).toBe(300);
        // 500 opening + 1000 income - 100 cash - 100 credit - 300 debt
        // - 0 deposits + 0 withdrawals - 200 transfersOut + 0 transfersIn = 800
        expect(s.availableBs).toBe(800);
    });

    it('ignores movements from other days', () => {
        const s = scopeMonth(fixture(), {
            savingsLedger: [],
            dateFilter: '2026-09-05',
            rangeDays: 1,
        });

        // Nothing happened on the 5th.
        expect(s.cashBs).toBe(0);
        expect(s.creditBs).toBe(0);
        expect(s.debtPaidBs).toBe(0);
        expect(s.availableBs).toBe(1500);
    });

    it('reports the debt remaining as of that day', () => {
        // 1000 opening + 100 charges - 300 paid
        expect(day().debtRemainingBs).toBe(800);
    });

    it('counts a transfer out of cash as leaving the balance', () => {
        const s = day();

        expect(s.transfersOutBs).toBe(200);
        expect(s.transfersInBs).toBe(0);
    });
});

describe('scopeMonth — the plan tint', () => {
    it('compares the plan against what is available in range', () => {
        const s = day();

        expect(s.planTotalBs).toBe(200);
        expect(s.planFitsBalance).toBe(true);
    });

    it('reports the plan as not fitting when it exceeds the balance', () => {
        const s = scopeMonth({ ...fixture(), income_bs: 100 }, {
            savingsLedger: [],
            dateFilter: '2026-09-12',
            rangeDays: 1,
        });

        expect(s.planFitsBalance).toBe(false);
    });
});

describe('scopeMonth — a 7d window spans the days inside it', () => {
    it('includes every day in the window', () => {
        const s = scopeMonth(fixture(), {
            savingsLedger: ledger,
            dateFilter: '2026-09-12',
            rangeDays: 7,
        });

        expect(s.cashBs).toBe(100);
        expect(s.creditBs).toBe(100);
        expect(s.debtPaidBs).toBe(300);
    });
});

describe('empty and missing data', () => {
    it('survives a budget with nothing in it', () => {
        const s = scopeMonth({ categories: [], expenses: [], debts: [] }, { dateFilter: '2026-09-12', rangeDays: 1 });

        expect(s.cashBs).toBe(0);
        expect(s.availableBs).toBe(0);
    });

    it('survives a completely empty object', () => {
        expect(() => scopeMonth({}, { dateFilter: '2026-09-12', rangeDays: 1 })).not.toThrow();
    });
});

describe('heroBalance ? the number the balance card shows', () => {
    it('is the scoped balance, not a hand-rolled day formula', () => {
        // Regression guard for the card itself. The card used to compute
        // `opening + income - cash` inline, which ignored credit, debt payments
        // and transfers, so the headline overstated every day view. This exists
        // because nothing else could catch it: the value lived inside a component.
        const budget = {
            income_bs: 1000,
            opening_balance_bs: 500,
            available_balance_bs: 700,
            credit_purchases_bs: '100',
            categories: [
                { name: 'Comida', cash_expense: true, is_presupuesto: false },
                { name: 'Electro', cash_expense: false, is_presupuesto: false, debt_id: null },
            ],
            expenses: [
                { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(12) },
                { id: 2, category_name: 'Electro', amount_bs: '100', timestamp: at(12) },
            ],
            transfers: [
                { source_type: 'cash', destination_type: 'saving', amount_bs: '200', timestamp: at(12) },
            ],
            debts: [{
                id: 1, opening_bs: '1000', payment_bs: '300', credit_expenses_bs: '0',
                payments: [{ amount_bs: '300', timestamp: at(12) }],
            }],
        };

        // 500 + 1000 - 100 cash - 100 credit - 300 debt - 200 transfersOut
        expect(heroBalance(budget, { dateFilter: '2026-09-12', rangeDays: 1 })).toBe(800);

        // The old three-term formula would have said 1400.
        const naive = Number(budget.opening_balance_bs) + Number(budget.income_bs) - 100;
        expect(naive).not.toBe(800);
    });

    it('is the server figure when nothing is filtered', () => {
        const budget = { income_bs: 1000, opening_balance_bs: 500, available_balance_bs: 700, categories: [], expenses: [], debts: [] };

        expect(heroBalance(budget, { dateFilter: null, rangeDays: 30 })).toBe(700);
    });
});

describe('the balance card uses the scoped balance', () => {
    it('does not recompute the balance inline', () => {
        // A component cannot be rendered here without a DOM, so this asserts the
        // one thing that actually caused the bug: a second formula living inside
        // the card. It is a source-level guard and deliberately narrow.
        const source = readFileSync(
            new URL('../Components/Budget/BalanceCard.jsx', import.meta.url),
            'utf-8',
        );

        expect(source).toContain('heroBalance(');
        // The old formula, in any spelling, is what produced the wrong day figure.
        expect(source).not.toMatch(/opening_balance_bs\)\s*\+\s*(?:Number|parseFloat)\(budget\.income_bs\)/);
        expect(source).not.toMatch(/opening_balance_bs\) \+ /);
    });
});

import { describe, expect, it } from 'vitest';
import { calculateDebt, unassignedCreditPurchases, debtsAsOf, creditPurchasesAsOf } from './debtMath.js';

const at = (day, hour = 12) => new Date(`2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00`).getTime();

/**
 * A month with one cash category and one credit category attached to debt 1.
 * The stored totals represent the whole month; the day figures are derived.
 */
function fixture() {
    return {
        budget: {
            categories: [
                { name: 'Comida', cash_expense: true, is_presupuesto: false, debt_id: null },
                { name: 'TC', cash_expense: false, is_presupuesto: false, debt_id: 1 },
                { name: 'Electro', cash_expense: false, is_presupuesto: false, debt_id: null },
            ],
            expenses: [
                { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(5) },
                { id: 2, category_name: 'TC', amount_bs: '200', timestamp: at(8) },
                { id: 3, category_name: 'TC', amount_bs: '50', timestamp: at(20) },
                { id: 4, category_name: 'Electro', amount_bs: '100', timestamp: at(20) },
            ],
            credit_purchases_bs: '100',
        },
        debts: [{
            id: 1,
            label: 'TC',
            opening_bs: '1000',
            payment_bs: '400',
            credit_expenses_bs: '250',
            payments: [
                { id: 'p1', amount_bs: '300', timestamp: at(6) },
                { id: 'p2', amount_bs: '100', timestamp: at(18) },
            ],
        }],
    };
}

describe('calculateDebt', () => {
    it('treats current charges as part of the balance and payments as reducing it', () => {
        const result = calculateDebt({ opening_bs: '1000', credit_expenses_bs: '200', payment_bs: '300' }, 0);

        expect(result.remainingBs).toBe(900);
        expect(result.paidPercentage).toBeCloseTo(25, 5);
    });

    it('never reports a negative remaining balance', () => {
        const result = calculateDebt({ opening_bs: '100', payment_bs: '400' }, 0);

        expect(result.remainingBs).toBe(0);
        expect(result.overpaidBs).toBe(300);
    });

    it('skips credit already represented by a named debt', () => {
        const debts = [{ credit_expenses_bs: '100' }];

        expect(unassignedCreditPurchases(debts, 250)).toBe(150);
    });
});

describe('debtsAsOf', () => {
    it('returns the debts untouched with no day filter', () => {
        const { budget, debts } = fixture();

        // Identity, not just equality: the month view must not be re-derived.
        expect(debtsAsOf(debts, null, budget)).toBe(debts);
    });

    it('counts only payments made on or before the selected day', () => {
        const { budget, debts } = fixture();
        const scoped = debtsAsOf(debts, '2026-09-10', budget)[0];

        expect(scoped.payment_bs).toBe(300);
        expect(calculateDebt(scoped, 0).remainingBs).toBe(900);
    });

    it('counts only charges made on or before the selected day', () => {
        const { budget, debts } = fixture();
        const scoped = debtsAsOf(debts, '2026-09-10', budget)[0];

        expect(scoped.credit_expenses_bs).toBe(200);
    });

    it('reports a debt untouched before any movement', () => {
        const { budget, debts } = fixture();
        const scoped = debtsAsOf(debts, '2026-09-03', budget)[0];

        expect(scoped.payment_bs).toBe(0);
        expect(calculateDebt(scoped, 0).remainingBs).toBe(1000);
    });

    it('recovers the stored month totals at the end of the month', () => {
        const { budget, debts } = fixture();
        const scoped = debtsAsOf(debts, '2026-09-30', budget)[0];

        // If these drift, the day view and the month view disagree.
        expect(scoped.payment_bs).toBe(400);
        expect(scoped.credit_expenses_bs).toBe(250);
    });

    it('handles a debt with no payments', () => {
        const { budget } = fixture();
        const solo = debtsAsOf([{ id: 2, opening_bs: '50', payment_bs: '0', credit_expenses_bs: '0', payments: [] }], '2026-09-10', budget)[0];

        expect(solo.payment_bs).toBe(0);
    });
});

describe('creditPurchasesAsOf', () => {
    it('returns the stored total with no day filter', () => {
        const { budget } = fixture();

        expect(creditPurchasesAsOf(budget, null)).toBe(100);
    });

    it('counts only the charges on or before the selected day', () => {
        const { budget } = fixture();

        expect(creditPurchasesAsOf(budget, '2026-09-10')).toBe(0);
        expect(creditPurchasesAsOf(budget, '2026-09-20')).toBe(100);
    });

    it('agrees with the stored total at the end of the month', () => {
        const { budget } = fixture();

        expect(creditPurchasesAsOf(budget, '2026-09-30')).toBe(100);
    });

    it('excludes charges already attributed to a named debt', () => {
        // Budget::getCreditPurchasesBsAttribute filters whereNull(debt_id), so a
        // category attached to a debt contributes to that debt's own charges and
        // must not ALSO be counted as global credit. Omitting this double counts.
        const { budget } = fixture();
        const unassigned = {
            ...budget,
            categories: budget.categories.map((c) => ({ ...c, debt_id: null })),
        };

        // With every category unassigned, all 250 of charges are global credit.
        expect(creditPurchasesAsOf(unassigned, '2026-09-30')).toBe(350);
        expect(creditPurchasesAsOf(budget, '2026-09-30')).toBe(100);
    });

    it('excludes cash categories, matching the backend cash rule', () => {
        // Cash is cash_expense && !is_presupuesto; credit is the complement.
        // Getting this wrong silently disagrees with credit_purchases_bs.
        const { budget } = fixture();

        expect(creditPurchasesAsOf(budget, '2026-09-30')).toBe(100);
    });

    it('treats a movement at the last millisecond of the day as inside it', () => {
        const { budget } = fixture();
        const edge = {
            ...budget,
            expenses: [{ id: 9, category_name: 'Electro', amount_bs: '10', timestamp: Date.parse('2026-09-10T23:59:59.999') }],
        };

        expect(creditPurchasesAsOf(edge, '2026-09-10')).toBe(10);
        expect(creditPurchasesAsOf(edge, '2026-09-09')).toBe(0);
    });
});

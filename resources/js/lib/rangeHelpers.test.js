import { describe, expect, it } from 'vitest';
import { expensesInRange, filteredCategories } from './rangeHelpers.js';

const at = (day) => new Date(`2026-09-${String(day).padStart(2, '0')}T12:00:00`).getTime();

function budget() {
    return {
        categories: [
            { name: 'Comida', cash_expense: true, is_presupuesto: false },
            { name: 'Transporte', cash_expense: true, is_presupuesto: false },
        ],
        expenses: [
            { id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at(5) },
            { id: 2, category_name: 'Comida', amount_bs: '50', timestamp: at(10) },
            { id: 3, category_name: 'Comida', amount_bs: '25', timestamp: at(20) },
            { id: 4, category_name: 'Transporte', amount_bs: '10', timestamp: at(10) },
        ],
    };
}

const rows = (data, dateFilter, rangeDays) => filteredCategories(data, dateFilter, rangeDays);
const countFor = (list, name) => (list.find((c) => c.name === name) || { expenses: [] }).expenses.length;

describe('filteredCategories — month view', () => {
    it('shows every expense when no day is selected', () => {
        // The regression: the month view returned raw categories with no
        // `expenses` array, and the consumer's fallback was the only thing that
        // ever supplied a list, so removing that fallback blanked the screen.
        expect(countFor(rows(budget(), null, 30), 'Comida')).toBe(3);
        expect(countFor(rows(budget(), null, 30), 'Transporte')).toBe(1);
    });

    it('keeps every category, including ones with no expenses', () => {
        const data = budget();
        data.categories.push({ name: 'Vacía', cash_expense: true, is_presupuesto: false });

        expect(rows(data, null, 30).map((c) => c.name)).toContain('Vacía');
    });

    it('returns the full month for a 30-day range too', () => {
        expect(countFor(rows(budget(), '2026-09-20', 30), 'Comida')).toBe(3);
    });

    it('always attaches an expenses array, never leaves it undefined', () => {
        expect(rows(budget(), null, 30).every((c) => Array.isArray(c.expenses))).toBe(true);
        expect(rows(budget(), '2026-09-10', 1).every((c) => Array.isArray(c.expenses))).toBe(true);
    });
});

describe('filteredCategories — day and week views', () => {
    it('shows only the selected day', () => {
        expect(countFor(rows(budget(), '2026-09-10', 1), 'Comida')).toBe(1);
    });

    it('hides categories with nothing in the range rather than showing the month', () => {
        expect(rows(budget(), '2026-09-07', 1).map((c) => c.name)).not.toContain('Comida');
    });

    it('counts the trailing window for a 7d range', () => {
        // 5th and 10th fall inside a window ending on the 10th.
        expect(countFor(rows(budget(), '2026-09-10', 7), 'Comida')).toBe(2);
    });

    it('clamps a 7d window to the first of the month', () => {
        // A window ending on the 2nd is only the 1st-2nd, so the 5th is out.
        expect(expensesInRange(budget(), 'Comida', '2026-09-02', 7)).toHaveLength(0);
        expect(expensesInRange(budget(), 'Comida', '2026-09-10', 7)).toHaveLength(2);
    });
});

describe('expensesInRange — the fallback the selected category uses', () => {
    it('is empty for a day with no matching movements', () => {
        expect(expensesInRange(budget(), 'Transporte', '2026-09-07', 1)).toHaveLength(0);
    });

    it('is NOT empty in the month view', () => {
        // The other half of the regression: the fallback must not blank the
        // month when no day filter is active.
        expect(expensesInRange(budget(), 'Transporte', null, 30)).toHaveLength(1);
    });
});

describe('empty data', () => {
    it('returns an empty list rather than throwing', () => {
        const empty = { categories: [{ name: 'X' }], expenses: [] };

        expect(rows(empty, null, 30)[0].expenses).toHaveLength(0);
        expect(rows(empty, '2026-09-10', 1)).toHaveLength(0);
    });
});

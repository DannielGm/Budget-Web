
﻿/**
 * What is true for the active range.
 *
 * The month arrives as a mixture of two kinds of data: timestamped rows
 * (expenses, payments, savings transactions, transfers) and pre-summed month
 * columns (available_balance_bs, credit_purchases_bs, debt.payment_bs). Only
 * the first can answer a question about a single day, so every surface that
 * answers one has to derive from the rows rather than read the columns.
 *
 * Deriving it in four places is how the hero, the graph, the debts card and
 * the plan tint came to disagree with each other. This module is the one place
 * that answers the question, built by composing the helpers that already
 * encode the individual rules.
 *
 * With no date filter it returns the server's stored month columns untouched,
 * so the month view is unchanged by construction rather than by care.
 */
import { isoOfTimestamp } from '@/lib/localDate';
import { expensesInRange } from '@/lib/rangeHelpers';
import { debtsAsOf, creditPurchasesAsOf, calculateDebt, n } from '@/lib/debtMath';

const sum = (rows, pick) => (rows || []).reduce((total, row) => total + (Number(pick(row)) || 0), 0);

// One definition of the day key, and it is the LOCAL one. See localDate.js:
// the previous hand-rolled copy here and seven others all had to get the timezone
// right, and two of them did not. See isoOfTimestamp for the rule.
const isoOf = isoOfTimestamp;

/**
 * Is this date inside the active window? rangeDays mirrors Mes / 7d / 1d, and a
 * window reaching back past the 1st is clamped so it never leaves the month.
 */
export function inWindow(iso, dateFilter, rangeDays) {
    if (!dateFilter) return true;
    if (rangeDays >= 30) return true;
    if (iso.slice(0, 7) !== String(dateFilter).slice(0, 7)) return false;
    if (rangeDays <= 1) return iso === dateFilter;

    // The start is the beginning of the first day in the window. Deriving it
    // from the end of the selected day would exclude that whole first day.
    const end = new Date(`${dateFilter}T23:59:59`);
    const start = new Date(`${dateFilter}T00:00:00`);
    start.setDate(start.getDate() - (rangeDays - 1));
    const floor = new Date(`${dateFilter.slice(0, 7)}-01T00:00:00`);
    if (start < floor) start.setTime(floor.getTime());

    const at = new Date(`${iso}T12:00:00`);
    return at >= start && at <= end;
}

/**
 * @param budget        the month payload from the server
 * @param savingsLedger rows produced by BudgetService::savingsLedger
 * @param dateFilter    YYYY-MM-DD, or null for the whole month
 * @param rangeDays     30 for Mes, 7, or 1
 */
export function scopeMonth(budget = {}, { savingsLedger = [], dateFilter = null, rangeDays = 30 } = {}) {
    const filtered = dateFilter !== null && dateFilter !== undefined && rangeDays < 30;
    const categories = budget.categories || [];

    // The shared window rule, applied to whatever timestamp a row carries.
    const inRange = (row) => {
        if (!filtered) return true;
        return expensesInRange(
            { expenses: [row] },
            row.category_name,
            dateFilter,
            rangeDays,
        ).length > 0;
    };

    const scopedDebts = debtsAsOf(budget.debts || [], dateFilter, budget);
    const cashBs = sum(
        (budget.expenses || []).filter(inRange).filter((e) => {
            const category = categories.find((c) => c.name === e.category_name);
            return category && category.cash_expense && !category.is_presupuesto;
        }),
        (e) => e.amount_bs,
    );

    // Savings and transfers move the available balance even though they are not
    // expenses, so the hero has to account for them or it overstates the day.
    // Transfers are not expenses, so they are window-tested by timestamp.
    const transferInRange = (t) => (!filtered || inWindow(isoOf(t.timestamp), dateFilter, rangeDays));

    // Savings and cash transfers both move the available balance, and the server
    // counts them as SEPARATE terms (deposits, withdrawals, transfersOut,
    // transfersIn). Counting a cash->pool transfer as both a deposit and a
    // transfer-out would cancel it out and wrongly leave the balance untouched,
    // so the two are kept apart exactly as the server keeps them apart.
    const ledgerInRange = (savingsLedger || []).filter((entry) => {
        if (!filtered) return true;
        return inWindow(isoOf(n(entry.timestamp)), dateFilter, rangeDays);
    });

    // A saving transaction is a deposit or a withdrawal; a transfer is handled
    // by the transfersOut/In terms instead, so it is excluded here.
    const depositsBs = sum(
        ledgerInRange.filter((e) => e.kind !== 'transfer' && e.type === 'deposit'),
        (e) => e.amount_bs,
    );
    const withdrawalsBs = sum(
        ledgerInRange.filter((e) => e.kind !== 'transfer' && e.type !== 'deposit'),
        (e) => e.amount_bs,
    );

    const creditBs = creditPurchasesAsOf(budget, dateFilter);
    const debtPaidBs = sum(scopedDebts, (d) => d.payment_bs);
    const debtRemainingBs = sum(scopedDebts.map((debt) => calculateDebt(debt, 0)), (d) => d.remainingBs);

    const transfersInBs = sum(
        (budget.transfers || []).filter((t) => transferInRange(t) && t.destination_type === 'cash'),
        (t) => t.amount_bs,
    );
    const transfersOutBs = sum(
        (budget.transfers || []).filter((t) => transferInRange(t) && t.source_type === 'cash'),
        (t) => t.amount_bs,
    );

    const openingBs = n(budget.opening_balance_bs);
    const incomeBs = n(budget.income_bs);

    // With no filter the server's figure is authoritative and already includes
    // everything; reconstructing it would risk disagreeing with the carry-forward
    // logic, so it is used verbatim.
    // Term for term with Budget::getAvailableBalanceBsAttribute, so the day view
    // and the server's month figure are the same calculation at two scopes:
    //   opening + income - cash - debtPayments - deposits + withdrawals
    //   - transfersOut + transfersIn
    // Credit is absent from the server's list because it is already folded into
    // `cash_bs` upstream there; here it is a separate figure, so it is subtracted
    // alongside the cash it was derived from.
    const availableBs = filtered
        ? openingBs + incomeBs - cashBs - creditBs - debtPaidBs
            - depositsBs + withdrawalsBs - transfersOutBs + transfersInBs
        : n(budget.available_balance_bs);

    const planTotalBs = sum(
        (budget.expenses || []).filter(inRange).filter((e) => {
            const category = categories.find((c) => c.name === e.category_name);
            return category?.is_presupuesto;
        }),
        (e) => e.amount_bs,
    );

    return {
        filtered,
        openingBs,
        incomeBs,
        cashBs,
        creditBs,
        debtPaidBs,
        debtRemainingBs,
        depositsBs,
        withdrawalsBs,
        transfersInBs,
        transfersOutBs,
        availableBs,
        planTotalBs,
        // True when the month's plan fits inside what is actually available.
        planFitsBalance: availableBs >= planTotalBs,
        debts: scopedDebts,
        inRange,
        inWindow,
    };
}

/**
 * The balance the hero card must show for the active range.
 *
 * This is deliberately its own exported function rather than a line inside the
 * component: the card is where the wrong number is most visible, and a formula
 * that cannot be asserted is a formula that silently regresses. It reads the
 * scoped figures rather than recomputing anything.
 */
export function heroBalance(budget, options) {
    return scopeMonth(budget, options).availableBs;
}


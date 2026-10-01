
﻿/**
 * Derivations behind the "Análisis" screen. Pure functions so every figure can
 * be unit tested without mounting React, matching budgetExpenses.js and
 * debtMath.js.
 */
import { isoOfTimestamp } from '@/lib/localDate';
import { calculateDebt, isCreditCategory, n } from '@/lib/debtMath';
import { EUR, USD } from '@/lib/currency';

const n0 = (value) => Number(value) || 0;

export const daysInMonth = (monthId) => {
    const [y, m] = String(monthId || '').split('-').map(Number);
    if (!y || !m) return 30;
    return new Date(y, m, 0).getDate();
};

/**
 * Days already spent. For the running month this is "today", so the burn rate
 * is a live figure. A past month counts as fully spent, which collapses the
 * projection onto the real total; a future month counts as zero.
 */
export const daysElapsed = (monthId, todayIso) => {
    const total = daysInMonth(monthId);
    const [my, mm] = String(monthId || '').split('-').map(Number);
    const [ty, tm] = String(todayIso || '').split('-').map(Number);
    if (!my || !mm || !ty || !tm) return total;
    const monthKey = my * 100 + mm;
    const todayKey = ty * 100 + tm;
    if (todayKey > monthKey) return total;
    if (todayKey < monthKey) return 0;
    return Math.min(total, Math.max(1, Number(String(todayIso).slice(8, 10)) || 1));
};

// The one local day key. See localDate.js: this was a hand-rolled copy, and the
// local-vs-UTC rule is exactly the thing that copy is easy to get wrong.
const isoOf = isoOfTimestamp;

const isCashCategory = (c) => c.cash_expense && !c.is_presupuesto;

export function buildInsights(budget = {}, { savingsLedger = [], rate = 0, todayIso = '', currency = USD } = {}) {
    const categories = budget.categories || [];
    const expenses = budget.expenses || [];

    const spentByCategory = new Map(categories.map((c) => [c.name, 0]));
    for (const expense of expenses) {
        const name = expense.category_name;
        if (spentByCategory.has(name)) {
            spentByCategory.set(name, spentByCategory.get(name) + n(expense.amount_bs));
        }
    }

    const cashBs = categories
        .filter(isCashCategory)
        .reduce((sum, c) => sum + (spentByCategory.get(c.name) || 0), 0);

    const creditBs = n0(budget.credit_purchases_bs);
    const debts = budget.debts || [];
    const debtPaymentsBs = debts.reduce((sum, d) => sum + n(d.payment_bs), 0);
    const incomeBs = n0(budget.income_bs);
    const netBs = incomeBs - cashBs - creditBs - debtPaymentsBs;

    const total = daysInMonth(budget.month_id);
    const elapsed = daysElapsed(budget.month_id, todayIso);
    const burnBs = elapsed > 0 ? cashBs / elapsed : 0;
    const projectedCashBs = burnBs * total;

    const composition = categories
        .filter(isCashCategory)
        .map((c) => ({ name: c.name, amountBs: spentByCategory.get(c.name) || 0 }))
        .filter((c) => c.amountBs > 0)
        .sort((a, b) => b.amountBs - a.amountBs)
        .map((c) => ({ ...c, sharePct: cashBs > 0 ? (c.amountBs / cashBs) * 100 : 0 }));

    // is_presupuesto categories are excluded from cash out by definition, and
    // the schema stores no per-category planned amount, so these rows report
    // spending against the plan as a share of the plan total rather than a
    // fabricated "planned vs real" comparison.
    const planTotalBs = categories
        .filter((c) => c.is_presupuesto)
        .reduce((sum, c) => sum + (spentByCategory.get(c.name) || 0), 0);
    const planRows = categories
        .filter((c) => c.is_presupuesto)
        .map((c) => {
            const amountBs = spentByCategory.get(c.name) || 0;
            return {
                name: c.name,
                amountBs,
                sharePct: planTotalBs > 0 ? (amountBs / planTotalBs) * 100 : 0,
            };
        })
        .sort((a, b) => b.amountBs - a.amountBs);

    const calculated = debts.map((debt) => ({ debt, ...calculateDebt(debt, rate) }));
    // Unassigned credit is owed money too. `creditBs` is already filtered to
    // debt-unlinked categories, so adding it here makes this total the same
    // quantity as Budget::getDebtBsAttribute and the debt summary modal.
    const remainingBs = calculated.reduce((s, d) => s + d.remainingBs, 0) + creditBs;
    const paidBs = calculated.reduce((s, d) => s + d.paidBs, 0);
    const chargesBs = calculated.reduce((s, d) => s + d.currentChargesBs, 0);
    // Same credit term as `remainingBs`, so the progress bar and the "pagados
    // sobre" caption are measured against the figure shown in the headline.
    const debtBaseBs = calculated.reduce((s, d) => s + d.openingBs, 0) + chargesBs + creditBs;
    const debtPaidPct = debtBaseBs > 0 ? Math.min(100, (paidBs / debtBaseBs) * 100) : 0;

    const openingBs = n0(budget.opening_balance_bs);
    const projectedClosingBs = openingBs + incomeBs - projectedCashBs;

    const monthLedger = savingsLedger.filter((t) => {
        if (!budget.month_id) return true;
        return isoOf(t.timestamp).slice(0, 7) === String(budget.month_id);
    });

    /**
     * Savings flow, counted by direction rather than by record type.
     *
     * A transfer from the available balance into a savings pool arrives as a
     * `transfer` row, not a `deposit` transaction, so filtering on
     * `type === 'deposit'` alone silently dropped it and the rate read 0% for
     * users who move money into savings that way. This mirrors the rule the
     * balance graph already uses: money landing in a pool is a deposit, money
     * leaving one is a withdrawal, whichever record shape carries it.
     */
    // A pool holds dollars and euros in separate pots, so this screen counts only
    // the pot the currency on screen is saved in: adding a euro deposit to a
    // dollar total would be a number in no currency at all. Rows written before
    // the pot was marked are dollars, which is what they were.
    const isThisPot = (entry) => (entry.currency || USD) === currency;

    const savingsFlow = (entry) => {
        if (!isThisPot(entry)) return 0;
        if (entry.kind === 'transfer') {
            if (entry.destination_type === 'saving') return n(entry.amount_usd);
            if (entry.source_type === 'saving') return -n(entry.amount_usd);
            return 0;
        }
        return entry.type === 'deposit' ? n(entry.amount_usd) : -n(entry.amount_usd);
    };

    let netSavings = 0;
    for (const entry of monthLedger) netSavings += savingsFlow(entry);
    const deposits = monthLedger
        .filter((entry) => savingsFlow(entry) > 0)
        .reduce((s, entry) => s + savingsFlow(entry), 0);
    const withdrawals = monthLedger
        .filter((entry) => savingsFlow(entry) < 0)
        .reduce((s, entry) => s - savingsFlow(entry), 0);

    const incomeUsd = n0(rate) > 0 ? incomeBs / n0(rate) : 0;
    const savingsRatePct = incomeUsd > 0 ? (netSavings / incomeUsd) * 100 : 0;
    const potKey = currency === EUR ? 'balance_eur' : 'balance_usd';
    const savingsTotal = (budget.savings_pools || []).reduce((s, p) => s + n(p[potKey]), 0);

    // How much of the available balance this month's plan commits.
    const availableBalanceBs = n0(budget.available_balance_bs);
    const planAgainstAvailablePct = availableBalanceBs > 0
        ? (planTotalBs / availableBalanceBs) * 100
        : null;
    // Same rule the dashboard already uses for isBudgetOk: a plan that fits
    // inside the available balance is healthy, one that exceeds it is not.
    // A zero balance is not "over plan" 窶・there is simply nothing to compare
    // against 窶・so it stays neutral instead of showing a false warning.
    const planFitsBalance = availableBalanceBs > 0
        ? availableBalanceBs >= planTotalBs
        : true;

    const categoryByName = new Map(categories.map((c) => [c.name, c]));

    const activity = [
        ...expenses.map((e) => {
            const category = categoryByName.get(e.category_name);
            // Three kinds of spending, and they are genuinely different money: cash
            // leaves the balance, a credit purchase does not yet, and a tracked
            // expense is not spending at all. The tag asks whether the money left
            // the account, so it uses the broad test: a credit purchase linked to a
            // named debt is still bought on credit, and the `debt_id` exclusion
            // exists only so that total is not counted twice.
            let type = 'expense';
            if (category?.is_presupuesto) type = 'presupuesto';
            else if (isCreditCategory(category)) type = 'credit';
            return {
                id: `e-${e.id}`,
                timestamp: n(e.timestamp),
                label: e.label || e.category_name || 'Gasto',
                amountBs: n(e.amount_bs),
                type,
            };
        }),
        ...monthLedger.map((t) => ({
            id: `s-${t.kind}-${t.id}`,
            timestamp: n(t.timestamp),
            label: t.note || (t.type === 'deposit' ? 'Depósito' : 'Retiro'),
            amountBs: n(t.amount_bs),
            type: t.kind === 'transfer' ? 'transfer' : t.type === 'deposit' ? 'deposit' : 'withdrawal',
        })),
    ]
        .filter((a) => a.timestamp > 0)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 6);

    return {
        incomeBs, cashBs, creditBs, debtPaymentsBs, netBs,
        openingBs, total, elapsed, burnBs, projectedCashBs, projectedClosingBs,
        composition, planTotalBs, planRows, availableBalanceBs, planAgainstAvailablePct, planFitsBalance,
        debts: calculated, remainingBs, paidBs, chargesBs, debtBaseBs, debtPaidPct,
        deposits, withdrawals, netSavings, savingsRatePct, savingsTotal, incomeUsd,
        activity,
    };
}


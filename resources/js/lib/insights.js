/**
 * Derivations behind the "Análisis" screen. Pure functions so every figure can
 * be unit tested without mounting React, matching budgetExpenses.js and
 * debtMath.js.
 */
import { calculateDebt, n } from '@/lib/debtMath';

const n0 = (value) => Number(value) || 0;

/** Days in a YYYY-MM month, 30 as a safe fallback for a malformed id. */
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

const isoOf = (timestamp) => {
    const d = new Date(n(timestamp));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Cash categories are the ones the balance card already counts as spending. */
const isCashCategory = (c) => c.cash_expense && !c.is_presupuesto;

export function buildInsights(budget = {}, { savingsLedger = [], rate = 0, todayIso = '' } = {}) {
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
    const remainingBs = calculated.reduce((s, d) => s + d.remainingBs, 0);
    const paidBs = calculated.reduce((s, d) => s + d.paidBs, 0);
    const chargesBs = calculated.reduce((s, d) => s + d.currentChargesBs, 0);
    const debtBaseBs = calculated.reduce((s, d) => s + d.openingBs, 0) + chargesBs;
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
    const savingsFlowUsd = (entry) => {
        if (entry.kind === 'transfer') {
            if (entry.destination_type === 'saving') return n(entry.amount_usd);
            if (entry.source_type === 'saving') return -n(entry.amount_usd);
            return 0;
        }
        return entry.type === 'deposit' ? n(entry.amount_usd) : -n(entry.amount_usd);
    };

    let netSavingsUsd = 0;
    for (const entry of monthLedger) netSavingsUsd += savingsFlowUsd(entry);
    const depositsUsd = monthLedger
        .filter((entry) => savingsFlowUsd(entry) > 0)
        .reduce((s, entry) => s + savingsFlowUsd(entry), 0);
    const withdrawalsUsd = monthLedger
        .filter((entry) => savingsFlowUsd(entry) < 0)
        .reduce((s, entry) => s - savingsFlowUsd(entry), 0);

    const incomeUsd = n0(rate) > 0 ? incomeBs / n0(rate) : 0;
    const savingsRatePct = incomeUsd > 0 ? (netSavingsUsd / incomeUsd) * 100 : 0;
    const savingsTotalUsd = (budget.savings_pools || []).reduce((s, p) => s + n(p.balance_usd), 0);

    // How much of the available balance this month's plan commits.
    const availableBalanceBs = n0(budget.available_balance_bs);
    const planAgainstAvailablePct = availableBalanceBs > 0
        ? (planTotalBs / availableBalanceBs) * 100
        : null;
    // Same rule the dashboard already uses for isBudgetOk: a plan that fits
    // inside the available balance is healthy, one that exceeds it is not.
    // A zero balance is not "over plan" — there is simply nothing to compare
    // against — so it stays neutral instead of showing a false warning.
    const planFitsBalance = availableBalanceBs > 0
        ? availableBalanceBs >= planTotalBs
        : true;

    const categoryByName = new Map(categories.map((c) => [c.name, c]));

    const activity = [
        ...expenses.map((e) => ({
            id: `e-${e.id}`,
            timestamp: n(e.timestamp),
            label: e.label || e.category_name || 'Gasto',
            amountBs: n(e.amount_bs),
            // Presupuesto categories are tracked, not taken from the balance, so
            // they must not be reported as ordinary cash spending.
            type: categoryByName.get(e.category_name)?.is_presupuesto ? 'presupuesto' : 'expense',
        })),
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
        depositsUsd, withdrawalsUsd, netSavingsUsd, savingsRatePct, savingsTotalUsd, incomeUsd,
        activity,
    };
}


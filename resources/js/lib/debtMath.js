export const n = (value) => Number(value) || 0;

/**
 * Whether a category buys on credit at all: it spends no cash and is not a plan.
 *
 * This answers "did I not pay for this today?", which is what the credit tag
 * asks. Whether the charge is *also* attached to a named debt is a separate
 * question, asked only when totalling: see `isCreditExpense`.
 */
export function isCreditCategory(category) {
    if (!category) return false;
    if (category.cash_expense) return false;
    return !category.is_presupuesto;
}

/**
 * Canonical calculation for a named debt. Current credit charges are part of
 * the debt balance; payments reduce it. The caller owns the global credit
 * purchases total so those are never mixed into a named debt twice.
 */
export function calculateDebt(debt = {}, rate = 0) {
    const openingBs = n(debt.opening_bs);
    const currentChargesBs = n(debt.credit_expenses_bs);
    const paidBs = n(debt.payment_bs);
    const originalTotalBs = openingBs;
    const totalBs = openingBs + currentChargesBs;
    const rawRemainingBs = totalBs - paidBs;
    const remainingBs = Math.max(0, rawRemainingBs);
    const rateValue = n(rate);
    const paidPercentage = totalBs > 0
        ? Math.min(100, (paidBs / totalBs) * 100)
        : 0;
    const payments = [...(debt.payments || [])].sort(
        (a, b) => n(b.timestamp) - n(a.timestamp),
    );

    return {
        openingBs,
        currentChargesBs,
        originalTotalBs,
        totalBs,
        paidBs,
        remainingBs,
        overpaidBs: Math.max(0, -rawRemainingBs),
        paidPercentage,
        remainingUsd: rateValue > 0 ? remainingBs / rateValue : 0,
        paidUsd: rateValue > 0 ? paidBs / rateValue : 0,
        payments,
        lastPaymentAt: payments[0]?.timestamp || null,
        isPaid: totalBs > 0 && paidBs >= totalBs,
        isOverpaid: rawRemainingBs < 0,
    };
}


/**
 * Credit purchases that no named debt is already tracking.
 *
 * `globalCreditPurchasesBs` is `Budget::credit_purchases_bs`, which the backend
 * computes with `whereNull('categories.debt_id')` -- a charge attached to a debt
 * is *already excluded* there, because that debt counts the charge itself.
 * Subtracting the debts' charges a second time double-counted them and drove
 * this figure to zero. The debts argument is gone on purpose: nothing may
 * subtract from a total that has already been filtered.
 */
export function unassignedCreditPurchases(globalCreditPurchasesBs = 0) {
    return Math.max(0, n(globalCreditPurchasesBs));
}

/** End-of-day cutoff in ms for a YYYY-MM-DD string, inclusive. */
export const endOfDay = (dateIso) => new Date(`${dateIso}T23:59:59.999`).getTime();

const atOrBefore = (timestamp, cutoff) => n(timestamp) > 0 && n(timestamp) <= cutoff;

/**
 * The state of every debt as of a given day.
 *
 * The stored `payment_bs` / `credit_expenses_bs` are month totals, so showing
 * them in a day view would report the whole month as though it were that day.
 * Both are recoverable from timestamped rows that are already in the payload:
 * payments from `debts.payments`, and charges from the expense rows the
 * backend's own credit-charges accessor already sums.
 *
 * A null `dateFilter` means "the whole month", which returns the stored totals
 * untouched so the month view is bit-for-bit what it was.
 */
export function debtsAsOf(debts = [], dateFilter = null, budget = {}) {
    if (!dateFilter) return debts;

    const cutoff = endOfDay(dateFilter);
    const expenses = budget.expenses || [];
    const categories = budget.categories || [];
    const categoryByName = new Map(categories.map((c) => [c.name, c]));

    return debts.map((debt) => {
        // Categories attached to this debt name it as the source of its charges.
        const debtCategoryNames = new Set(
            categories
                .filter((c) => c.debt_id === debt.id)
                .map((c) => c.name),
        );
        // Older rows predate the explicit link, so fall back to matching by name.
        const byName = new Set(
            (debt.categories || []).map((c) => c.name ?? c),
        );
        const names = debtCategoryNames.size ? debtCategoryNames : byName;

        const chargesAsOf = expenses
            .filter((e) => names.has(e.category_name))
            .filter((e) => atOrBefore(e.timestamp, cutoff))
            .reduce((sum, e) => sum + n(e.amount_bs), 0);

        const paidAsOf = (debt.payments || [])
            .filter((p) => atOrBefore(p.timestamp, cutoff))
            .reduce((sum, p) => sum + n(p.amount_bs), 0);

        return {
            ...debt,
            payment_bs: paidAsOf,
            credit_expenses_bs: chargesAsOf,
        };
    });
}

/**
 * Total credit purchases as of a day.
 *
 * Mirrors the backend exactly: cash is `cash_expense && !is_presupuesto`, so
 * credit is the complement of that pair. Getting this wrong would silently
 * disagree with `Budget::credit_purchases_bs` on the month view.
 */
/**
 * Whether one expense row is a credit purchase.
 *
 * The one definition of that rule, extracted because two callers need it and a
 * second copy would be free to drift: `creditPurchasesAsOf` sums the rows, while
 * `isCreditCategory` -- derived from it -- tags them. Mirrors
 * `Budget::getCreditPurchasesBsAttribute`
 * exactly -- a charge attached to a debt is excluded, so this sums only the
 * unassigned half. `isCreditCategory` is the broader test the activity tag uses.
 */
export function isCreditExpense(category) {
    if (!isCreditCategory(category)) return false;
    return category.debt_id === null || category.debt_id === undefined;
}

export function creditPurchasesAsOf(budget = {}, dateFilter = null) {
    if (!dateFilter) return n(budget.credit_purchases_bs);

    const cutoff = endOfDay(dateFilter);
    const categoryByName = new Map(
        (budget.categories || []).map((c) => [c.name, c]),
    );

    return (budget.expenses || [])
        .filter((e) => isCreditExpense(categoryByName.get(e.category_name)))
        .filter((e) => atOrBefore(e.timestamp, cutoff))
        .reduce((sum, e) => sum + n(e.amount_bs), 0);
}

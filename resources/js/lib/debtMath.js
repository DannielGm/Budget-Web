export const n = (value) => Number(value) || 0;

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


/** Credit purchases not already represented by a named debt's current charges. */
export function unassignedCreditPurchases(debts = [], globalCreditPurchasesBs = 0) {
    const assigned = debts.reduce(
        (sum, debt) => sum + n(debt.credit_expenses_bs),
        0,
    );
    return Math.max(0, n(globalCreditPurchasesBs) - assigned);
}

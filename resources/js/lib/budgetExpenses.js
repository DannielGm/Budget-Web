/**
 * Single definition shared by the balance card and graph: cash expenses
 * include every non-presupuesto cash category and respect an optional cutoff.
 */
export function calculateCashExpenses(budget, dateFilter = null) {
    const cutoff = dateFilter
        ? new Date(`${dateFilter}T23:59:59`).getTime()
        : Infinity;

    return (budget.expenses || [])
        .filter((expense) => {
            const category = (budget.categories || []).find(
                (item) => item.name === expense.category_name
            );

            return category?.cash_expense
                && !category?.is_presupuesto
                && Number(expense.timestamp) <= cutoff;
        })
        .reduce((sum, expense) => sum + (Number(expense.amount_bs) || 0), 0);
}

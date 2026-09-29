/**
 * Which expenses belong to the active range, and the category list that follows
 * from it.
 *
 * These were inline in the Dashboard page, which made them untestable: a
 * function living in a page cannot be imported without pulling React and the
 * whole component tree along with it. They are pure data transforms, so they
 * live here with the other lib helpers and the range rule exists exactly once.
 */

/**
 * Port of the Kotlin BudgetScreen's filtering rules:
 *  - null dateFilter  -> every expense
 *  - rangeDays >= 30  -> the whole month
 *  - rangeDays <= 1   -> only the same local day
 *  - otherwise        -> the last N days, clamped to the 1st of the month
 */
/**
 * The one definition of "which expenses belong in this range", shared by the
 * category list and the selected-category fallback so the two can never
 * disagree. A null dateFilter means the whole month, so everything qualifies.
 *
 * rangeDays mirrors the Mes / 7d / 1d switch: >= 30 is the month, <= 1 is the
 * single selected day, otherwise the trailing window clamped to the 1st.
 */
export function expensesInRange(budget, categoryName, dateFilter, rangeDays) {
    const all = (budget.expenses || []).filter((e) => e.category_name === categoryName);
    if (dateFilter === null || dateFilter === undefined) return all;
    if (rangeDays >= 30) return all;

    if (rangeDays <= 1) return all.filter((e) => sameDay(e.timestamp, dateFilter));

    // A window ending on the 12th with rangeDays 7 must include the 6th, so the
    // start is the 6th at the beginning of the day. Subtracting from the END of
    // the selected day and keeping 23:59:59 excluded the whole first day.
    const end = new Date(`${dateFilter}T23:59:59`);
    const start = new Date(`${dateFilter}T00:00:00`);
    start.setDate(start.getDate() - (rangeDays - 1));
    const floor = new Date(`${dateFilter.slice(0, 7)}-01T00:00:00`);
    if (start < floor) start.setTime(floor.getTime());

    return all.filter((e) => {
        const t = new Date(e.timestamp);
        return t >= start && t <= end;
    });
}

export function filteredCategories(budget, dateFilter, rangeDays) {
    const inRange = (category) => expensesInRange(budget, category.name, dateFilter, rangeDays);

    // A day or 7d window hides categories with nothing inside it; the month
    // views keep every category, because an empty month is a valid state.
    if (dateFilter !== null && dateFilter !== undefined && rangeDays < 30) {
        return budget.categories
            .map((category) => ({ ...category, expenses: inRange(category) }))
            .filter((c) => c.expenses.length > 0);
    }

    return budget.categories.map((c) => ({ ...c, expenses: inRange(c) }));
}

function sameDay(timestampMs, dateIso) {
    const d = new Date(timestampMs);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return iso === dateIso;
}
import { scopeMonth } from '@/lib/scopedMoney';
import { isoOfTimestamp } from '@/lib/localDate';

const n = (value) => Number(value) || 0;
// The one local day key. See localDate.js -- this line was a third copy of it, and
// the local-vs-UTC distinction is the whole content of the function.
const keyOf = isoOfTimestamp;
const atStart = (value) => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime(); };
const atEnd = (value) => { const d = new Date(value); d.setHours(23, 59, 59, 999); return d.getTime(); };

// The savings series is kept in Bs, like the other two metrics, so the whole
// graph is one unit and the three cannot be compared against each other by
// accident. Every movement that moves savings carries amount_bs already, which
// is the figure scopedMoney uses for the same movements, so nothing has to be
// converted to get here. The display currency is applied at render.
const bsOf = (event) => n(event.amount_bs);

const rangeDaysFor = (mode) => (mode === 'Mes' ? 30 : mode === '7d' ? 7 : 1);

export function buildGraphSeries({ budget, categories = [], rangeMode = 'Mes', dateFilter, today, savingsLedger = [] }) {
    const anchor = dateFilter || today || `${budget.month_id}-01`;
    const monthStart = new Date(`${budget.month_id}-01T00:00:00`).getTime();
    const from = rangeMode === '7d' ? atStart(anchor) - 6 * 86400000 : rangeMode === '1d' ? atStart(anchor) : monthStart;
    const to = atEnd(anchor);
    const visible = new Set(categories.map((category) => category.name));
    const categoryByName = new Map((budget.categories || []).map((category) => [category.name, category]));
    const events = [];
    let available = n(budget.opening_balance_bs) + n(budget.income_bs), expenses = 0, savings = 0;

    const add = (timestamp, availableChange, expenseChange, savingsChange, label) => events.push({ timestamp: n(timestamp), availableChange, expenseChange, savingsChange, label });
    for (const expense of budget.expenses || []) {
        const category = categoryByName.get(expense.category_name), amount = n(expense.amount_bs);
        const affectsCash = Boolean(category?.cash_expense && !category.is_presupuesto);
        add(expense.timestamp, affectsCash ? -amount : 0, affectsCash ? amount : 0, 0, expense.label || expense.category_name || 'Gasto');
    }

    for (const transfer of budget.transfers || []) {
        if (transfer.source_type !== 'cash' && transfer.destination_type !== 'cash') continue;
        const amount = n(transfer.amount_bs), value = bsOf(transfer);
        add(transfer.timestamp, transfer.source_type === 'cash' ? -amount : amount, 0, transfer.destination_type === 'saving' ? value : -value, transfer.note || 'Transferencia');
    }
    for (const entry of savingsLedger || []) {
        let change = 0, availableChange = 0;
        if (entry.kind === 'transaction') {
            const value = bsOf(entry);
            change = entry.type === 'deposit' ? value : -value;
            availableChange = entry.type === 'deposit' ? -value : value;
        } else if (entry.source_type !== 'cash' && entry.destination_type !== 'cash') {
            const value = bsOf(entry);
            change = entry.destination_type === 'saving' ? value : entry.source_type === 'saving' ? -value : 0;
        }
        if (change || availableChange) add(entry.timestamp, availableChange, 0, change, entry.note || (change > 0 ? 'Ahorro' : 'Retiro'));
    }

    // Debt payments reduce the balance. scopeMonth has already reduced them to
    // what is outstanding for this range, so the graph and the hero cannot
    // disagree; the old `if (!dateFilter)` guard meant a day view silently
    // dropped them and its end point did not reconcile with the card.
    const scoped = scopeMonth(budget, { savingsLedger, dateFilter, rangeDays: rangeDaysFor(rangeMode) });
    if (scoped.debtPaidBs) add(monthStart, -scoped.debtPaidBs, 0, 0, 'Pagos de deuda');

    events.sort((a, b) => a.timestamp - b.timestamp);
    const points = [];
    let cursor = from, eventIndex = 0;
    const start = { available, expenses, savings };
    for (const event of events) {
        if (event.timestamp >= from) break;
        available += event.availableChange; expenses += event.expenseChange; savings += event.savingsChange;
        eventIndex += 1;
    }
    while (cursor <= to) {
        const dayEvents = [], next = cursor + 86400000;
        const daily = { available: 0, expenses: 0, savings: 0 };
        while (eventIndex < events.length && events[eventIndex].timestamp < next) {
            const event = events[eventIndex++];
            available += event.availableChange; expenses += event.expenseChange; savings += event.savingsChange;
            daily.available += event.availableChange; daily.expenses += event.expenseChange; daily.savings += event.savingsChange;
            dayEvents.push(event);
        }
        const date = new Date(cursor);
        points.push({ timestamp: cursor, key: keyOf(cursor), available, cashExpenses: expenses, savings, availableChange: daily.available, expenseChange: daily.expenses, savingsChange: daily.savings, events: dayEvents, label: date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) });
        cursor = next;
    }

    // Planning status always uses the complete monthly plan. Only the red
    // expense line may reflect the category selected in the dashboard.
    const budgetCategories = budget.categories.filter((category) => category.is_presupuesto);

    // The "planned" amount is the sum of all expenses logged inside `is_presupuesto` categories.
    const planned = budgetCategories.reduce((sum, category) => sum + (budget.expenses || []).filter((expense) => expense.category_name === category.name).reduce((subtotal, expense) => subtotal + n(expense.amount_bs), 0), 0);

    // The "spent" amount is the available balance.
    // The "spent" amount is the balance for THIS range, not the month column.
    const spent = scoped.availableBs;
    const remaining = spent - planned;

    // The backend value is authoritative for the current month. Reconcile any
    // residual (for example a movement type not yet exposed in the timeline)
    // without changing expenses or savings.
    if (points.length) {
        // Reconcile against the same scoped figure on every range, so the graph's
        // end point always equals the hero rather than only in the month view.
        const reconciliation = scoped.availableBs - points.at(-1).available;
        if (reconciliation !== 0) {
            points.forEach((point) => { point.available += reconciliation; });
            start.available += reconciliation;
        }
    }

    const last = points.at(-1);
    return {
        points,
        metrics: { available: last?.available ?? 0, expenses: last?.cashExpenses ?? 0, savings: last?.savings ?? 0 },
        periodChange: { available: (last?.available ?? 0) - start.available, expenses: (last?.cashExpenses ?? 0) - start.expenses, savings: (last?.savings ?? 0) - start.savings },
        planned,
        spent,
        remaining,
        hasEvents: events.some((event) => event.timestamp >= from && event.timestamp <= to),
    };
}



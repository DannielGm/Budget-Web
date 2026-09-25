const n = (value) => Number(value) || 0;
const keyOf = (value) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const atStart = (value) => { const d = new Date(value); d.setHours(0, 0, 0, 0); return d.getTime(); };
const atEnd = (value) => { const d = new Date(value); d.setHours(23, 59, 59, 999); return d.getTime(); };
const usd = (event, fallbackRate) => n(event.amount_usd) || ((n(event.rate) || n(fallbackRate)) > 0 ? n(event.amount_bs) / (n(event.rate) || n(fallbackRate)) : 0);

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
        const amount = n(transfer.amount_bs), value = usd(transfer, budget.income_rate);
        add(transfer.timestamp, transfer.source_type === 'cash' ? -amount : amount, 0, transfer.destination_type === 'saving' ? value : -value, transfer.note || 'Transferencia');
    }
    for (const entry of savingsLedger || []) {
        let change = 0, availableChange = 0;
        if (entry.kind === 'transaction') {
            change = entry.type === 'deposit' ? n(entry.amount_usd) : -n(entry.amount_usd);
            availableChange = entry.type === 'deposit' ? -n(entry.amount_bs) : n(entry.amount_bs);
        } else if (entry.source_type !== 'cash' && entry.destination_type !== 'cash') {
            const value = usd(entry, budget.income_rate);
            change = entry.destination_type === 'saving' ? value : entry.source_type === 'saving' ? -value : 0;
        }
        if (change || availableChange) add(entry.timestamp, availableChange, 0, change, entry.note || (change > 0 ? 'Ahorro' : 'Retiro'));
    }

    // Debt payments have no per-payment timestamp in the timeline payload.
    // Apply their cumulative total at month start so the final balance matches
    // the server's authoritative available_balance_bs.
    if (!dateFilter) {
        const debtPayments = (budget.debts || []).reduce((sum, debt) => sum + n(debt.payment_bs), 0);
        if (debtPayments) add(monthStart, -debtPayments, 0, 0, 'Pagos de deuda');
    }

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
    const planned = budgetCategories.reduce((sum, category) => sum + n(category.planned_bs), 0);
    const spent = budgetCategories.reduce((sum, category) => sum + (budget.expenses || []).filter((expense) => expense.category_name === category.name).reduce((subtotal, expense) => subtotal + n(expense.amount_bs), 0), 0);

    // The backend value is authoritative for the current month. Reconcile any
    // residual (for example a movement type not yet exposed in the timeline)
    // without changing expenses or savings.
    if (!dateFilter && points.length) {
        const reconciliation = n(budget.available_balance_bs) - points.at(-1).available;
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
        remaining: planned - spent,
        hasEvents: events.some((event) => event.timestamp >= from && event.timestamp <= to),
    };
}


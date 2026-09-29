import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BudgetGraph from '@/Components/Budget/BudgetGraph';
import { USD, EUR } from '@/lib/currency';

/**
 * A render, which is the only check that can catch this class of bug.
 *
 * The budget graph's savings formatter closed over `currency` with nothing in
 * the component binding it. That is a ReferenceError the moment the graph
 * renders -- a white screen -- while the bundler stayed green and every
 * source-level test passed, because none of them ever executed the component.
 * Reading the source cannot catch it either: a scan cannot tell a destructured
 * prop from an undefined identifier, or a word in a comment from a variable.
 * Actually rendering can, and costs nothing new: renderToStaticMarkup ships
 * with the react-dom this project already uses to run the app.
 *
 * The rate arrives as a prop, so the graph needs no Inertia page context and
 * this test needs no mocking. That is the same change that removed the bug:
 * one less thing the component reaches for implicitly.
 */
describe('the budget graph renders in each currency', () => {
    const at = new Date('2026-09-12T12:00:00').getTime();

    const budget = {
        month_id: '2026-09',
        income_bs: 1000,
        income_rate: '10',
        opening_balance_bs: 500,
        available_balance_bs: 900,
        categories: [{ name: 'Comida', cash_expense: true, is_presupuesto: false }],
        expenses: [{ id: 1, category_name: 'Comida', amount_bs: '100', timestamp: at }],
        transfers: [{ source_type: 'cash', destination_type: 'saving', amount_bs: '200', timestamp: at }],
        debts: [],
    };

    const render = (savingsCurrency, savingsRate) => renderToStaticMarkup(
        <BudgetGraph
            budget={budget}
            categories={budget.categories}
            rangeMode="Mes"
            dateFilter={null}
            today="2026-09-15"
            savingsLedger={[]}
            savingsCurrency={savingsCurrency}
            savingsRate={savingsRate}
        />,
    );

    it.each([[USD, 10], [EUR, 12]])('renders %s without a reference error', (currency, rate) => {
        expect(render(currency, rate)).toContain('Bs');
    });

    it('never prints a dollar sign on a bolivar tab', () => {
        // The default tab is a Bs metric, so the dollar symbol has no business
        // in the markup in either currency. This is the assertion the original
        // hard-coded `$${fmtUsd(value)}` would have failed.
        expect(render(USD, 10)).not.toContain('$');
        expect(render(EUR, 12)).not.toContain('$');
    });

    it('survives a rate that has not loaded', () => {
        // A missing rate is 0, and convert() answers 0 for it rather than
        // Infinity, so the figure shows nothing instead of breaking the page.
        expect(render(EUR, 0)).toContain('Bs');
    });
});

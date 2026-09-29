import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SavingsDashboard from '@/Components/Budget/SavingsDashboard';
import { CurrencyProvider, USD, EUR } from '@/lib/currency';

/**
 * The savings view, actually rendered.
 *
 * The day filter is the point of this file. The ledger filter called a helper
 * that was never imported, so the view threw a ReferenceError and white-screened
 * as soon as a day was selected; the month view short-circuited past the call,
 * which is exactly why nothing noticed. A render in both states is the only
 * check that can hold that line still.
 */
const page = vi.hoisted(() => ({ props: {} }));

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: page.props }),
    router: { visit: () => {} },
}));

const AT = new Date('2026-09-12T12:00:00').getTime();

const BUDGET = {
    month_id: '2026-09',
    total_savings_usd: '100',
    total_savings_eur: '50',
    savings_pools: [
        { name: 'Digital', balance_usd: '60', balance_eur: '50' },
        { name: 'Bank', balance_usd: '40', balance_eur: '0' },
        { name: 'Physical', balance_usd: '0', balance_eur: '0' },
    ],
};

const LEDGER = [
    { id: 1, kind: 'transaction', type: 'deposit', pool: 'Digital', currency: USD, amount_usd: '60', amount_bs: '2190', exchange_rate: '36.5', timestamp: AT },
    { id: 2, kind: 'transaction', type: 'deposit', pool: 'Digital', currency: EUR, amount_usd: '50', amount_bs: '2190', exchange_rate: '43.8', timestamp: AT },
];

const RATES = {
    USD: { effective: '36.50', usd: { latest: '36.50', day: '36.00' }, eur: { latest: '43.80', day: '43.00' } },
    EUR: { effective: '43.80', usd: { latest: '36.50', day: '36.00' }, eur: { latest: '43.80', day: '43.00' } },
};

function render(currency, dateFilter = null) {
    page.props = { rates: RATES[currency] };

    return renderToStaticMarkup(
        <CurrencyProvider currency={currency}>
            <SavingsDashboard
                budget={BUDGET}
                savingsLedger={LEDGER}
                dateFilter={dateFilter}
                rangeDays={dateFilter ? 7 : 30}
            />
        </CurrencyProvider>,
    );
}

describe('the savings view renders', () => {
    it.each([USD, EUR])('with and without a day filter, in %s mode', (currency) => {
        expect(() => render(currency)).not.toThrow();
        expect(() => render(currency, '2026-09-12')).not.toThrow();
    });

    it('shows only the pot the currency on screen is saved in', () => {
        // The euro deposit is not added to the dollar total, and it is not listed
        // in the history either: the ledger is filtered by pot, not by amount.
        expect(render(USD)).toContain('$ 100,00');
        expect(render(USD)).not.toContain('€ 50,00');
        expect(render(EUR)).toContain('€ 50,00');
        expect(render(EUR)).not.toContain('$ 100,00');
    });
});

describe('the savings hero matches every other hero', () => {
    it('states the total at 48px', () => {
        // The app's hero size, shared with the balance card and the analisis hero.
        // A server render never overflows, so the fit search leaves the preferred
        // size in place and the markup carries it -- which is what makes the size
        // assertable at all.
        expect(render(USD)).toContain('font-size:48px');
    });
});
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SavingsOverview from '@/Components/Budget/SavingsOverview';
import SavingsPoolSummaryStrip from '@/Components/Budget/SavingsPoolSummaryStrip';
import { CurrencyProvider, USD, EUR } from '@/lib/currency';

/**
 * The savings summary and the strip that opens it, actually rendered.
 *
 * A pool holds two pots -- the dollars and the euros -- and the whole point of
 * this file is that a screen states the one it is showing and never the other.
 * Both currencies are rendered for that reason, and the assertions are written
 * so that a dollar pot printed under a euro sign (or a euro pot folded into a
 * dollar total) fails rather than merely looks odd.
 *
 * The rates live in the Inertia page payload, which the currency hooks read with
 * usePage(). That context only exists inside a running Inertia app, so it is
 * mocked here: handing the component its payload is what lets it execute at all,
 * and executing it is the whole point of the file.
 */
const page = vi.hoisted(() => ({ props: {} }));

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: page.props }),
    router: { visit: () => {} },
}));

const POOLS = [
    { name: 'Digital', balance_usd: '60', balance_eur: '50' },
    { name: 'Bank', balance_usd: '40', balance_eur: '0' },
    { name: 'Physical', balance_usd: '0', balance_eur: '0' },
];

const budget = {
    month_id: '2026-09',
    // The two pots, and the three figures the patrimony is built from.
    total_savings_usd: '100',
    total_savings_eur: '50',
    savings_pools: POOLS,
    available_balance_bs: '500',
    debt_bs: '300',
    credit_purchases_bs: '100',
};

/** The same two real series; `effective` is whatever the budget form holds. */
const RATES = {
    USD: { effective: '36.50', usd: { latest: '36.50', day: null }, eur: { latest: '43.80', day: null } },
    EUR: { effective: '43.80', usd: { latest: '36.50', day: null }, eur: { latest: '43.80', day: null } },
};

/** React separates adjacent text nodes with a comment; a phrase must read whole. */
const text = (markup) => markup.replace(/<!-- -->/g, '');

function renderNode(currency, rates, node, dateFilter = null) {
    page.props = { rates, dateFilter };

    return text(renderToStaticMarkup(
        <CurrencyProvider currency={currency}>{node}</CurrencyProvider>,
    ));
}

const render = (currency, rates = RATES[currency], dateFilter = null) => renderNode(
    currency, rates, <SavingsOverview budget={budget} />, dateFilter,
);

const strip = (currency, rates = RATES[currency], dateFilter = null) => renderNode(
    currency,
    rates,
    <SavingsPoolSummaryStrip pools={POOLS} summaryUrl="/savings" />,
    dateFilter,
);

describe('the summary states one pot, in its own currency', () => {
    it('leads with the dollar pot on a dollar screen', () => {
        // 100 dollars, and 100 x 36.50 for the bolivar line -- the dollar series,
        // never the form's rate, which in euro mode is a euro figure.
        expect(render(USD)).toContain('$ 100,00');
        expect(render(USD)).toContain('\u2248 Bs 3650,00');
    });

    it('leads with the euro pot on a euro screen', () => {
        // 50 euros, and 50 x 43.80: the euro pot takes the euro series, so the
        // same balance would no longer be valued at 36.50.
        expect(render(EUR)).toContain('\u20AC 50,00');
        expect(render(EUR)).toContain('\u2248 Bs 2190,00');
    });

    it('states the pot at the same 48px as every other hero', () => {
        // 48px is the app's hero size, shared with the balance card, the analisis
        // hero and the savings dashboard. A server render never overflows, so the
        // fit search leaves the preferred size in place and the markup carries it.
        expect(render(USD)).toContain('font-size:48px');
    });

    it('never prints one pot under the wrong symbol', () => {
        // The dollar total is 100 and the euro total is 50, so either would be
        // unmistakably wrong under the wrong symbol.
        expect(render(USD)).not.toContain('\u20AC 100,00');
        expect(render(EUR)).not.toContain('$ 50,00');
    });

    it('states the other pot underneath, in its own currency', () => {
        expect(render(USD)).toContain('\u20AC 50,00 en euros');
        expect(render(EUR)).toContain('$ 100,00 en d\u00F3lares');
    });

    it('never prints a zero bolivar line under a zero pot', () => {
        // "\u2248 Bs 0,00" is noise; the add action is what the space is for.
        expect(renderNode(EUR, RATES.EUR, <SavingsOverview budget={budget} onAddMovement={() => {}} />))
            .not.toContain('\u2248 Bs 0,00');
    });

    it('offers no action when there is nothing to add to', () => {
        // The affordance belongs to whoever can open the form, not to the pot.
        const withoutAction = renderNode(EUR, RATES.EUR, <SavingsOverview budget={budget} />);
        expect(withoutAction).toContain('\u20AC 0,00');
        expect(withoutAction).not.toContain('A\u00F1adir ahorro');
    });
});

describe('the summary adds both pots up only in the one place that may', () => {
    it('shows each pool blended, with what is inside it', () => {
        // Digital: 60 x 36.50 + 50 x 43.80 = 4380 Bs, which is 120 dollars and
        // 100 euros -- and the breakdown says which pots made it up.
        expect(render(USD)).toContain('$ 120,00');
        expect(render(EUR)).toContain('\u20AC 100,00');
        expect(render(USD)).toContain('$ 60,00 \u00b7 \u20AC 50,00');
    });

    it('states the heritage of both as one figure', () => {
        // Every pool: Digital 4380 Bs + Bank 1460 Bs = 5840, which is 160 dollars
        // or 133.33 euros.
        expect(render(USD)).toContain('Ambos: $ 160,00');
        expect(render(EUR)).toContain('Ambos: \u20AC 133,33');
    });
});

describe('the patrimony sums the sources in bolivars', () => {
    it('reads in dollars: 500 cash + 5840 of savings - 100 credit - 200 debt', () => {
        // 6040 Bs over the dollar rate. The debt is the named debts alone: the
        // credit purchases are the next line, so the two cannot be double counted.
        expect(render(USD)).toContain('165,48');
    });

    it('reads in euros off the same bolivar total', () => {
        // The same 6040 Bs over the euro rate. The savings pots are not converted
        // into each other: each is valued in Bs at its own series, and the sum is
        // divided once.
        expect(render(EUR)).toContain('137,90');
    });
});

describe('the patrimony states its bolivar value at market', () => {
    // 500 cash + 60x36.50 + 50x43.80 + 40x36.50 - 100 - 200 = 6040 Bs, and the
    // line says so in either currency: the form is on a BCV rate here, so it
    // happens to be the same figure in both.
    it('prints it in both currencies', () => {
        expect(render(USD)).toContain('\u2248 Bs 6040,00');
        expect(render(EUR)).toContain('\u2248 Bs 6040,00');
    });

    it('cannot be re-priced by a custom rate', () => {
        // The protection this line exists for. The figure above follows the form
        // (it reads $165,00 at a custom 40, because the cash and the debts are
        // divided at 40); the bolivar figure is built from the two BCV series and
        // from nothing the user typed, so it does not move. The two therefore
        // differ, and the difference is the custom rate showing itself.
        const customRate = {
            effective: '40.00',
            usd: { latest: '36.50', day: null },
            eur: { latest: '43.80', day: null },
        };

        expect(render(USD, customRate)).toContain('$ 165,00');
        expect(render(USD, customRate)).toContain('\u2248 Bs 6040,00');
    });

    it('is left out rather than printed as a zero when no rate has loaded', () => {
        const noRate = {
            effective: '0',
            usd: { latest: '36.50', day: null },
            eur: { latest: '43.80', day: null },
        };

        expect(render(USD, noRate)).not.toContain('\u2248 Bs');
    });
});

describe('the pool strip aggregates, and the dashboard does not', () => {
    it('blends every pool into the display currency', () => {
        // Digital 4380 Bs + Bank 1460 Bs = 5840 Bs, which is 160 dollars or
        // 133.33 euros.
        expect(strip(USD)).toContain('$ 160,00');
        expect(strip(EUR)).toContain('\u20AC 133,33');
    });

    it('keeps the both-currency breakdown under each pool', () => {
        expect(strip(USD)).toContain('$ 60,00 \u00b7 \u20AC 50,00');
    });

    it('leaves a pot out of the total when its series has not loaded', () => {
        // A euro balance cannot be valued in bolivars without the euro series, so
        // it stays out of the aggregate rather than being valued at the dollar
        // rate. The pot itself still states its own figure.
        const noEuroSeries = {
            effective: '36.50',
            usd: { latest: '36.50', day: null },
            eur: { latest: null, day: null },
        };

        expect(strip(USD, noEuroSeries)).toContain('Total');
        expect(strip(USD, noEuroSeries)).toContain('$ 100,00');
        expect(strip(USD)).toContain('$ 160,00');
    });

    it('links to the summary as a real anchor', () => {
        expect(strip(USD)).toContain('href="/savings"');
    });
});

/**
 * The two cases that the fixture above cannot tell apart, because there the form
 * rate and the series agree. Both are the bug the user reported, so both are
 * pinned here with numbers that a mixed-up rule could not reproduce.
 */
describe('the pot already on screen is never re-priced', () => {
    // A custom rate the user typed is a statement about their month, not about
    // how a dollar is priced. The old rule valued every pot in bolivars and
    // divided by it, so $100 of savings displayed as $91.25 the moment a custom
    // rate of 40 sat against BCV's 36.50.
    const customRate = {
        effective: '40.00',
        usd: { latest: '36.50', day: null },
        eur: { latest: '43.80', day: null },
    };

    it('leaves the dollar pot exactly as the user stated it', () => {
        expect(render(USD, customRate)).toContain('$ 100,00');
    });

    it('still values its bolivar line at the rate the app uses', () => {
        // Every other bolivar figure on the screen divides by the form rate, so
        // this one does too: 100 x 40.00.
        expect(render(USD, customRate)).toContain('\u2248 Bs 4000,00');
    });

    it('adds only the other pot, converted at the market', () => {
        // Digital is 60 as it stands plus 50 euros at 43.80/36.50 = 60, and the
        // strip adds up to 160. The old rule gave (60x36.50 + 50x43.80) / 40 =
        // 109.50 for the one pool and 146.00 for the total.
        expect(strip(USD, customRate)).toContain('$ 120,00');
        expect(strip(USD, customRate)).toContain('$ 160,00');
    });

    it('keeps the bolivar value of a pot on its own series', () => {
        // 60x36.50 + 50x43.80 + 40x36.50 = 5840. A custom dollar rate has no
        // business in what a foreign balance is worth in bolivars.
        expect(strip(USD, customRate)).toContain('\u2248 Bs 5840,00');
    });
});

describe('a conversion takes both series from the same day', () => {
    // The picked day's rates are a different ratio from today's, on purpose: a
    // figure that mixed the two days could not pass by coincidence.
    const day = '2026-09-12';
    const dayRates = {
        effective: '44.00',
        usd: { latest: '36.50', day: '40.00' },
        eur: { latest: '43.80', day: '44.00' },
    };

    it('values the euro pot with that day and the dollars with the same day', () => {
        // Digital: 50 euros as they stand, plus 60 dollars at 40.00/44.00 =
        // 54.55. Mixing days would have given (60x36.50 + 50x43.80) / 44 = 99.55
        // for the one pool and 132.73 for the strip total.
        expect(strip(EUR, dayRates, day)).toContain('\u20AC 104,55');
        expect(strip(EUR, dayRates, day)).toContain('\u20AC 140,91');
    });

    it('leaves the bolivar lines on that day too', () => {
        // The pot on screen at the app's rate for the day: 50 x 44.00.
        expect(render(EUR, dayRates, day)).toContain('\u2248 Bs 2200,00');
        // The pools' own value in Bs is each pot's series for the same day:
        // 60x40.00 + 50x44.00 + 40x40.00 = 6200, not today's 5840.
        expect(strip(EUR, dayRates, day)).toContain('\u2248 Bs 6200,00');
    });
});
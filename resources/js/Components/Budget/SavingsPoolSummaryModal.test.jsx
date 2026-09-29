import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SavingsPoolSummaryModal, { potFootnote } from '@/Components/Budget/SavingsPoolSummaryModal';
import { CurrencyProvider, USD, EUR } from '@/lib/currency';

/**
 * The line under a pot's amount in the pool modal.
 *
 * The wording IS the requirement here, and it cannot be asserted through the
 * markup: Headless UI renders a Modal's body only once it is mounted, so a server
 * render of the component produces an empty string whatever it would draw. The
 * rule therefore lives in a pure function, which is both testable and the one
 * place the component can get it wrong.
 */
const page = vi.hoisted(() => ({ props: {} }));

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: page.props }),
    router: { visit: () => {} },
}));

describe('the pot footnote', () => {
    it('says nothing under the pot already in the currency on screen', () => {
        // That pot IS the figure: it is not converted, so a line under it would be
        // describing a conversion that never happens.
        expect(potFootnote({
            pot: USD, displayCurrency: USD, balance: 60, rate: 36.5, converted: 60,
        })).toBeNull();

        expect(potFootnote({
            pot: EUR, displayCurrency: EUR, balance: 50, rate: 43.8, converted: 50,
        })).toBeNull();
    });

    it('prints the rate it multiplied by, then what the pot comes to', () => {
        // 50 euros at 43.80 Bs/euro is Bs 2190, which at 36.50 Bs/dollar is
        // $60.00 -- the three parts tie out, which is the whole point: the rate in
        // the line used to be an average of what the pool was funded at, not the
        // one the bolivar figure above it was multiplied by.
        //
        // es-ES groups only from five digits, so 2190 prints without a separator.
        const line = potFootnote({
            pot: EUR, displayCurrency: USD, balance: 50, rate: 43.8, converted: 60,
        });

        expect(line).toBe('\u2248 Bs 2190,00 \u00b7 43,80 Bs/\u20AC = $ 60,00');
    });

    it('converts a dollar pot into euros the same way round', () => {
        const line = potFootnote({
            pot: USD, displayCurrency: EUR, balance: 60, rate: 36.5, converted: 50,
        });

        expect(line).toBe('\u2248 Bs 2190,00 \u00b7 36,50 Bs/$ = \u20AC 50,00');
    });

    it('keeps what it can when the conversion could not be made', () => {
        const line = potFootnote({
            pot: EUR, displayCurrency: USD, balance: 50, rate: 43.8, converted: null,
        });

        expect(line).toBe('\u2248 Bs 2190,00 \u00b7 43,80 Bs/\u20AC');
    });

    it('says so when the series has not loaded, rather than showing nothing', () => {
        // An install with no euro rate used to print the amount and stop, which
        // reads as a broken line rather than a missing one.
        expect(potFootnote({
            pot: EUR, displayCurrency: USD, balance: 50, rate: 0, converted: null,
        })).toBe('Sin tasa BCV de euros');

        expect(potFootnote({
            pot: USD, displayCurrency: EUR, balance: 60, rate: null, converted: null,
        })).toBe('Sin tasa BCV de dólares');
    });
});

/**
 * The modal itself renders nothing on the server (see the note above), so this
 * only proves the component executes: a reference error here is a white screen
 * with a green build and green tests, which is the failure this suite exists for.
 */
describe('the pool modal renders', () => {
    const pool = { name: 'Bank', balance_usd: '60', balance_eur: '50' };
    const rates = {
        effective: '36.50',
        usd: { latest: '36.50', day: null },
        eur: { latest: '43.80', day: null },
    };

    it.each([USD, EUR])('does not throw in %s mode', (currency) => {
        page.props = { rates };

        expect(() => renderToStaticMarkup(
            <CurrencyProvider currency={currency}>
                <SavingsPoolSummaryModal
                    show
                    onClose={() => {}}
                    pool="Bank"
                    pools={[pool]}
                    savingsLedger={[]}
                />
            </CurrencyProvider>,
        )).not.toThrow();
    });
});
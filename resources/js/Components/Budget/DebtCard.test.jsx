import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DebtCard from '@/Components/Budget/DebtCard';
import { CurrencyProvider, USD } from '@/lib/currency';
import { fmtBs, fmtPct } from '@/lib/money';

/**
 * The debt card's headline total, actually rendered.
 *
 * The card used to show the named debts only, while the summary modal opened from
 * it showed the backend total, which adds unassigned credit purchases. The same
 * credit also appeared as its own row lower down the card, so the visible rows
 * added up to more than the headline -- the symptom reported was that the total
 * was not adding up. These cases pin the headline to the same quantity the modal
 * and Budget::getDebtBsAttribute use.
 */

// useBolivarFigure reads the effective rate off the Inertia page.
const page = vi.hoisted(() => ({ props: { rates: { effective: 40 } } }));

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: page.props }),
    router: { visit: () => {} },
}));

// 1000 opening + 200 new charges - 300 paid = 900 still owed on this debt.
const DEBT = {
    id: 1,
    label: 'Banco',
    opening_bs: '1000',
    credit_expenses_bs: '200',
    payment_bs: '300',
    payments: [],
};

const render = (props = {}) => renderToStaticMarkup(
    <CurrencyProvider currency={USD}>
        <DebtCard
            debts={[DEBT]}
            totalDebtBs={900}
            creditPurchasesBs={150}
            rate={40}
            onOpenSummary={() => {}}
            onAdd={() => {}}
            onEdit={() => {}}
            {...props}
        />
    </CurrencyProvider>,
);

describe('the debt total', () => {
    it('counts unassigned credit as part of the headline', () => {
        // 900 owed on named debts + 150 bought on credit and not yet filed.
        expect(render()).toContain(fmtBs(1050));
    });

    it('does not show the named debts alone', () => {
        // Scoped to the headline element, so a row lower down cannot satisfy this.
        expect(render()).not.toContain('Bs ' + fmtBs(900) + '</p>');
    });

    it('measures progress against a total that includes the credit', () => {
        // 300 paid, out of 1050 still owed + 300 paid.
        expect(render()).toContain(fmtPct((300 / 1350) * 100, 0));
    });

    it('names the unassigned credit it counted', () => {
        expect(render()).toContain('sin asignar');
    });

    it('leaves the headline alone when there is no credit', () => {
        const html = render({ creditPurchasesBs: 0 });

        expect(html).toContain(fmtBs(900));
        expect(html).not.toContain('sin asignar');
    });

    it('does not claim there are no debts when only credit is outstanding', () => {
        const html = render({ debts: [], totalDebtBs: 0 });

        expect(html).not.toContain('Sin deudas registradas');
    });
});

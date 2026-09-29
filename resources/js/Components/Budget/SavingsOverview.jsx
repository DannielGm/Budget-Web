import React from 'react';
import {
    Landmark, Wallet, Banknote, PiggyBank, CreditCard, Receipt, ChevronRight, Plus,
} from 'lucide-react';
import { fmtBs, fmtUsd } from '@/lib/money';
import { convertBetween, currencySymbol, potAmount, potInBs, useCurrency, EUR, USD } from '@/lib/currency';
import useFitText from '@/hooks/useFitText';
import {
    useBolivarFigure, useCurrencySymbol, useFigure, useRateInBs,
} from '@/hooks/useFigure';

/**
 * The savings summary: what is held, in both currencies, and what it comes to
 * once everything else is counted with it.
 *
 * It is the destination the pool strip opens. Every figure comes from props the
 * dashboard already has, so there is no second endpoint and no second source of
 * truth.
 *
 * A pool holds two pots -- the dollars and the euros -- so the screen states both
 * rather than one figure in two readings. The pot the currency on screen is
 * saved in leads, the other is shown in its own currency underneath, and the
 * heritage of both together is one number that only exists here and in the
 * strip.
 */

// The app has one staged reveal (see app.css). The savings screen builds top to
// bottom with the same 50ms steps as "Análisis".
const REVEAL = 'insights-reveal';

const POOL_LABELS = { Digital: 'Digital', Bank: 'Banco', Physical: 'Físico' };

const POOL_ICONS = {
    Digital: [Wallet, 'text-violet-500'],
    Bank: [Landmark, 'text-blue-500'],
    Physical: [Banknote, 'text-green-500'],
};

const CURRENCY_NAMES = { USD: 'dólares', EUR: 'euros' };

function Card({ title, icon: Icon, index = 0, children }) {
    return (
        <section
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            style={{ animationDelay: `${index * 50}ms` }}
            data-reveal={REVEAL}
        >
            <h2 className="mb-3 flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                {Icon ? <Icon size={15} className="shrink-0" aria-hidden="true" /> : null}
                <span className="truncate">{title}</span>
            </h2>
            {children}
        </section>
    );
}

/** One line of the patrimony sum: a source, and what it contributes. */
function SourceRow({ icon: Icon, label, note, sign, value }) {
    const symbol = useCurrencySymbol();
    // Measured like every other money figure in the app: a six-figure cash
    // balance used to push straight past the card, and `shrink-0` made it
    // squeeze the label instead of itself.
    const [valueRef, valueSize] = useFitText({ min: 11, max: 14, emergencyMin: 10 });

    return (
        <div className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <Icon size={15} className="shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-gray-600 dark:text-gray-300">{label}</p>
                {note ? (
                    <p className="truncate text-[10px] font-medium text-gray-400 dark:text-gray-500">{note}</p>
                ) : null}
            </div>
            <p
                ref={valueRef}
                style={{ fontSize: `${valueSize}px` }}
                className={`min-w-0 whitespace-nowrap text-sm font-bold tabular ${sign === '-' ? 'text-red-500 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}
            >
                {sign} {symbol} {fmtUsd(value)}
            </p>
        </div>
    );
}

/** One pool: both pots inside one blended figure, and what is inside it. */
function PoolRow({ name, usd, eur, blended, onSelect }) {
    const symbol = useCurrencySymbol();
    const [Icon, iconClass] = POOL_ICONS[name] || POOL_ICONS.Digital;
    // Same reason as the source rows: a large pool balance has to give way before
    // it pushes the card wider than the screen.
    const [blendedRef, blendedSize] = useFitText({ min: 11, max: 14, emergencyMin: 10 });

    const parts = [
        usd !== 0 ? `${currencySymbol(USD)} ${fmtUsd(usd)}` : null,
        eur !== 0 ? `${currencySymbol(EUR)} ${fmtUsd(eur)}` : null,
    ].filter(Boolean);

    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect?.(name)}
                title={`Ver movimientos de ${POOL_LABELS[name] || name}`}
                className="touch-feedback flex w-full items-center gap-3 py-2.5 text-left"
            >
                <span className="shrink-0 rounded-lg bg-gray-100 p-2 dark:bg-gray-800">
                    <Icon size={16} className={iconClass} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-700 dark:text-gray-200">
                    {POOL_LABELS[name] || name}
                </span>
                <span className="min-w-0 text-right">
                    <span
                        ref={blendedRef}
                        style={{ fontSize: `${blendedSize}px` }}
                        className="block whitespace-nowrap text-sm font-black tabular text-gray-800 dark:text-gray-100"
                    >
                        {symbol} {fmtUsd(blended)}
                    </span>
                    {/* Not white on white: at 10px in the lightest grey this line
                        is the one that says what the pool is actually made of, and
                        it was under 3.5:1. */}
                    <span className="block truncate whitespace-nowrap text-[10px] font-bold tabular text-gray-500 dark:text-gray-400">
                        {parts.length > 0 ? parts.join(' · ') : '—'}
                    </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-gray-300 dark:text-gray-600" aria-hidden="true" />
            </button>
        </li>
    );
}

export default function SavingsOverview({ budget = {}, onSelectPool, onAddMovement }) {
    const symbol = useCurrencySymbol();
    const currency = useCurrency();
    const other = currency === EUR ? USD : EUR;
    // Every bolivar figure on this screen is divided by the display rate once,
    // at the end. Both pots are added up in Bs first, each at its own series.
    const display = useBolivarFigure();
    // The rate every bolivar figure on this screen divides at, and what the pot
    // already in this currency is worth in bolivars.
    const { rate: displayRate } = useFigure();
    const usdRate = useRateInBs(USD);
    const eurRate = useRateInBs(EUR);
    const rates = { usdRate, eurRate };

    // A pool in the display currency: the pot already in it is the amount, and
    // only the other one is converted, with both series from the same day.
    const poolValue = (pool) => (convertBetween(potAmount(pool, USD), USD, currency, rates) ?? 0)
        + (convertBetween(potAmount(pool, EUR), EUR, currency, rates) ?? 0);

    // Independent pool balances from the backend (transactions + transfers).
    const pools = (budget.savings_pools && budget.savings_pools.length)
        ? budget.savings_pools
        : ['Digital', 'Bank', 'Physical'].map((name) => ({ name, balance_usd: '0', balance_eur: '0' }));

    const totalOf = (potCurrency) => pools.reduce((acc, p) => acc + potAmount(p, potCurrency), 0);
    const usdTotal = totalOf(USD);
    const eurTotal = totalOf(EUR);

    const potTotal = currency === EUR ? eurTotal : usdTotal;
    const otherTotal = currency === EUR ? usdTotal : eurTotal;
    const otherLabel = CURRENCY_NAMES[other];

    const blendedTotal = pools.reduce((acc, pool) => acc + poolValue(pool), 0);

    // Patrimonio holds everything at once, so the sources are added up in Bs --
    // the one unit the cash, both pots and the debts are all already in -- and
    // the sum is read in the currency on screen once. `available_balance_bs` and
    // `debt_bs` are the server's own month figures, the same ones the balance
    // card and the debt card show, so this screen cannot invent a third version
    // of either. `debt_bs` is credit purchases PLUS the named debts' remaining
    // balances: stating those two separately is the same total in its parts.
    const cashBs = Number(budget.available_balance_bs || 0);
    const creditBs = Number(budget.credit_purchases_bs || 0);
    const debtBs = Number(budget.debt_bs || 0) - creditBs;
    // Each source in the currency on screen by the rule its own unit requires: the
    // bolivar ones at the app's rate, the savings by the pot rule above. Adding
    // the pots up in bolivars and dividing once would re-price the pot that is
    // already in this currency, which is the one figure that must not convert.
    const patrimony = display(cashBs) + blendedTotal - display(creditBs) - display(debtBs);

    // What the same estate is worth in bolivars, every source at its own series
    // rate for the day or range. Deliberately NOT the figure above multiplied
    // back: that would follow the budget form's rate, and the point of this line
    // is that a personal rate cannot re-price what is actually held. With a
    // custom rate the two figures therefore differ, and that difference IS the
    // custom rate showing.
    const savingsBs = pools.reduce((acc, pool) => acc + potInBs(pool, rates), 0);
    const patrimonyBs = cashBs + savingsBs - creditBs - debtBs;

    // 48px, like every other hero (BalanceCard, InsightsDashboard, and the
    // savings dashboard itself), so the same kind of figure is the same size on
    // every screen. The search only steps down when the amount would overflow.
    const [totalRef, totalSize] = useFitText({ min: 30, max: 48, emergencyMin: 22 });
    // The patrimony total is the widest figure on the screen and it is the one
    // most likely to go negative or six-figure, so it measures itself too.
    const [patrimonyRef, patrimonySize] = useFitText({ min: 14, max: 18, emergencyMin: 12 });

    return (
        <div className="space-y-4 pb-10">
            <section
                className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A2E] to-[#16213E] p-5 text-white shadow-xl"
                style={{ animationDelay: '50ms' }}
                data-reveal={REVEAL}
                aria-labelledby="savings-overview-total"
            >
                <h2 id="savings-overview-total" className="text-[10px] font-bold uppercase tracking-widest text-white/70">
                    {/* The name the user chose, not the raw code: the switch in the
                        header and in Settings says "Dólares", so the headline
                        saying "USD" was the only place the code leaked out. */}
                    Ahorro en {CURRENCY_NAMES[currency]}
                </h2>
                <p
                    ref={totalRef}
                    style={{ fontSize: `${totalSize}px` }}
                    className="mt-1 whitespace-nowrap text-5xl font-black font-serif tracking-tight tabular"
                >
                    {symbol} {fmtUsd(potTotal)}
                </p>
                {/* A pot that has never been funded is a place to start, not a
                    dead end: the figure says zero and this says what to do about
                    it. Hidden entirely when a rate is missing, since the action
                    does not depend on one. */}
                {potTotal === 0 && onAddMovement ? (
                    <button
                        type="button"
                        onClick={() => onAddMovement()}
                        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-black text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/80"
                    >
                        <Plus size={15} aria-hidden="true" />
                        Añadir ahorro en {CURRENCY_NAMES[currency]}
                    </button>
                ) : null}
                {displayRate > 0 && potTotal !== 0 ? (
                    <p className="mt-1 whitespace-nowrap text-[11px] font-medium tabular text-white/70">
                        ≈ Bs {fmtBs(potTotal * displayRate)}
                    </p>
                ) : null}
                {otherTotal !== 0 ? (
                    <p className="mt-1.5 truncate whitespace-nowrap text-[11px] font-bold tabular text-white/80">
                        {currencySymbol(other)} {fmtUsd(otherTotal)} en {otherLabel}
                    </p>
                ) : null}
                <p className="mt-1.5 truncate whitespace-nowrap text-[11px] font-semibold tabular text-white/60">
                    Ambos: {symbol} {fmtUsd(blendedTotal)}
                </p>
            </section>

            <Card title="Ahorros por fondo" icon={PiggyBank} index={1}>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {pools.map((pool) => (
                        <PoolRow
                            key={pool.name}
                            name={pool.name}
                            usd={potAmount(pool, USD)}
                            eur={potAmount(pool, EUR)}
                            blended={poolValue(pool)}
                            onSelect={onSelectPool}
                        />
                    ))}
                </ul>
            </Card>

            <Card title="Patrimonio" icon={Landmark} index={2}>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <SourceRow icon={Wallet} label="Efectivo disponible" note="Saldo del mes" sign="+" value={display(cashBs)} />
                    <SourceRow icon={PiggyBank} label="Ahorros" note="Dólares y euros" sign="+" value={blendedTotal} />
                    <SourceRow icon={CreditCard} label="Deudas" note="Saldos pendientes" sign="-" value={display(debtBs)} />
                    <SourceRow icon={Receipt} label="Compras a crédito" note="Pendiente de pago" sign="-" value={display(creditBs)} />
                </div>

                {/* The total stays on one line however large it gets: the label is
                    nowrap so it cannot wrap, and the figure beside it measures
                    itself, so the row is always a single line rather than the
                    label breaking in two next to a long amount. */}
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-gray-100 pt-3 dark:border-gray-800">
                    <p className="shrink-0 whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                        Patrimonio total
                    </p>
                    {/* The figure and its bolivar face are one right-aligned
                        stack: they are the same estate in two units, so they sit
                        on the same edge instead of at opposite ones. */}
                    <div className="min-w-0 text-right">
                        <p
                            ref={patrimonyRef}
                            style={{ fontSize: `${patrimonySize}px` }}
                            className={`whitespace-nowrap text-lg font-black tabular ${patrimony < 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}
                        >
                            {symbol} {fmtUsd(patrimony)}
                        </p>
                        {displayRate > 0 ? (
                            /* The basis is named, because this line and the figure
                               above it deliberately disagree under a custom rate:
                               this one is the market. "tasa BCV" says so here
                               rather than leaving the reader to wonder which of
                               the two is wrong. */
                            /* Not nowrap. A bolivar total is a long unbreakable string,
                               and nowrap inside this shrinkable box only pushed it
                               out through the card's edge. Two short lines stay
                               inside; the number keeps its tabular figures. */
                            <p className="mt-0.5 text-[11px] font-bold tabular leading-snug text-gray-500 dark:text-gray-400">
                                ≈ Bs {fmtBs(patrimonyBs)} &middot; tasa BCV
                            </p>
                        ) : null}
                    </div>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                    Efectivo + ahorros &minus; deudas &minus; compras a crédito, en {CURRENCY_NAMES[currency]}
                </p>
            </Card>
        </div>
    );
}
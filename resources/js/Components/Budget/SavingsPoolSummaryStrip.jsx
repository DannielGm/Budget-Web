import React from 'react';
import { router } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { Landmark, Wallet, Banknote, ChevronRight } from 'lucide-react';
import { fmtBs, fmtUsd } from '@/lib/money';
import useFitText from '@/hooks/useFitText';
import { convertBetween, currencySymbol, potAmount, potInBs, useCurrency, EUR, USD } from '@/lib/currency';
import { useCurrencySymbol, useRateInBs } from '@/hooks/useFigure';
import { PANEL_SPRING } from '@/Components/Budget/MonthSummaryStrip';

/**
 * The three savings pools as one card, the way the dashboard states its month
 * figures: a divided row, and the card itself is the way in.
 *
 * This is the ONE place the two pots are added up. A pool holds dollars and
 * euros separately, and the savings screen above states only the pot the
 * currency on screen is saved in, because a dollar figure with a euro pot folded
 * into it would be a lie. Here each pool is valued in bolivars -- its dollars at
 * the dollar series and its euros at the euro one -- and then read in the
 * display currency once, which is the only honest place for a blended total.
 */

const POOL_LABELS = { Digital: 'Digital', Bank: 'Banco', Physical: 'Físico' };

const POOL_ICONS = {
    Digital: [Wallet, 'text-violet-500'],
    Bank: [Landmark, 'text-blue-500'],
    Physical: [Banknote, 'text-green-500'],
};

/**
 * One pool: the blended figure, and beneath it what is actually inside it.
 *
 * Its own component because the fit search is a hook and cannot be called from
 * the parent's .map callback.
 */
function PoolItem({ name, usd, eur, blended, align = 'left' }) {
    const symbol = useCurrencySymbol();
    const [Icon, iconClass] = POOL_ICONS[name] || POOL_ICONS.Digital;
    const alignment = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
    const rowAlignment = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
    const [amountRef, amountSize] = useFitText({ min: 10, max: 14 });
    const [partsRef, partsSize] = useFitText({ min: 8, max: 10 });

    // Both pots, in their own units and their own symbols. A pot with nothing in
    // it is left out rather than printed as zero, so a single-currency pool reads
    // as a single-currency pool.
    const parts = [
        usd !== 0 ? `${currencySymbol(USD)} ${fmtUsd(usd)}` : null,
        eur !== 0 ? `${currencySymbol(EUR)} ${fmtUsd(eur)}` : null,
    ].filter(Boolean);

    return (
        <div className={`min-w-0 px-3 first:pl-0 last:pr-0 ${alignment}`}>
            <p className={`flex items-center gap-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 ${rowAlignment}`}>
                <Icon size={12} className={`shrink-0 ${iconClass}`} aria-hidden="true" />
                <span className="truncate">{POOL_LABELS[name] || name}</span>
            </p>
            <p
                ref={amountRef}
                style={{ fontSize: `${amountSize}px` }}
                className="mt-1 whitespace-nowrap font-black leading-tight tabular text-gray-800 dark:text-gray-100"
            >
                {symbol} {fmtUsd(blended)}
            </p>
            {/* The lightest grey on white was around 3.9:1, under AA for text, and
                this is the line that says what the pool is made of. */}
            <p
                ref={partsRef}
                style={{ fontSize: `${partsSize}px` }}
                className="whitespace-nowrap font-bold leading-tight tabular text-gray-500 dark:text-gray-400"
                title="Dólares y euros de este fondo, por separado"
            >
                {parts.length > 0 ? parts.join(' · ') : '—'}
            </p>
        </div>
    );
}

export default function SavingsPoolSummaryStrip({ pools = [], summaryUrl }) {
    const symbol = useCurrencySymbol();
    const currency = useCurrency();
    // Both series for the day on screen: the other pot needs one of them and its
    // own to convert, and between them they value what is held in bolivars.
    const usdRate = useRateInBs(USD);
    const eurRate = useRateInBs(EUR);
    const rates = { usdRate, eurRate };

    const rows = (pools || []).map((pool) => {
        const usd = potAmount(pool, USD);
        const eur = potAmount(pool, EUR);
        // The pot already in the display currency is the amount, untouched: no
        // cross-rate is computed for the currency on screen. Only the other pot
        // is converted, and with both series from the same day. A pot whose
        // series has not loaded contributes nothing rather than a figure nobody
        // can check; the breakdown underneath still states it in its own unit.
        const blended = (convertBetween(usd, USD, currency, rates) ?? 0)
            + (convertBetween(eur, EUR, currency, rates) ?? 0);

        return { name: pool.name, usd, eur, inBs: potInBs(pool, rates), blended };
    });

    const totalBs = rows.reduce((acc, row) => acc + row.inBs, 0);
    const total = rows.reduce((acc, row) => acc + row.blended, 0);
    // A euro pot on a device with no euro series yet contributes nothing to the
    // bolivar total, so the aggregate is only worth showing when it is more than
    // a rate would leave on its own.
    const showBs = totalBs > 0;

    return (
        <a
            href={summaryUrl}
            onClick={(event) => {
                // Let modified clicks open a new tab, matching normal links.
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                router.visit(summaryUrl);
            }}
            aria-label="Abrir el resumen de ahorros"
            title="Abrir el resumen de ahorros"
            className="touch-feedback group block rounded-2xl transition-transform duration-150 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-[#FF8A3D] dark:focus-visible:ring-[#9B7BFF]"
        >
            <motion.section
                layoutId="savings-panel"
                transition={PANEL_SPRING}
                aria-label="Ahorros por fondo, dólares y euros"
                className="grid grid-cols-3 divide-x-2 divide-gray-200 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm group-hover:shadow-md dark:divide-gray-700 dark:border-gray-800 dark:bg-gray-900"
            >
                {rows.map((row, index) => (
                    <PoolItem
                        key={row.name}
                        name={row.name}
                        usd={row.usd}
                        eur={row.eur}
                        blended={row.blended}
                        align={index === 0 ? 'left' : index === rows.length - 1 ? 'right' : 'center'}
                    />
                ))}

                {/* The footer's total IS the summary, so it says so. The whole card
                    is a link, but on a touch screen the only cues are this and the
                    press state, and the pool rows inside the summary it opens carry
                    chevrons this row did not. */}
                <div className="col-span-3 mt-3 flex items-center justify-between gap-3 border-t-2 border-gray-100 pt-3 dark:border-gray-800">
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300">
                        Total
                        <ChevronRight size={14} className="sm:hidden" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate whitespace-nowrap text-sm font-black tabular text-gray-800 dark:text-gray-100">
                            {symbol} {fmtUsd(total)}
                            {showBs ? (
                                <span className="ml-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                                    ≈ Bs {fmtBs(totalBs)}
                                </span>
                            ) : null}
                        </span>
                        <span className="hidden shrink-0 items-center gap-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500 sm:flex dark:text-gray-400">
                            Ver detalle
                            <ChevronRight size={13} aria-hidden="true" />
                        </span>
                    </span>
                </div>
            </motion.section>
        </a>
    );
}
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownToLine, ArrowUpFromLine, Landmark, History, ArrowRightLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fmtBs, fmtUsd } from '@/lib/money';
import useFitText from '@/hooks/useFitText';
import { inWindow } from '@/lib/scopedMoney';
import { n } from '@/lib/debtMath';
import { fmtForeign, potAmount, useCurrency, EUR, USD } from '@/lib/currency';
import { useCurrencySymbol, useFigure, useRateLabel } from '@/hooks/useFigure';
import SavingsPoolSummaryStrip from '@/Components/Budget/SavingsPoolSummaryStrip';

const isoOf = (ms) => {
    const d = new Date(Number(ms) || 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

/** Carries the shared layout id only while this form is open, so the id is
 *  never held by two elements at once. */
function TransferTrigger({ layoutId, children }) {
    if (!layoutId) return children;
    return <motion.div layoutId={layoutId} className="shrink-0">{children}</motion.div>;
}

const POOL_LABELS = { Digital: 'Digital', Bank: 'Banco', Physical: 'Físico' };

const partLabel = (type, id) => {
    if (type === 'cash') return 'Efectivo';
    if (type === 'external') return 'Externo';
    if (type === 'saving') return POOL_LABELS[id] || id;
    return id || 'Categoría';
};


/** The "Deposito - Ahorro -> Banco" style tag, kept on a single line. */
function MovementTag({ children, className }) {
    const [ref, size] = useFitText({ min: 5.5, max: 7 });

    return (
        <span
            ref={ref}
            style={{ fontSize: `${size}px` }}
            className={cn(
                "block text-[10px] whitespace-nowrap rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-bold uppercase",
                className
            )}
        >
            {children}
        </span>
    );
}

/** The Bs-denominated line under a movement amount, kept on a single line. */
function BsRateLine({ value, currency }) {
    // The rate on a savings movement is Bs per unit of the pot's own currency.
    // It travels with the movement because a pool holds both, and a euro
    // movement labelled with the dollar series would be as wrong as its figure.
    const rateLabel = useRateLabel(currency);
    const [ref, size] = useFitText({ min: 8, max: 10 });

    return (
        <p
            ref={ref}
            style={{ fontSize: `${size}px` }}
            className="text-[10px] whitespace-nowrap leading-none font-bold text-gray-400 tabular"
        >
            {value} {rateLabel}
        </p>
    );
}

export default function SavingsDashboard({ budget, savingsLedger = [], dateFilter = null, rangeDays = 30, onAddSaving, onTransfer, onEditTransfer, transferLayoutId = null, summaryUrl = null }) {
    const currency = useCurrency();

    // Independent pool balances from the backend (transactions + transfers).
    const pools = (budget.savings_pools && budget.savings_pools.length)
        ? budget.savings_pools
        : ['Digital', 'Bank', 'Physical'].map((name) => ({ name, balance_usd: '0', balance_eur: '0' }));

    // Unified, chronologically merged history (manual transactions + transfers).
    // Pool balances stay as they are: a balance is a balance, not a day's spend,
    // and shrinking it would misrepresent what the user actually holds. The
    // movement HISTORY is range filtered, because that list is what reads as
    // "what happened" and showing a whole month under a day filter misleads.
    // This screen states one pot: the one the currency on screen is saved in. A
    // pool holds dollars and euros separately, and a dollar screen that added
    // both up would be stating a euro balance in dollars. The strip underneath is
    // where the two are combined.
    const total = Number(
        budget[currency === EUR ? 'total_savings_eur' : 'total_savings_usd']
            ?? pools.reduce((acc, p) => acc + potAmount(p, currency), 0),
    );

    const entries = (savingsLedger || []).filter((entry) => {
        if ((entry.currency || USD) !== currency) return false;
        if (!dateFilter) return true;
        return inWindow(isoOf(n(entry.timestamp)), dateFilter, rangeDays);
    });

    const symbol = useCurrencySymbol();
    // A pot already in the currency on screen is not converted: the amount the
    // user stated is the figure. Its bolivar line is the app's own rate for the
    // day or range, which is the one every other bolivar figure here divides by.
    const { rate: displayRate } = useFigure();
    const totalBs = total * displayRate;
    // 48px, like every other hero in the app, so the same kind of figure is the
    // same size on every screen. The search only steps down when the total would
    // otherwise overflow the card, which a long savings figure used to simply do:
    // the size was fixed and nothing measured it.
    const [totalRef, totalSize] = useFitText({ min: 30, max: 48, emergencyMin: 22 });

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#1A1A2E] to-[#16213E] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Landmark size={120} />
                </div>

                <div className="flex justify-between items-center mb-2 relative z-10 gap-2">
                    <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-white/80 sm:text-sm sm:tracking-widest">
                        {/* The name, not the code: the switch in the header and in
                            Settings says "Dólares". */}
                        Ahorro Total · {currency === EUR ? 'Euros' : 'Dólares'}
                    </span>
                    <div className="flex shrink-0 gap-2">
                    <TransferTrigger layoutId={transferLayoutId}>
                        {/* A labelled control, not an icon alone: this is the only
                            way to add savings anywhere in the app, and a bare
                            ArrowRightLeft is invisible on a phone. */}
                        <button
                            onClick={onTransfer}
                            className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white/80"
                            title="Depósito / Retiro"
                        >
                            <ArrowRightLeft size={18} aria-hidden="true" />
                            <span className="hidden sm:inline">Depósito / Retiro</span>
                        </button>
                    </TransferTrigger>

                    </div>
                </div>

                <div className="relative z-10">
                    <h1
                        ref={totalRef}
                        style={{ fontSize: `${totalSize}px` }}
                        className="whitespace-nowrap text-5xl font-black font-serif tracking-tight tabular"
                    >
                        {symbol} {fmtUsd(total)}
                    </h1>
                    {displayRate > 0 ? (
                        <p className="text-white/70 text-sm font-bold mt-1">
                            ≈ Bs {fmtBs(totalBs)}
                        </p>
                    ) : null}
                </div>

            </div>

            {summaryUrl ? (
                <SavingsPoolSummaryStrip pools={pools} summaryUrl={summaryUrl} />
            ) : null}

            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 transition-colors">
                <div className="mb-4 flex min-w-0 items-center gap-2">
                    <History size={18} className="shrink-0 text-gray-400" />
                    <h4 className="truncate whitespace-nowrap text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">
                        Historial de Movimientos
                    </h4>
                </div>

                <div className="space-y-3">
                    {entries.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 font-bold py-6">
                            Sin movimientos en {currency === EUR ? 'euros' : 'dólares'}
                        </p>
                    ) : (
                        entries.map((t) => t.kind === 'transfer' ? (
                            <div
                                key={`tr-${t.id}`}
                                onClick={() => onEditTransfer?.(t)}
                                className="flex items-center justify-between gap-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-xl transition-colors"
                            >
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                        <ArrowRightLeft size={16} />
                                    </div>

                                        <div className="min-w-0">
                                            {(() => {
                                                const isDeposit = t.source_type === 'cash';
                                                return (
                                                    <React.Fragment>
                                                        <p className="truncate font-bold text-sm dark:text-white">
                                                            {t.note || (isDeposit ? 'Depósito' : 'Retiro')}
                                                        </p>
                                                        <MovementTag className="mt-1">
                                                                {isDeposit ? 'Depósito' : 'Retiro'} · {partLabel(t.source_type, t.source_id)} → {partLabel(t.destination_type, t.destination_id)}
                                                            </MovementTag>
                                                        <p className="mt-0.5 text-[10px] text-gray-400 font-medium">
                                                            {new Date(t.timestamp).toLocaleDateString('es-ES')} {new Date(t.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </React.Fragment>
                                                );
                                            })()}
                                        </div>

                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="font-black text-sm text-blue-600 dark:text-blue-400">
                                        {fmtForeign(t.amount_usd, t.currency || USD)}
                                    </p>
                                    <BsRateLine value={parseFloat(t.rate || 0).toLocaleString('es-ES')} currency={t.currency || USD} />
                                </div>
                            </div>
                        ) : (
                            (() => {
                                const isDeposit = t.type === 'deposit';
                                return (
                                    <div key={t.id} className="flex items-center justify-between gap-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-xl transition-colors" onClick={() => onAddSaving({ ...t, category: t.pool })}>
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                isDeposit ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                            )}>
                                                {isDeposit ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate font-bold text-sm dark:text-white">
                                                    {isDeposit ? 'Depósito' : 'Retiro'}
                                                </p>
                                                <MovementTag className="mt-1 px-1.5 py-0.5">{POOL_LABELS[t.pool] || t.pool}</MovementTag>
                                                <p className="mt-0.5 text-[10px] text-gray-400 font-medium">
                                                    {new Date(t.timestamp).toLocaleDateString('es-ES')} {new Date(t.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className={cn("font-black text-sm", isDeposit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                                {isDeposit ? '+' : '-'} {fmtForeign(t.amount_usd, t.currency || USD)}
                                            </p>
                                            <BsRateLine value={parseFloat(t.exchange_rate).toLocaleString('es-ES')} currency={t.currency || USD} />
                                        </div>
                                    </div>
                                );
                            })()
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

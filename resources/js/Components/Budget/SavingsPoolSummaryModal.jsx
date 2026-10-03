import React from 'react';
import Modal from '@/Components/Modal';
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Wallet, Banknote, ArrowRightLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { convertBetween, currencySymbol, fmtForeign, potAmount, rateUnitLabel, useCurrency, USD, EUR } from '@/lib/currency';
import { fmtBs, fmtUsd, fmtRate } from '@/lib/money';
import { useRateInBs } from '@/hooks/useFigure';
import useFitText from '@/hooks/useFitText';

/** The two pots a pool holds, in the order they are stated. */
const POTS = [USD, EUR];

/** What a pot says when there is no rate to say it with. */
const MISSING_RATE_NOTE = {
    USD: 'Sin tasa BCV de dólares',
    EUR: 'Sin tasa BCV de euros',
};

/**
 * The line under a pot's amount: what it is worth in bolivars at the rate in
 * use, the rate itself, and what the pot comes to in the currency on screen.
 *
 * Three rules, and each of them is a mistake this modal has shipped:
 *
 *  - The pot already in the display currency gets no line at all. It is the
 *    figure, it is not converted, and a conversion line under it would be
 *    describing a conversion that never happens.
 *
 *  - The rate printed is the rate the bolivar figure was multiplied by. They
 *    used to be two different numbers, the second being an average of what the
 *    pool happened to be funded at, so the line quoted a rate that was not the
 *    one in the arithmetic above it.
 *
 *  - A series that has not loaded says so. An install with no euro rate prints
 *    a note rather than nothing, so the missing line reads as explained instead
 *    of broken.
 *
 * @param converted the pot read in the display currency, or null when it could
 *                   not be converted; the line then drops its last part
 * @returns the text, or null when this pot has no line
 */
export function potFootnote({ pot, displayCurrency, balance, rate, converted }) {
    if (pot === displayCurrency) return null;

    const factor = Number(rate) || 0;
    if (factor <= 0) return MISSING_RATE_NOTE[pot] ?? MISSING_RATE_NOTE.USD;

    const line = [
        `≈ Bs ${fmtBs(balance * factor)}`,
        `${fmtRate(factor)} ${rateUnitLabel(pot)}`,
    ].join(' · ');

    // The conversion hangs off the rate instead of becoming a third item, so the
    // line reads as one statement: this much, at this rate, comes to that much.
    return converted === null || converted === undefined
        ? line
        : `${line} = ${currencySymbol(displayCurrency)} ${fmtUsd(converted)}`;
}

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const POOL_LABELS = { Digital: 'Digital', Bank: 'Banco', Physical: 'Físico' };

const POOL_ICONS = {
    Digital: Wallet,
    Bank: Landmark,
    Physical: Banknote,
};

const partLabel = (type, id) => {
    if (type === 'cash') return 'Efectivo';
    if (type === 'external') return 'Externo';
    if (type === 'saving') return POOL_LABELS[id] || id;
    return id || 'Categoría';
};

const formatDate = (ms) => new Date(ms).toLocaleDateString('es-ES');

/**
 * Floating summary for a single savings pool (same layout as DebtSummaryModal).
 * Shows the pool's own balance plus only its movements (manual transactions
 * merged with transfers from/to cash).
 *
 * Each pot is stated in its own currency. The pot already in the currency on
 * screen is the figure; the other one is the one being converted, and it says
 * what it comes to under the line (see potFootnote).
 */
export default function SavingsPoolSummaryModal({ show, onClose, pool, pools = [], savingsLedger = [], onAddMovement, onEditMovement }) {
    // Both series, because each pot's rate line is its own currency's and the one
    // that has not loaded must not borrow the other's.
    const currency = useCurrency();
    const usdRate = useRateInBs(USD);
    const eurRate = useRateInBs(EUR);
    const rates = { usdRate, eurRate };
    const Icon = POOL_ICONS[pool] || Wallet;

    // The same heading as the savings screen above, and the same truncation: a
    // title that loses its last word is worse than a slightly smaller one.
    const [histRef, histSize] = useFitText({ min: 9, max: 12 });

    // Movements of this pool only, latest first (the ledger is already sorted).
    const movements = (savingsLedger || []).filter((t) => (t.kind === 'transaction'
        ? t.pool === pool
        : (t.source_type === 'saving' && t.source_id === pool)
            || (t.destination_type === 'saving' && t.destination_id === pool)));

    const isIncoming = (t) => (t.kind === 'transaction' ? t.type === 'deposit' : t.destination_id === pool);

    // A movement's own currency. Rows written before the column existed were
    // dollars, which is what they were.
    const potOf = (t) => t.currency || USD;

    // The rate in use for each pot, for the day or range on screen. Not an
    // average of what the pool was funded at: every other savings surface values
    // a pot at its own series rate, and a line that quotes one rate while
    // multiplying by another is worse than no line.
    const rateOf = (potCurrency) => (potCurrency === EUR ? eurRate : usdRate);

    // Backend is authoritative; fall back to netting this pool's ledger.
    const backendPool = (pools || []).find((p) => p.name === pool);
    const balanceOf = (potCurrency) => (backendPool
        ? potAmount(backendPool, potCurrency)
        : movements.reduce(
            (acc, t) => acc + (potOf(t) === potCurrency
                ? (isIncoming(t) ? 1 : -1) * parseFloat(t.amount_usd || 0)
                : 0),
            0,
        ));

    const title = (t) => (t.kind === 'transfer'
        ? (t.note || (isIncoming(t) ? 'Depósito' : 'Retiro'))
        : (t.type === 'deposit' ? 'Depósito' : 'Retiro'));

    const subtitle = (t) => (t.kind === 'transfer'
        ? `${partLabel(t.source_type, t.source_id)} → ${partLabel(t.destination_type, t.destination_id)} · ${formatDate(t.timestamp)}`
        : `${POOL_LABELS[pool] || pool} · ${formatDate(t.timestamp)}`);

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm" labelledBy="savings-pool-title">
            <div className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex items-start gap-3 mb-6">
                    <div className="bg-[#1A1A1A] p-2 rounded-xl">
                        <Icon className="text-white" size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 id="savings-pool-title" className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter leading-none">
                                Estado de Ahorros
                            </h2>
                            <button
                                type="button"
                                onClick={() => onAddMovement?.(pool)}
                                title="Depósito / Retiro"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <ArrowRightLeft size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1 dark:text-gray-400">
                            {POOL_LABELS[pool] || pool}
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-6 border border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-bold mb-2">Total en Ahorros</p>

                    {POTS.filter((pot) => balanceOf(pot) !== 0).length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 font-bold">Sin saldo en este fondo</p>
                    ) : (
                        POTS.filter((pot) => balanceOf(pot) !== 0).map((pot) => {
                            const balance = balanceOf(pot);
                            // Only the pot that is not already in the currency on
                            // screen is converted, and both sides of that
                            // conversion come from the same day.
                            const footnote = potFootnote({
                                pot,
                                displayCurrency: currency,
                                balance,
                                rate: rateOf(pot),
                                converted: convertBetween(balance, pot, currency, rates),
                            });

                            return (
                                <div key={pot} className="mb-1 last:mb-0">
                                    <p className="text-2xl font-black font-serif text-gray-900 dark:text-white tracking-tight">
                                        {currencySymbol(pot)} {fmtUsd(balance)}
                                    </p>
                                    {footnote ? (
                                        <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                            {footnote}
                                        </p>
                                    ) : null}
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="mb-4">
                    <h3
                        ref={histRef}
                        style={{ fontSize: `${histSize}px` }}
                        className="truncate whitespace-nowrap font-black uppercase tracking-widest text-gray-900 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800 pb-2"
                    >
                        Historial de Movimientos
                    </h3>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
                    {movements.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 font-bold py-6">Sin movimientos en este fondo</p>
                    ) : (
                        movements.map((t) => {
                            const incoming = isIncoming(t);
                            return (
                                <div
                                    key={`${t.kind}-${t.id}`}
                                    onClick={() => onEditMovement?.(t)}
                                    className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'p-2 rounded-lg',
                                            incoming
                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                        )}>
                                            {incoming ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm dark:text-white truncate max-w-[130px]">
                                                {title(t)}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                {subtitle(t)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={cn(
                                            'font-black text-sm',
                                            incoming ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                        )}>
                                            {incoming ? '+' : '-'} {fmtForeign(t.amount_usd, potOf(t))}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-bold">
                                            Bs {fmtBs(t.amount_bs || 0)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
}

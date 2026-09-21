import React from 'react';
import Modal from '@/Components/Modal';
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Wallet, Banknote, ArrowRightLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
 * Savings pools may work with non-official rates, so the Bs equivalent is
 * derived from the pool's own incoming movements (weighted rate) instead of
 * the BCV rate. BCV is only used as a fallback when the pool has no incoming
 * movements yet.
 */
export default function SavingsPoolSummaryModal({ show, onClose, pool, pools = [], savingsLedger = [], currentRate, onAddMovement, onEditMovement }) {
    const Icon = POOL_ICONS[pool] || Wallet;

    // Movements of this pool only, latest first (the ledger is already sorted).
    const movements = (savingsLedger || []).filter((t) => (t.kind === 'transaction'
        ? t.pool === pool
        : (t.source_type === 'saving' && t.source_id === pool)
            || (t.destination_type === 'saving' && t.destination_id === pool)));

    const isIncoming = (t) => (t.kind === 'transaction' ? t.type === 'deposit' : t.destination_id === pool);

    // Weighted rate from the incoming movements (depósitos + transferencias entrantes).
    const incoming = movements.filter(isIncoming).reduce((acc, t) => ({
        bs: acc.bs + parseFloat(t.amount_bs || 0),
        usd: acc.usd + parseFloat(t.amount_usd || 0),
    }), { bs: 0, usd: 0 });

    const derivedRate = incoming.usd > 0 ? incoming.bs / incoming.usd : 0;
    const effectiveRate = derivedRate > 0 ? derivedRate : (parseFloat(currentRate) || 0);

    // Backend is authoritative; fall back to netting this pool's ledger.
    const netUsd = movements.reduce((acc, t) => acc + (isIncoming(t) ? 1 : -1) * parseFloat(t.amount_usd || 0), 0);
    const backendBalance = (pools || []).find((p) => p.name === pool);
    const balanceUsd = backendBalance ? parseFloat(backendBalance.balance_usd || 0) : netUsd;
    const balanceBs = balanceUsd * effectiveRate;

    const title = (t) => (t.kind === 'transfer'
        ? (t.note || (isIncoming(t) ? 'Depósito' : 'Retiro'))
        : (t.type === 'deposit' ? 'Depósito' : 'Retiro'));

    const subtitle = (t) => (t.kind === 'transfer'
        ? `${partLabel(t.source_type, t.source_id)} → ${partLabel(t.destination_type, t.destination_id)} · ${formatDate(t.timestamp)}`
        : `${POOL_LABELS[pool] || pool} · ${formatDate(t.timestamp)}`);

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex items-start gap-3 mb-6">
                    <div className="bg-[#1A1A1A] p-2 rounded-xl">
                        <Icon className="text-white" size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter leading-none">
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
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                            Resumen del Mes · {POOL_LABELS[pool] || pool}
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-6 border border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-bold mb-1">Total en Ahorros</p>
                    <p className="text-3xl font-black font-serif text-gray-900 dark:text-white tracking-tight">
                        $ {balanceUsd.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mt-1">
                        Bs {balanceBs.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="mb-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2">
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
                                            {incoming ? '+' : '-'} $ {parseFloat(t.amount_usd || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-bold">
                                            Bs {parseFloat(t.amount_bs || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
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

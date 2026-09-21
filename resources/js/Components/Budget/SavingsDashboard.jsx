import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Landmark, Wallet, Banknote, History, ArrowRightLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const CAT_ICONS = {
    Digital: <Wallet size={20} className="text-violet-400" />,
    Bank: <Landmark size={20} className="text-blue-500" />,
    Physical: <Banknote size={20} className="text-green-500" />
};

const POOL_LABELS = { Digital: 'Digital', Bank: 'Banco', Physical: 'Físico' };

const partLabel = (type, id) => {
    if (type === 'cash') return 'Efectivo';
    if (type === 'external') return 'Externo';
    if (type === 'saving') return POOL_LABELS[id] || id;
    return id || 'Categoría';
};


export default function SavingsDashboard({ budget, savingsLedger = [], onAddSaving, onTransfer, onSelectPool, onEditTransfer }) {
    // Independent pool balances from the backend (transactions + transfers).
    const pools = (budget.savings_pools && budget.savings_pools.length)
        ? budget.savings_pools
        : ['Digital', 'Bank', 'Physical'].map((name) => ({ name, balance_usd: '0' }));

    // Unified, chronologically merged history (manual transactions + transfers).
    const entries = savingsLedger;

    const totalUsd = budget.total_savings_usd != null
        ? budget.total_savings_usd
        : pools.reduce((acc, p) => acc + parseFloat(p.balance_usd || 0), 0);

    const totalDisplay = parseFloat(totalUsd).toLocaleString('es-ES', { minimumFractionDigits: 2 });

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#1A1A2E] to-[#16213E] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Landmark size={120} />
                </div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <span className="text-white/80 text-sm font-medium uppercase tracking-widest">Ahorro Total</span>
                    <div className="flex gap-2">
                    <button
                        onClick={onTransfer}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-xl backdrop-blur-md transition-colors"
                        title="Depósito / Retiro"
                    >
                        <ArrowRightLeft size={20} />
                    </button>

                    </div>
                </div>

                <div className="mb-2 relative z-10">
                    <h1 className="text-5xl font-black font-serif tracking-tight">
                        $ {totalDisplay}
                    </h1>
                    <p className="text-white/70 text-sm font-bold mt-1">
                        ≈ Bs {(parseFloat(totalUsd) * parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="h-px bg-white/10 my-4 relative z-10" />

                <div className="grid grid-cols-3 gap-2 relative z-10">
                    {pools.map(({ name, balance_usd }) => (
                        <div
                            key={name}
                            onClick={() => onSelectPool?.(name)}
                            title={`Ver movimientos de ${POOL_LABELS[name] || name}`}
                            className="bg-black/20 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-black/40 active:scale-95 transition-all"
                        >
                            <div className="mb-2 bg-white/5 p-2 rounded-full">
                                {CAT_ICONS[name]}
                            </div>
                            <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider mb-1">{POOL_LABELS[name] || name}</span>
                            <span className="text-sm font-black">$ {parseFloat(balance_usd || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 transition-colors">
                <div className="flex items-center gap-2 mb-4">
                    <History size={18} className="text-gray-400" />
                    <h4 className="font-bold text-lg dark:text-white uppercase tracking-wide">
                        Historial de Movimientos
                    </h4>
                </div>

                <div className="space-y-3">
                    {entries.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 font-bold py-6">Sin movimientos registrados</p>
                    ) : (
                        entries.map((t) => t.kind === 'transfer' ? (
                            <div
                                key={`tr-${t.id}`}
                                onClick={() => onEditTransfer?.(t)}
                                className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-xl transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                        <ArrowRightLeft size={16} />
                                    </div>

                                        <div>
                                            {(() => {
                                                const isDeposit = t.source_type === 'cash';
                                                return (
                                                    <React.Fragment>
                                                        <p className="font-bold text-sm dark:text-white flex items-center gap-1">
                                                            {t.note || (isDeposit ? 'Depósito' : 'Retiro')}
                                                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 font-bold uppercase">
                                                                {isDeposit ? 'Depósito' : 'Retiro'} · {partLabel(t.source_type, t.source_id)} → {partLabel(t.destination_type, t.destination_id)}
                                                            </span>
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 font-medium">
                                                            {new Date(t.timestamp).toLocaleDateString('es-ES')} {new Date(t.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </React.Fragment>
                                                );
                                            })()}
                                        </div>

                                </div>
                                <div className="text-right">
                                    <p className="font-black text-sm text-blue-600 dark:text-blue-400">
                                        Bs {parseFloat(t.amount_bs || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-bold">
                                        $ {parseFloat(t.amount_usd || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            (() => {
                                const isDeposit = t.type === 'deposit';
                                return (
                                    <div key={t.id} className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-xl transition-colors" onClick={() => onAddSaving({ ...t, category: t.pool })}>
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                isDeposit ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                                            )}>
                                                {isDeposit ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm dark:text-white flex items-center gap-1">
                                                    {isDeposit ? 'Depósito' : 'Retiro'}
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 font-bold uppercase">{POOL_LABELS[t.pool] || t.pool}</span>
                                                </p>
                                                <p className="text-[10px] text-gray-400 font-medium">
                                                    {new Date(t.timestamp).toLocaleDateString('es-ES')} {new Date(t.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn("font-black text-sm", isDeposit ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                                {isDeposit ? '+' : '-'} $ {parseFloat(t.amount_usd).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-bold">
                                                {parseFloat(t.exchange_rate).toLocaleString('es-ES')} Bs/$
                                            </p>
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

import React from 'react';
import { Plus, ArrowDownToLine, ArrowUpFromLine, Landmark, Bitcoin, Banknote, History } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const CAT_ICONS = {
    Binance: <Bitcoin size={20} className="text-[#F3BA2F]" />,
    Bank: <Landmark size={20} className="text-blue-500" />,
    Physical: <Banknote size={20} className="text-green-500" />
};

export default function SavingsDashboard({ budget, onAddSaving }) {
    // Sort transactions latest first
    const transactions = [...(budget.savingsTransactions || [])].sort((a, b) => b.timestamp - a.timestamp);

    // Group by category to show totals
    const categoryTotals = {
        Binance: 0,
        Bank: 0,
        Physical: 0
    };

    transactions.forEach(t => {
        const val = parseFloat(t.amount_usd);
        if (t.type === 'deposit') {
            categoryTotals[t.category] += val;
        } else {
            categoryTotals[t.category] -= val;
        }
    });

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#1A1A2E] to-[#16213E] rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Landmark size={120} />
                </div>

                <div className="flex justify-between items-start mb-4 relative z-10">
                    <span className="text-white/80 text-sm font-medium uppercase tracking-widest">Ahorro Total</span>
                    <button
                        onClick={() => onAddSaving(null)}
                        className="bg-white/10 hover:bg-white/20 p-2 rounded-xl backdrop-blur-md transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="mb-2 relative z-10">
                    <h1 className="text-5xl font-black font-serif tracking-tight">
                        $ {parseFloat(budget.total_withdrawals_bs || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </h1>
                    <p className="text-white/70 text-sm font-bold mt-1">
                        ≈ Bs {(parseFloat(budget.total_withdrawals_bs || 0) * parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="h-px bg-white/10 my-4 relative z-10" />

                <div className="grid grid-cols-3 gap-2 relative z-10">
                    {Object.entries(categoryTotals).map(([cat, total]) => (
                        <div key={cat} className="bg-black/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                            <div className="mb-2 bg-white/5 p-2 rounded-full">
                                {CAT_ICONS[cat]}
                            </div>
                            <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider mb-1">{cat}</span>
                            <span className="text-sm font-black">$ {total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
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
                    {transactions.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 font-bold py-6">Sin movimientos registrados</p>
                    ) : (
                        transactions.map(t => {
                            const isDeposit = t.type === 'deposit';
                            return (
                                <div key={t.id} className="flex justify-between items-center group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded-xl transition-colors" onClick={() => onAddSaving(t)}>
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
                                                <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-gray-500 font-bold uppercase">{t.category}</span>
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                {new Date(t.timestamp).toLocaleDateString('es-ES')} {new Date(t.timestamp).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
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
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    );
}

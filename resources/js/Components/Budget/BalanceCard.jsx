import React from 'react';
import { RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function BalanceCard({ budget, contextRate, onEdit }) {
    const balanceUsd = budget.income_rate > 0
        ? (parseFloat(budget.opening_balance_bs) + parseFloat(budget.income_bs) - calculateCashExpenses(budget)) / parseFloat(contextRate)
        : 0;

    const balanceBs = parseFloat(budget.opening_balance_bs) + parseFloat(budget.income_bs) - calculateCashExpenses(budget);

    return (
        <div className="bg-[#FF8A3D] dark:bg-[#9B7BFF] rounded-2xl p-4 text-white shadow-lg transition-colors">
            <div className="flex justify-between items-start mb-2">
                <span className="text-white/80 text-sm font-medium">Saldo disponible</span>
                <div className="flex items-center gap-2">
                    <span className="text-white/80 text-xs font-medium">{parseFloat(contextRate).toLocaleString('es-ES')} Bs/USD</span>
                    <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="mb-1">
                <h1 className="text-4xl font-black font-serif tracking-tight">
                    $ {balanceUsd.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumLines: 2 })}
                </h1>
                <p className="text-white/90 text-xl font-bold">
                    Bs {balanceBs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumLines: 2 })}
                </p>
            </div>

            <div className="h-px bg-white/20 my-3" />

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Ingresos</span>
                    <p className="text-sm font-bold">Bs {parseFloat(budget.income_bs).toLocaleString('es-ES')}</p>
                </div>
                <div className="text-right">
                    <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Gastos de caja</span>
                    <p className="text-sm font-bold">Bs {calculateCashExpenses(budget).toLocaleString('es-ES')}</p>
                </div>
            </div>

            <button
                onClick={onEdit}
                className="w-full py-2 px-4 border border-white/40 hover:bg-white/10 rounded-xl text-sm font-bold transition-all"
            >
                Ingresos
            </button>
        </div>
    );
}

function calculateCashExpenses(budget) {
    return budget.expenses
        .filter(e => budget.categories.find(c => c.name === e.category_name)?.cash_expense)
        .reduce((sum, e) => sum + parseFloat(e.amount_bs), 0);
}

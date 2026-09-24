import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useForm } from '@inertiajs/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fmtBs, fmtUsd } from '@/lib/money';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function BalanceCard({ budget, contextRate, rate = null, dateFilter = null, onEdit }) {
    const { post, processing } = useForm();

 const cashExpenses = calculateCashExpenses(budget, dateFilter);

    // Aligned with the server: without a date filter use the official
    // available_balance_bs (includes debt payments, deposits, withdrawals
    // and transfers). With a date filter, keep the day-snapshot calculation
    // (opening + income - cash up to that date).
    const balanceBs = dateFilter
        ? parseFloat(budget.opening_balance_bs) + parseFloat(budget.income_bs) - cashExpenses
        : parseFloat(budget.available_balance_bs);

    const balanceUsd = parseFloat(contextRate) > 0
        ? balanceBs / parseFloat(contextRate)
        : 0;

    const refreshRate = () => {
        post(route('exchange-rate.refresh'), { preserveScroll: true });
    };

    return (
        <div className="bg-[#FF8A3D] dark:bg-[#9B7BFF] rounded-2xl p-4 text-white shadow-lg transition-colors">
            <div className="flex justify-between items-start mb-2">
                <span className="text-white/80 text-sm font-medium">Saldo Disponible</span>
                <div className="flex items-center gap-2">
                    <span className="text-white/80 text-xs font-medium tabular">{parseFloat(budget.income_rate || 0).toLocaleString('es-ES')} Bs/USD</span>
                    {rate?.error && (
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-300" title={`Error BCV: ${rate.error}`} />
                    )}
                    <button
                        onClick={refreshRate}
                        disabled={processing}
                        title="Actualizar tasa BCV"
                        className="p-1 hover:bg-white/10 rounded-full transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={cn(processing && 'animate-spin')} />
                    </button>
                </div>
            </div>

            <div className="mb-1">
                <h1 className="text-4xl font-black font-serif tracking-tight tabular">
                    $ {fmtUsd(balanceUsd)}
                </h1>
                <p className="text-white/90 text-xl font-bold tabular">
                    Bs {fmtBs(balanceBs)}
                </p>
            </div>

            <div className="h-px bg-white/20 my-3" />

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Ingresos</span>
                    <p className="text-sm font-bold tabular">Bs {fmtBs(budget.income_bs)}</p>
                </div>
                <div className="text-right">
                    <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Gastos</span>
                    <p className="text-sm font-bold tabular">Bs {fmtBs(calculateCashExpenses(budget))}</p>
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

function calculateCashExpenses(budget, dateFilter = null) {
    const cutoff = dateFilter
        ? new Date(`${dateFilter}T23:59:59`).getTime()
        : Infinity;

    return budget.expenses
        .filter((e) => {
            const category = budget.categories.find((c) => c.name === e.category_name);
            return category?.cash_expense && !category?.is_presupuesto && e.timestamp <= cutoff;
        })
        .reduce((sum, e) => sum + parseFloat(e.amount_bs), 0);
}

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useForm } from '@inertiajs/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fmtBs, fmtUsd } from '@/lib/money';
import { calculateCashExpenses } from '@/lib/budgetExpenses';

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

    const effectiveRate = dateFilter
        ? Number(contextRate)
        : Number(budget.income_rate);

    const balanceUsd = effectiveRate > 0
        ? balanceBs / effectiveRate
        : 0;

    const refreshRate = () => {
        post(route('exchange-rate.refresh'), { preserveScroll: true });
    };

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A2E] to-[#16213E] p-5 text-white shadow-xl">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/5" />
            <div className="absolute -right-2 top-16 h-20 w-20 rounded-full bg-white/5" />

            <div className="relative z-10 mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className="block truncate whitespace-nowrap text-sm font-medium uppercase tracking-widest text-white/80">
                        Saldo Disponible
                    </span>
                    <span className="mt-1 block truncate whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-white/45">
                        Para usar en gastos y deudas
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                    <span className="whitespace-nowrap rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold tracking-wide text-white/70 tabular">
                        {fmtBs(effectiveRate)} Bs/USD
                    </span>
                    {rate?.error && (
                        <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300"
                            title={`Error BCV: ${rate.error}`}
                            aria-label={`Error BCV: ${rate.error}`}
                        />
                    )}
                    <button
                        type="button"
                        onClick={refreshRate}
                        disabled={processing}
                        title="Actualizar tasa BCV"
                        aria-label="Actualizar tasa BCV"
                        className="touch-feedback rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={cn(processing && 'animate-spin')} aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="relative z-10 mb-3">
                <h1 className="truncate whitespace-nowrap text-4xl font-black font-serif tracking-tight tabular sm:text-5xl">
                    Bs {fmtBs(balanceBs)}
                </h1>
                <p className="mt-1 truncate whitespace-nowrap text-base font-bold text-white/75 tabular sm:text-lg">
                    ≈ $ {fmtUsd(balanceUsd)}
                </p>
            </div>

            <div className="relative z-10 mb-4 h-px bg-white/10" />

            <div className="relative z-10 grid grid-cols-2 gap-4">
                <div className="min-w-0">
                    <span className="block truncate whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-white/50">
                        Ingresos
                    </span>
                    <p className="mt-1 truncate whitespace-nowrap text-sm font-bold tabular">
                        Bs {fmtBs(budget.income_bs)}
                    </p>
                </div>
                <div className="min-w-0 text-right">
                    <span className="block truncate whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-white/50">
                        Gastos
                    </span>
                    <p className="mt-1 truncate whitespace-nowrap text-sm font-bold tabular">
                        Bs {fmtBs(cashExpenses)}
                    </p>
                </div>
            </div>

            <button
                type="button"
                onClick={onEdit}
                className="touch-feedback relative z-10 mt-4 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/15"
            >
                Editar ingresos
            </button>
        </div>
    );
}
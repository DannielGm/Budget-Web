import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useForm } from '@inertiajs/react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fmtBs, fmtUsd } from '@/lib/money';
import { scopeMonth, heroBalance } from '@/lib/scopedMoney';
import { useFigure, useRateLabel } from '@/hooks/useFigure';
import useFitText from '@/hooks/useFitText';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function BalanceCard({
    budget,
    contextRate,
    rate = null,
    dateFilter = null,
    rangeDays = 30,
    savingsLedger = [],
    onEdit,
}) {
    const { post, processing } = useForm();

    // scopeMonth is the single definition of the balance for the active range.
    // This card used to compute `opening + income - cash` on its own for a day,
    // which ignored credit purchases, debt payments, savings and transfers and
    // so overstated the day. With no filter it returns the server's figure.
    const scoped = scopeMonth(budget, { savingsLedger, dateFilter, rangeDays });
    const balanceBs = heroBalance(budget, { savingsLedger, dateFilter, rangeDays });

    // The equivalent follows the display currency and the range's rate. Passing
    // the balance in, rather than dividing here, keeps this card from owning a
    // second rate rule.
    const { formatted: balanceForeign, rate: displayRate } = useFigure({ amountBs: balanceBs });
    const rateLabel = useRateLabel();

    // Preferred size matches SavingsDashboard (text-5xl = 48px) and
    // RateHistoryDashboard (text-4xl). The fit search only pulls the
    // number down when the value would actually overflow.
    const [bsRef, bsSize, bsClipped] = useFitText({ min: 30, max: 48, emergencyMin: 22 });
    const [usdRef, usdSize] = useFitText({ min: 12, max: 20 });

    const refreshRate = () => {
        post(route('exchange-rate.refresh'), { preserveScroll: true });
    };

    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A1A2E] to-[#16213E] px-4 py-5 text-white shadow-xl">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/5" />
            <div className="absolute -right-2 top-16 h-20 w-20 rounded-full bg-white/5" />

            <div className="relative z-10 mb-3">
                <div className="min-w-0">
                    <span className="block text-sm font-medium uppercase tracking-widest text-white/80">
                        Saldo Disponible
                    </span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-white/45">
                        Para usar en gastos y deudas
                    </span>
                </div>
            </div>

            <div className="relative z-10 mb-4">
                <h1
                    ref={bsRef}
                    style={{ fontSize: `${bsSize}px` }}
                    className="whitespace-nowrap text-5xl font-black font-serif tracking-tight tabular text-white"
                >
                    Bs {fmtBs(balanceBs)}
                </h1>
                <div className="mt-3 flex items-center justify-between gap-3">
                    <p
                        ref={usdRef}
                        style={{ fontSize: `${usdSize}px` }}
                        className="min-w-0 whitespace-nowrap font-bold leading-tight text-white/75 tabular"
                    >
                        ≈ {balanceForeign}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <span className="whitespace-nowrap rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold tracking-wide text-white/70 tabular">
                            {fmtBs(displayRate)} {rateLabel}
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
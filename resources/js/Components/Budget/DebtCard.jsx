import React from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { fmtBs, fmtUsd, fmtPct } from '@/lib/money';
import { calculateDebt, unassignedCreditPurchases, n } from '@/lib/debtMath';

const progressClass = (value) => value >= 100 ? 'bg-emerald-500' : value > 0 ? 'bg-amber-400' : 'bg-white/15';

export default function DebtCard({ debts = [], totalDebtBs, creditPurchasesBs = 0, rate, onOpenSummary, onAdd, onEdit }) {
    const calculated = debts.map((debt) => ({ debt, ...calculateDebt(debt, rate) }));
    const unassignedCreditBs = unassignedCreditPurchases(debts, creditPurchasesBs);
    const totalPaidBs = calculated.reduce((sum, item) => sum + item.paidBs, 0);
    const totalOriginalBs = Math.max(0, n(totalDebtBs) + totalPaidBs);
    const paidPercentage = totalOriginalBs > 0 ? Math.min(100, (totalPaidBs / totalOriginalBs) * 100) : 0;
    const remainingUsd = n(rate) > 0 ? n(totalDebtBs) / n(rate) : 0;
    const creditUsd = n(rate) > 0 ? unassignedCreditBs / n(rate) : 0;

    return (
        <section className="relative overflow-hidden rounded-2xl bg-[#1A1A1A] p-4 text-white shadow-lg" aria-labelledby="debt-card-title">
            <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={onOpenSummary} className="touch-feedback flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left" aria-label="Abrir resumen completo de deudas">
                    <CreditCard size={18} className="shrink-0 text-gray-400" />
                    <h2 id="debt-card-title" className="truncate text-sm font-bold uppercase tracking-widest text-gray-300">Estado de Deuda</h2>
                </button>
                <button type="button" onClick={onAdd} aria-label="Añadir deuda" className="touch-feedback flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"><Plus size={20} /></button>
            </div>

            <button type="button" onClick={onOpenSummary} className="touch-feedback mt-1 block w-full rounded-lg text-left" aria-label="Abrir resumen completo de deudas">
                <p className="whitespace-nowrap text-3xl font-black font-serif tracking-tight tabular">Bs {fmtBs(totalDebtBs)}</p>
                <p className="mt-1 whitespace-nowrap text-xs font-bold tabular text-gray-400">≈ $ {fmtUsd(remainingUsd)}</p>
            </button>

            {totalOriginalBs > 0 && (
                <div className="mt-4 rounded-xl bg-white/5 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider"><span className="text-gray-400">Progreso pagado</span><span className="tabular text-white">{fmtPct(paidPercentage, 0)}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Progreso de pagos de deuda" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(paidPercentage)}><div className={`h-full rounded-full transition-[width] duration-300 ${progressClass(paidPercentage)}`} style={{ width: `${paidPercentage}%` }} /></div>
                    <p className="mt-2 whitespace-nowrap text-[10px] font-bold tabular text-emerald-400">{fmtPct(paidPercentage, 0)}% pagado - Bs {fmtBs(totalPaidBs)}</p>
                </div>
            )}

            <div className="mt-4 space-y-2" role="list" aria-label="Cuentas de deuda">

                {unassignedCreditBs > 0 && (
                    <div role="listitem" className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                        <span className="min-w-0 truncate text-xs font-semibold text-gray-300">Compras a crédito sin asignar</span>
                        <span className="shrink-0 whitespace-nowrap text-right text-xs font-bold tabular">Bs {fmtBs(unassignedCreditBs)} <span className="block text-[10px] text-gray-400">≈ $ {fmtUsd(creditUsd)}</span></span>
                    </div>
                )}

                {calculated.map(({ debt, remainingBs, remainingUsd: rowUsd, paidPercentage: rowPaid, paidBs, currentChargesBs }) => (
                    <button type="button" role="listitem" key={debt.id} onClick={() => onEdit(debt)} className="touch-feedback flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5 text-left hover:bg-white/10" aria-label={`Administrar deuda ${debt.label}`}>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-200">{debt.label}</span>
                        <span className="min-w-0 shrink-0 text-right">
                            <span className="block whitespace-nowrap text-sm font-bold tabular">Bs {fmtBs(remainingBs)}</span>
                            <span className="block whitespace-nowrap text-[10px] tabular text-gray-400">≈ $ {fmtUsd(rowUsd)}</span>
                            {paidBs > 0 && <span className="block whitespace-nowrap text-[10px] font-bold tabular text-emerald-400">{fmtPct(rowPaid, 0)}% pagado - Bs {fmtBs(paidBs)}</span>}
                            {currentChargesBs > 0 && <span className="block whitespace-nowrap text-[10px] font-bold tabular text-red-400">Nuevos cargos · Bs {fmtBs(currentChargesBs)}</span>}
                        </span>
                    </button>
                ))}

                {debts.length === 0 && unassignedCreditBs <= 0 && (
                    <div className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center">
                        <p className="text-sm font-bold text-gray-300">Sin deudas registradas</p>
                        <p className="mt-1 text-xs text-gray-500">Añade una cuenta para comenzar su seguimiento.</p>
                    </div>
                )}
            </div>
        </section>
    );
}

import React from 'react';
import Modal from '@/Components/Modal';
import { CreditCard, ArrowDownToLine } from 'lucide-react';
import { fmtBs, fmtUsd, fmtPct } from '@/lib/money';
import { calculateDebt, unassignedCreditPurchases, n } from '@/lib/debtMath';
import useFitText from '@/hooks/useFitText';
import { useCurrencySymbol, useBolivarFigure } from '@/hooks/useFigure';

const dateLabel = (timestamp) => new Date(Number(timestamp)).toLocaleDateString('es-ES');

/** A debt name that shrinks to fit instead of being clipped, like the card row. */
function SummaryName({ label }) {
    const [ref, fontSize] = useFitText({ min: 10, max: 14 });

    return (
        <span ref={ref} style={{ fontSize }} className="block font-bold text-gray-800 dark:text-gray-100">
            {label}
        </span>
    );
}
export default function DebtSummaryModal({
    show,
    onClose,
    debts = [],
    currentRate,
    creditPurchasesBs = 0,
    totalDebtBs: authoritativeTotalBs,
}) {
    const accounts = debts.map((debt) => ({ debt, ...calculateDebt(debt, currentRate) }));
    const payments = accounts.flatMap(({ debt, payments: rows }) => rows.map((payment) => ({ ...payment, debtLabel: debt.label })))
        .sort((a, b) => n(b.timestamp) - n(a.timestamp));
    const unassignedCreditBs = unassignedCreditPurchases(creditPurchasesBs);
    const totalPaidBs = accounts.reduce((sum, item) => sum + item.paidBs, 0);
    const totalRemainingBs = n(authoritativeTotalBs ?? accounts.reduce((sum, item) => sum + item.remainingBs, 0) + unassignedCreditBs);
    const totalBeforePayments = Math.max(0, totalRemainingBs + totalPaidBs);
    const paidPercentage = totalBeforePayments > 0 ? Math.min(100, totalPaidBs / totalBeforePayments * 100) : 0;
    const remainingUsd = n(currentRate) > 0 ? totalRemainingBs / n(currentRate) : 0;
    const creditUsd = n(currentRate) > 0 ? unassignedCreditBs / n(currentRate) : 0;

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm" labelledBy="debt-summary-title">
            <div className="max-h-[88dvh] overflow-y-auto bg-white p-5 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1A1A1A]"><CreditCard size={22} className="text-white" /></div>
                    <div><h2 id="debt-summary-title" className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">Estado de Deuda</h2><p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Resumen del mes</p></div>
                </div>

                <section className="mt-5 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60" aria-labelledby="debt-total-label">
                    <p id="debt-total-label" className="text-sm font-bold text-gray-500 dark:text-gray-400">Total pendiente</p>
                    <p className="mt-1 whitespace-nowrap text-3xl font-black font-serif tracking-tight tabular text-gray-900 dark:text-white">Bs {fmtBs(totalRemainingBs)}</p>
                    <p className="mt-1 text-xs font-bold tabular text-[#FF8A3D] dark:text-[#9B7BFF]">≈ {fmtUsd(remainingUsd)}</p>
                    <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"><span>Progreso pagado</span><span className="tabular">{fmtPct(paidPercentage, 0)}%</span></div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-label="Progreso pagado de deuda" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(paidPercentage)}><div className={`h-full rounded-full ${paidPercentage >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${paidPercentage}%` }} /></div>
                    <p className="mt-2 text-xs font-bold tabular text-emerald-600 dark:text-emerald-400">{fmtPct(paidPercentage, 0)}% pagado - Bs {fmtBs(totalPaidBs)}</p>
                </section>

                <section className="mt-6" aria-labelledby="debt-accounts-title">
                    <h3 id="debt-accounts-title" className="border-b border-gray-100 pb-2 text-xs font-black uppercase tracking-widest text-gray-400 dark:border-gray-800">Cuentas</h3>
                    <div className="mt-3 space-y-2">
                        {unassignedCreditBs > 0 && <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800"><p className="text-sm font-bold text-gray-800 dark:text-gray-100">Compras a crédito sin asignar</p><p className="mt-1 whitespace-nowrap text-sm font-black tabular text-gray-900 dark:text-white">Bs {fmtBs(unassignedCreditBs)}</p><p className="text-[10px] font-bold tabular text-gray-500 dark:text-gray-400">≈ {fmtUsd(creditUsd)}</p></div>}
                        {accounts.map(({ debt, openingBs, currentChargesBs, totalBs, paidBs, remainingBs, remainingUsd: accountUsd, paidPercentage: accountPaid }) => <div key={debt.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><SummaryName label={debt.label} /><p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">Original Bs {fmtBs(openingBs)}{currentChargesBs > 0 ? ` · Nuevos cargos Bs ${fmtBs(currentChargesBs)}` : ''}</p></div><div className="shrink-0 text-right"><p className="whitespace-nowrap text-sm font-black tabular text-gray-900 dark:text-white">Bs {fmtBs(remainingBs)}</p><p className="whitespace-nowrap text-[10px] font-bold tabular text-gray-400">≈ {fmtUsd(accountUsd)}</p></div></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-full rounded-full ${accountPaid >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${accountPaid}%` }} /></div><p className="mt-1.5 text-[10px] font-bold tabular text-gray-500 dark:text-gray-400">{fmtPct(accountPaid, 0)}% pagado - Bs {fmtBs(paidBs)} <span className="text-gray-600 dark:text-gray-500">de Bs {fmtBs(totalBs)}</span></p></div>)}
                        {accounts.length === 0 && unassignedCreditBs <= 0 && <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 dark:border-gray-700">Sin deudas registradas</p>}
                    </div>
                </section>


                <section className="mt-6" aria-labelledby="debt-payments-title">
                    <h3 id="debt-payments-title" className="border-b border-gray-100 pb-2 text-xs font-black uppercase tracking-widest text-gray-400 dark:border-gray-800">Historial de pagos</h3>
                    <div className="mt-3 space-y-2">
                        {payments.length ? payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800"><div className="flex min-w-0 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"><ArrowDownToLine size={16} /></div><div className="min-w-0"><SummaryName label={payment.debtLabel} /><p className="text-[10px] text-gray-500 dark:text-gray-400">{payment.method} · {dateLabel(payment.timestamp)}</p></div></div><div className="shrink-0 text-right"><p className="whitespace-nowrap text-sm font-black tabular text-emerald-600 dark:text-emerald-400">− Bs {fmtBs(payment.amount_bs)}</p><p className="whitespace-nowrap text-[10px] font-bold tabular text-gray-500 dark:text-gray-400">≈ {fmtUsd(n(currentRate) > 0 ? n(payment.amount_bs) / n(currentRate) : 0)}</p></div></div>) : <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 dark:border-gray-700">Sin pagos registrados</p>}
                    </div>
                </section>

                <div className="mt-6 flex justify-end"><button type="button" onClick={onClose} className="touch-feedback min-h-11 rounded-xl px-4 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-100">Cerrar</button></div>
            </div>
        </Modal>
    );
}

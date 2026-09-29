import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { useCurrencySymbol, useBolivarFigure, useRateLabel } from '@/hooks/useFigure';
import { ChevronRight, Plus, Receipt, Trash2 } from 'lucide-react';
import { fmtBs, fmtRate, fmtUsd } from '@/lib/money';

/** Carries the shared layout id only while this form is open, so the id is
 *  never held by two elements at once. */
function AddTrigger({ layoutId, children }) {
    if (!layoutId) return children;
    return <motion.div layoutId={layoutId} className="shrink-0">{children}</motion.div>;
}

const typeMeta = (c) => c?.is_presupuesto
    ? { label: 'Presupuesto', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300', impact: 'Solo seguimiento del presupuesto' }
    : c?.cash_expense
        ? { label: 'Contado', badge: 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300', impact: 'Reduce el saldo disponible' }
        : { label: 'Crédito', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300', impact: 'Suma a compras a crédito' };

export default forwardRef(function ExpenseCard({ category, expenses, selectedRate, isBudgetOk, dateFilter, onSelectCategory, onAdd, onEdit, onDelete, layoutId = null }, ref) {
    const meta = typeMeta(category);
    const totalBs = expenses.reduce((sum, e) => sum + (Number(e.amount_bs) || 0), 0);
    const selectedRateValue = Number(selectedRate) || 0;
    const symbol = useCurrencySymbol();
    const rateLabel = useRateLabel();
    const foreign = useBolivarFigure();
    const totalUsd = foreign(totalBs, selectedRateValue);

    return (
        <section ref={ref} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900" aria-labelledby="expense-category-title">
            <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={onSelectCategory} className="touch-feedback min-w-0 flex-1 rounded-lg text-left" title="Cambiar categoría">
                    <div className="flex items-center gap-2"><h3 id="expense-category-title" className="truncate text-lg font-bold uppercase tracking-wide text-gray-900 dark:text-white">{category?.name || 'Categoría'}</h3><ChevronRight size={16} className="shrink-0 text-gray-400" /></div>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${meta.badge}`}>{meta.label}</span><span className="text-[10px] font-medium text-gray-400">{meta.impact}</span></div>
                </button>
                <AddTrigger layoutId={layoutId}>
                        <button type="button" onClick={onAdd} aria-label={`Añadir gasto en ${category?.name || 'categoría'}`} className="touch-feedback flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FF8A3D] text-white shadow-sm dark:bg-[#9B7BFF]"><Plus size={20} /></button>
                    </AddTrigger>
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Total de la categoría</p>
                <p className={`mt-1 truncate text-xl font-black font-serif tabular ${category?.is_presupuesto ? (isBudgetOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-gray-900 dark:text-white'}`}>Bs {fmtBs(totalBs)}</p>
                <p className="mt-0.5 text-xs font-bold tabular text-gray-400">≈ {symbol} {fmtUsd(totalUsd)} <span className="font-medium">· @ {fmtRate(selectedRateValue)} {rateLabel} · {expenses.length} {expenses.length === 1 ? 'movimiento' : 'movimientos'}</span></p>
            </div>

            <div className="mt-4 space-y-2" role="list" aria-label={`Gastos de ${category?.name || 'categoría'}`}>
                {expenses.length === 0 ? <div className="flex flex-col items-center py-7 text-center"><Receipt size={28} className="text-gray-300 dark:text-gray-600" /><p className="mt-2 text-sm font-bold text-gray-500 dark:text-gray-300">Sin gastos {dateFilter ? 'en esta fecha' : 'todavía'}</p><p className="mt-1 text-xs text-gray-400">Añade el primer movimiento de esta categoría.</p></div> : expenses.map((expense) => {
                    const rate = Number(expense.rate) || selectedRateValue || 0;
                    const usd = rate > 0 ? (Number(expense.amount_bs) || 0) / rate : 0;
                    const date = new Date(expense.timestamp);
                    return <div key={expense.id} role="listitem" className="flex items-center gap-2 rounded-xl border border-transparent transition-colors hover:border-gray-100 hover:bg-gray-50/70 dark:hover:border-gray-800 dark:hover:bg-gray-800/50">
                        <button type="button" onClick={() => onEdit(expense)} className="touch-feedback min-w-0 flex-1 rounded-xl px-2 py-2 text-left" aria-label={`Editar gasto ${expense.label}`}>
                            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{expense.label}</p><p className="mt-0.5 text-[10px] font-medium text-gray-400">{date.toLocaleDateString('es-ES')} · {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p></div><div className="shrink-0 text-right"><p className="whitespace-nowrap text-sm font-black tabular text-gray-900 dark:text-white">Bs {fmtBs(expense.amount_bs)}</p><p className="mt-0.5 whitespace-nowrap text-[10px] font-bold tabular text-gray-400">≈ {symbol} {fmtUsd(foreign(expense.amount_bs, rate))} <span className="font-medium">@ {fmtRate(rate)}</span></p></div></div>
                        </button>
                        <button type="button" onClick={() => onDelete(expense)} title={`Eliminar ${expense.label}`} aria-label={`Eliminar gasto ${expense.label}`} className="touch-feedback flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash2 size={16} /></button>
                    </div>;
                })}
            </div>
        </section>
    );
});
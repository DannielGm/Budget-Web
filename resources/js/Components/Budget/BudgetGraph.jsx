import React, { useMemo, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildGraphSeries } from './graph/buildGraphSeries';
import { fmtBs, fmtUsd } from '@/lib/money';

const METRICS = [{ id: 'available', label: 'Saldo' }, { id: 'expenses', label: 'Gastos' }, { id: 'savings', label: 'Ahorro' }];
const compactAxis = (value) => {
    const amount = Math.abs(Number(value) || 0), sign = value < 0 ? '-' : '';
    if (amount >= 1000000) return `${sign}${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${sign}${(amount / 1000).toFixed(amount >= 100000 ? 0 : 1)}k`;
    return `${sign}${Math.round(amount)}`;
};

function Detail({ point, metric }) {
    if (!point) return null;
    const dataKey = metric === 'expenses' ? 'cashExpenses' : metric;
    const changeKey = metric === 'expenses' ? 'expenseChange' : `${metric}Change`;
    const value = point[dataKey] ?? 0, dailyChange = point[changeKey] ?? 0;
    return (
        <div className="mb-3 flex min-w-0 items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/70" aria-live="polite">
            <div className="min-w-0"><p className="truncate text-[10px] font-bold uppercase tracking-wider text-gray-400">{point.label}</p><p className="mt-0.5 truncate text-xs font-bold text-gray-700 dark:text-gray-200">{point.events.length || 'Sin movimientos'}</p></div>
            <div className="shrink-0 text-right tabular"><p className="text-sm font-black text-gray-900 dark:text-white">{metric === 'savings' ? `$${fmtUsd(value)}` : `Bs ${fmtBs(value)}`}</p><p className={`text-[10px] font-bold ${dailyChange < 0 ? 'text-red-500' : dailyChange > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>{dailyChange ? `${dailyChange > 0 ? '+' : ''}${metric === 'savings' ? `$${fmtUsd(dailyChange)}` : `Bs ${fmtBs(dailyChange)}`}` : 'Sin cambio'}</p></div>
        </div>
    );
}

export default function BudgetGraph({ budget, categories, rangeMode, dateFilter, today, savingsLedger }) {
    const [metric, setMetric] = useState('available');
    const [activeIndex, setActiveIndex] = useState(null);
    const series = useMemo(() => buildGraphSeries({ budget, categories: categories || budget.categories, rangeMode, dateFilter, today, savingsLedger }), [budget, categories, rangeMode, dateFilter, today, savingsLedger]);
    const points = series.points, value = series.metrics[metric], periodChange = series.periodChange[metric];
    const isUsd = metric === 'savings', rate = Number(budget.income_rate) || 0;
    const colors = metric === 'available' ? { stroke: '#FF8A3D' } : metric === 'expenses' ? { stroke: '#EF4444' } : { stroke: '#10B981' };
    const title = metric === 'available' ? 'Saldo disponible' : metric === 'expenses' ? 'Gastos acumulados' : 'Ahorro del mes';
    const changeText = periodChange ? `${periodChange > 0 ? '+' : ''}${isUsd ? `$${fmtUsd(periodChange)}` : `Bs ${fmtBs(periodChange)}`}` : 'Sin cambios en el período';
    const activePoint = activeIndex === null ? null : points[Math.max(0, Math.min(activeIndex, points.length - 1))];
    const selectFromChart = (state) => { if (state?.activeLabel) { const index = points.findIndex((point) => point.key === state.activeLabel); if (index >= 0) setActiveIndex(index); } };
    const move = (direction) => setActiveIndex((index) => Math.max(0, Math.min(points.length - 1, (index ?? points.length - 1) + direction)));
    const isAffordable = Number(budget.available_balance_bs || 0) >= series.planned;
    const health = isAffordable ? 'Presupuesto cubierto' : 'Presupuesto excedido';
    const healthStyles = isAffordable ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20' : 'bg-red-50 text-red-600 dark:bg-red-900/20';
    const maxExpense = Math.max(0, ...points.map((point) => Number(point.cashExpenses) || 0));
    const expenseDomainMax = Math.max(series.planned, maxExpense, 1) * 1.1;
    const showChart = series.hasEvents || (metric === 'expenses' && series.planned > 0);

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900" aria-label="Flujo financiero del mes">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p><p className="mt-1 truncate whitespace-nowrap text-2xl font-black font-serif tabular text-gray-900 dark:text-white">{isUsd ? `$${fmtUsd(value)}` : `Bs ${fmtBs(value)}`}</p>{!isUsd && <p className="text-[10px] font-bold tabular text-gray-400">≈ ${fmtUsd(rate > 0 ? value / rate : 0)}</p>}</div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${healthStyles}`}>{health}</span>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800" role="tablist" aria-label="Métrica del gráfico">
                {METRICS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={metric === item.id} onClick={() => { setMetric(item.id); setActiveIndex(null); }} className={`min-h-10 rounded-lg text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF8A3D] dark:focus-visible:outline-[#9B7BFF] ${metric === item.id ? 'bg-white text-[#FF8A3D] shadow-sm dark:bg-gray-700 dark:text-[#9B7BFF]' : 'text-gray-500 dark:text-gray-400'}`}>{item.label}</button>)}
            </div>
            {showChart ? <>
                <Detail point={activePoint || points.at(-1)} metric={metric} />
                <div className="h-[190px] w-full touch-pan-y select-none" role="img" aria-label={`${title}. ${isUsd ? `$${fmtUsd(value)}` : `Bs ${fmtBs(value)}`}. Desliza para inspeccionar cada día.`} tabIndex={0} onKeyDown={(event) => { if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); } if (event.key === 'ArrowRight') { event.preventDefault(); move(1); } if (event.key === 'Escape') setActiveIndex(null); }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={points} margin={{ top: 8, right: 6, left: 0, bottom: 0 }} onMouseMove={selectFromChart} onTouchMove={selectFromChart}>
                            <XAxis dataKey="key" hide />
                            <YAxis domain={metric === 'expenses' ? [0, expenseDomainMax] : ['auto', 'auto']} tickFormatter={compactAxis} width={34} tick={{ fontSize: 9, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                            <Tooltip content={() => null} cursor={{ stroke: '#9CA3AF', strokeDasharray: '3 3' }} />
                            {metric === 'expenses' && series.planned > 0 && <ReferenceLine y={series.planned} stroke={isAffordable ? '#10B981' : '#EF4444'} strokeDasharray="4 4" label={{ value: `Plan Bs ${fmtBs(series.planned, 0)}`, position: 'insideTopRight', fill: isAffordable ? '#10B981' : '#EF4444', fontSize: 9, fontWeight: 700 }} />}
                            <Line type="monotone" dataKey={metric === 'expenses' ? 'cashExpenses' : metric} stroke={colors.stroke} strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: colors.stroke }} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] font-bold tabular text-gray-400"><span>{points[0]?.label}</span><span className="truncate text-gray-500">{changeText}</span><span className="shrink-0">{points.at(-1)?.label}</span></div>
            </> : <div className="flex h-[220px] flex-col items-center justify-center text-center"><p className="text-sm font-bold text-gray-600 dark:text-gray-300">Aún no hay movimientos</p><p className="mt-1 text-xs text-gray-400">Tu flujo aparecerá aquí conforme lo registres.</p></div>}
            {metric === 'expenses' && series.planned > 0 && (() => {
                const availableAmount = Number(budget.available_balance_bs) || 0;
                const rawCoveragePercent = availableAmount > 0
                    ? (series.planned / availableAmount) * 100
                    : Infinity;
                const coveragePercent = Math.min(100, Number.isFinite(rawCoveragePercent)
                    ? rawCoveragePercent
                    : 100);
                const isOver = !isAffordable;
                return (
                    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/60">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Seguimiento del presupuesto</p>
                            <span className={`text-[10px] font-black ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>{rawCoveragePercent.toFixed(0)}% del disponible</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Plan</p><p className="mt-1 truncate text-xs font-black tabular text-gray-800 dark:text-gray-100">Bs {fmtBs(series.planned, 0)}</p></div>
                            <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Disponible</p><p className="mt-1 truncate text-xs font-black tabular text-gray-800 dark:text-gray-100">Bs {fmtBs(series.spent, 0)}</p></div>
                            <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">Restante</p><p className={`mt-1 truncate text-xs font-black tabular ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>Bs {fmtBs(series.remaining, 0)}</p></div>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" aria-label="Plan requerido respecto al saldo disponible" aria-valuemin="0" aria-valuemax="100" aria-valuenow={coveragePercent}><div className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(0, coveragePercent)}%` }} /></div>
                    </div>
                );
            })()}
        </section>
    );
}


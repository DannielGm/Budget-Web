import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';

export default function BudgetGraph({ budget, categories }) {
    const visible = categories ?? budget.categories;
    const visibleNames = new Set(visible.map((c) => c.name));

    const data = useMemo(() => {
        const filtered = budget.expenses.filter((e) => visibleNames.has(e.category_name));
        const sortedExpenses = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
        let currentAvailable = parseFloat(budget.opening_balance_bs) + parseFloat(budget.income_bs);
        let cumulativeExpenses = 0;
        let cumulativeSavings = 0;

        const points = [{
            time: 'Inicio',
            available: currentAvailable,
            expenses: cumulativeExpenses,
            savings: cumulativeSavings,
            displayTime: ''
        }];

        // We also need to interleave savings transactions in chronological order
        const allTransactions = [
            ...sortedExpenses.map(e => ({...e, isSaving: false})),
            ...(budget.savingsTransactions || []).map(s => ({...s, isSaving: true}))
        ].sort((a, b) => a.timestamp - b.timestamp);

        allTransactions.forEach(tx => {
            if (tx.isSaving) {
                if (tx.type === 'deposit') {
                    currentAvailable -= parseFloat(tx.amount_bs);
                    cumulativeSavings += parseFloat(tx.amount_usd);
                } else {
                    currentAvailable += parseFloat(tx.amount_bs);
                    cumulativeSavings -= parseFloat(tx.amount_usd);
                }
            } else {
                const category = budget.categories.find(c => c.name === tx.category_name);
                if (category?.cash_expense && !category?.is_presupuesto) {
                    currentAvailable -= parseFloat(tx.amount_bs);
                    cumulativeExpenses += parseFloat(tx.amount_bs);
                }
            }

            const date = new Date(tx.timestamp);
            const isSingleDay = allTransactions.length > 0
                && allTransactions.every((e) => {
                    const d = new Date(e.timestamp);
                    const d0 = new Date(allTransactions[0].timestamp);
                    return d.toDateString() === d0.toDateString();
                });

            points.push({
                time: tx.timestamp,
                available: currentAvailable,
                expenses: cumulativeExpenses,
                savings: cumulativeSavings,
                displayTime: isSingleDay
                    ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : `${date.getDate()}/${date.getMonth() + 1}`
            });
        });

        return points;
    }, [budget, categories]);

    const totalPresupuesto = useMemo(() => {
        return budget.categories
            .filter(c => c.is_presupuesto)
            .reduce((sum, c) => sum + budget.expenses.filter(e => e.category_name === c.name).reduce((s, e) => s + parseFloat(e.amount_bs), 0), 0);
    }, [budget]);

    const currentAvailable = data[data.length - 1]?.available || 0;
    const isBudgetOk = currentAvailable >= totalPresupuesto;

    return (
        <div className="bg-[#FFF1E7] dark:bg-[#242430] rounded-2xl p-4 h-[250px] shadow-inner transition-colors">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorAvailable" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF8A3D" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#FF8A3D" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
                    <XAxis
                        dataKey="displayTime"
                        hide={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{fontSize: 10, fill: 'var(--tw-prose-body)'}}
                        className="dark:fill-gray-400"
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 space-y-1">
                                        <p className="text-[10px] font-black uppercase text-gray-400 mb-2">{payload[0].payload.displayTime || 'Inicial'}</p>
                                        <div className="flex justify-between gap-4 items-center">
                                            <span className="text-xs text-gray-500 font-bold">Disponible:</span>
                                            <span className="text-sm font-black text-[#FF8A3D] dark:text-[#9B7BFF]">Bs {payload[0].payload.available.toLocaleString('es-ES')}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 items-center">
                                            <span className="text-xs text-gray-500 font-bold">Gastos:</span>
                                            <span className="text-sm font-black text-red-500">Bs {payload[0].payload.expenses.toLocaleString('es-ES')}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 items-center">
                                            <span className="text-xs text-gray-500 font-bold">Ahorros:</span>
                                            <span className="text-sm font-black text-green-500">$ {payload[0].payload.savings.toLocaleString('es-ES')}</span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />

                    {totalPresupuesto > 0 && (
                        <ReferenceLine
                            y={totalPresupuesto}
                            stroke={isBudgetOk ? "#10B98180" : "#EF444480"}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{ position: 'insideTopLeft', value: 'Presupuestado', fill: isBudgetOk ? "#10B981" : "#EF4444", fontSize: 10, fontWeight: 'bold' }}
                        />
                    )}

                    <Area
                        type="monotone"
                        dataKey="available"
                        stroke="#FF8A3D"
                        fillOpacity={1}
                        fill="url(#colorAvailable)"
                        strokeWidth={3}
                        name="Disponible"
                    />
                    <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="#EF4444"
                        fillOpacity={1}
                        fill="url(#colorExpenses)"
                        strokeWidth={2}
                        name="Gastos"
                    />
                    <Area
                        type="monotone"
                        dataKey="savings"
                        stroke="#10B981"
                        fillOpacity={1}
                        fill="url(#colorSavings)"
                        strokeWidth={2}
                        name="Ahorros"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

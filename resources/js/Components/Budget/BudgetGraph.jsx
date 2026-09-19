import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function BudgetGraph({ budget, categories }) {
    const visible = categories ?? budget.categories;
    const visibleNames = new Set(visible.map((c) => c.name));

    const data = useMemo(() => {
        const filtered = budget.expenses.filter((e) => visibleNames.has(e.category_name));
        const sortedExpenses = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
        let currentBalance = parseFloat(budget.opening_balance_bs) + parseFloat(budget.income_bs);

        const points = [{
            time: 'Inicio',
            balance: currentBalance,
            displayTime: ''
        }];

        sortedExpenses.forEach(expense => {
            const category = budget.categories.find(c => c.name === expense.category_name);
            if (category?.cash_expense) {
                currentBalance -= parseFloat(expense.amount_bs);
            }
            const date = new Date(expense.timestamp);
            const isSingleDay = sortedExpenses.length > 0
                && sortedExpenses.every((e) => {
                    const d = new Date(e.timestamp);
                    const d0 = new Date(sortedExpenses[0].timestamp);
                    return d.toDateString() === d0.toDateString();
                });
            points.push({
                time: expense.timestamp,
                balance: currentBalance,
                displayTime: isSingleDay
                    ? date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : `${date.getDate()}/${date.getMonth() + 1}`
            });
        });

        return points;
    }, [budget, categories]);

    return (
        <div className="bg-[#FFF1E7] dark:bg-[#242430] rounded-2xl p-4 h-[200px] shadow-inner transition-colors">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#FF8A3D" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#FF8A3D" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
                    <XAxis
                        dataKey="displayTime"
                        hide={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{fontSize: 10, fill: '#6A5349'}}
                    />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800">
                                        <p className="text-[10px] font-black uppercase text-gray-400 mb-1">{payload[0].payload.displayTime || 'Inicial'}</p>
                                        <p className="text-sm font-black text-[#FF8A3D] dark:text-[#9B7BFF]">
                                            Bs {payload[0].value.toLocaleString('es-ES')}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-500">
                                            $ {(payload[0].value / parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#FF8A3D"
                        fillOpacity={1}
                        fill="url(#colorBalance)"
                        strokeWidth={3}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

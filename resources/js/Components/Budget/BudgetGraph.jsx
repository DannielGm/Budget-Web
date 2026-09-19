import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

export default function BudgetGraph({ budget }) {
    const data = useMemo(() => {
        const sortedExpenses = [...budget.expenses].sort((a, b) => a.timestamp - b.timestamp);
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
            points.push({
                time: expense.timestamp,
                balance: currentBalance,
                displayTime: `${date.getDate()}/${date.getMonth() + 1}`
            });
        });

        return points;
    }, [budget]);

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
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        labelStyle={{fontWeight: 'bold'}}
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

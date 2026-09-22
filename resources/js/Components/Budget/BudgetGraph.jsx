import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend } from 'recharts';

export default function BudgetGraph({ budget, categories, rangeMode, dateFilter, today }) {
    const visibleNames = new Set((categories ?? budget.categories).map((c) => c.name));

    const data = useMemo(() => {
        // 1. Collect EVERYTHING that touches the balance chronologically
        const allTransactions = [
            ...(budget.expenses || []).map(e => ({...e, type: 'expense'})),
            ...(budget.savingsTransactions || []).map(s => ({...s, isSaving: true})),
            ...(budget.transfers || []).map(t => ({...t, type: 'transfer'})),
        ].sort((a, b) => a.timestamp - b.timestamp);

        // 2. Track running totals starting exactly from month start
        let currentAvailable = parseFloat(budget.opening_balance_bs) + parseFloat(budget.income_bs);
        let cumulativeExpenses = 0;
        let cumulativeSavings = 0; // Starts at 0 for THIS month's movement

        const points = [{
            time: 'Inicio',
            timestampMs: 0, // Ensure this sorts cleanly
            available: 0,
            expenses: 0,
            savings: 0,
            displayTime: ''
        }];

        allTransactions.forEach(tx => {
            if (tx.isSaving) {
                if (tx.type === 'deposit') {
                    // Manual deposits don't deduct from cash_bs in the new system (transfers do that)
                    cumulativeSavings += parseFloat(tx.amount_usd || 0);
                } else if (tx.type === 'withdrawal') {
                    cumulativeSavings -= parseFloat(tx.amount_usd || 0);
                }
            } else if (tx.type === 'transfer') {
                if (tx.source_type === 'cash') currentAvailable -= parseFloat(tx.amount_bs || 0);
                if (tx.destination_type === 'cash') currentAvailable += parseFloat(tx.amount_bs || 0);

                // Track savings impact of transfers
                const usdVal = parseFloat(tx.amount_usd) || (parseFloat(tx.amount_bs) / parseFloat(budget.income_rate || 1)) || 0;
                if (tx.destination_type === 'saving') cumulativeSavings += usdVal;
                if (tx.source_type === 'saving') cumulativeSavings -= usdVal;
            } else if (tx.type === 'expense') {
                const category = budget.categories.find(c => c.name === tx.category_name);
                if (category?.cash_expense && !category?.is_presupuesto) {
                    currentAvailable -= parseFloat(tx.amount_bs || 0);
                }
                // Only graph expenses if they are in the selected category filter
                if (visibleNames.has(tx.category_name) && !category?.is_presupuesto) {
                    cumulativeExpenses += parseFloat(tx.amount_bs || 0);
                }
            }

            const date = new Date(tx.timestamp);
            points.push({
                time: tx.timestamp,
                timestampMs: tx.timestamp,
                available: currentAvailable,
                expenses: cumulativeExpenses,
                savings: cumulativeSavings,
                displayTime: `${date.getDate()}/${date.getMonth() + 1}`
            });
        });

        // 3. Post-calculation Filtering: Slice the array based on user's time selection
        let sliced = points;

        // If there's a dateFilter, or we are in a mode other than 'Mes', we need to slice
        if (rangeMode !== 'Mes') {
            const anchorDate = dateFilter ? dateFilter : today;
            const end = new Date(`${anchorDate}T23:59:59`).getTime();
            const startDays = rangeMode === '7d' ? 7 : 1;
            const start = new Date(`${anchorDate}T00:00:00`);
            start.setDate(start.getDate() - (startDays - 1));
            const startTime = start.getTime();

            // Include the last point BEFORE the window to act as the "starting line"
            let startingPoint = points[0];
            sliced = points.filter(p => {
                if (p.timestampMs < startTime) {
                    startingPoint = p;
                    return false;
                }
                return p.timestampMs <= end;
            });

            // Adjust display times for 1d view
            if (rangeMode === '1d') {
                sliced.forEach(p => {
                    if (p.timestampMs > 0) {
                        const d = new Date(p.timestampMs);
                        p.displayTime = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                    }
                });
            }

            sliced = [startingPoint, ...sliced];
        }

        // 4. Force Graph Base to 0: Subtract starting values from all points in the viewport
        const baseAvailable = sliced[0].available;
        const baseExpenses = sliced[0].expenses;
        const baseSavings = sliced[0].savings;

        return sliced.map(p => ({
            ...p,
            available: p.available - baseAvailable,
            expenses: p.expenses - baseExpenses,
            savings: p.savings - baseSavings,
        }));

    }, [budget, categories, rangeMode, dateFilter, today, visibleNames]);

    const totalPresupuesto = useMemo(() => {
        return budget.categories
            .filter(c => c.is_presupuesto)
            .reduce((sum, c) => sum + (budget.expenses || []).filter(e => e.category_name === c.name).reduce((s, e) => s + parseFloat(e.amount_bs || 0), 0), 0);
    }, [budget]);

    // isBudgetOk checks the actual global available balance vs the total presupuesto
    const isBudgetOk = parseFloat(budget.available_balance_bs || 0) >= totalPresupuesto;

    return (
        <div className="bg-[#FFF1E7] dark:bg-[#242430] rounded-2xl p-4 h-[280px] shadow-inner transition-colors">
            <ResponsiveContainer width="100%" height="100%" className="outline-none focus:outline-none">
                <AreaChart data={data} style={{ outline: 'none' }}>
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
                        tick={{fontSize: 10, fill: '#9CA3AF'}} // Tailwind gray-400 for dark mode contrast
                    />
                    <YAxis hide domain={[0, 'auto']} />
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white dark:bg-gray-900 p-3 rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 space-y-1">
                                        <p className="text-[10px] font-black uppercase text-gray-400 mb-2">{payload[0].payload.displayTime || 'Inicio del período'}</p>
                                        <div className="flex justify-between gap-4 items-center">
                                            <span className="text-xs text-gray-500 font-bold">Disponible:</span>
                                            <span className="text-sm font-black text-[#FF8A3D] dark:text-[#9B7BFF]">Bs {payload[0].payload.available.toLocaleString('es-ES')}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 items-center">
                                            <span className="text-xs text-gray-500 font-bold">Gastos:</span>
                                            <span className="text-sm font-black text-red-500">Bs {payload[0].payload.expenses.toLocaleString('es-ES')}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 items-center">
                                            <span className="text-xs text-gray-500 font-bold">Ahorro del Mes:</span>
                                            <span className="text-sm font-black text-green-500">$ {payload[0].payload.savings.toLocaleString('es-ES', {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />

                    <Legend
                        verticalAlign="bottom"
                        height={20}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
                    />

                    {totalPresupuesto > 0 && (
                        <ReferenceLine
                            y={totalPresupuesto}
                            stroke={isBudgetOk ? "#10B98180" : "#EF444480"}
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            label={{ position: 'insideTopLeft', value: 'Presupuesto Total', fill: isBudgetOk ? "#10B981" : "#EF4444", fontSize: 10, fontWeight: 'bold' }}
                        />
                    )}

                    <Area
                        type="monotone"
                        dataKey="available"
                        stroke="#FF8A3D"
                        fillOpacity={1}
                        fill="url(#colorAvailable)"
                        strokeWidth={3}
                        name="Disponible (Bs)"
                        isAnimationActive={false}
                    />
                    <Area
                        type="monotone"
                        dataKey="expenses"
                        stroke="#EF4444"
                        fillOpacity={1}
                        fill="url(#colorExpenses)"
                        strokeWidth={2}
                        name="Gastos (Bs)"
                        isAnimationActive={false}
                    />
                    <Area
                        type="monotone"
                        dataKey="savings"
                        stroke="#10B981"
                        fillOpacity={1}
                        fill="url(#colorSavings)"
                        strokeWidth={2}
                        name="Ahorrado ($)"
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}


import React from 'react';
import { fmtBs, fmtUsd } from '@/lib/money';

function SummaryItem({ label, amountBs, rate, align = 'left' }) {
    const usd = Number(rate) > 0 ? Number(amountBs || 0) / Number(rate) : 0;

    return (
        <div className={`min-w-0 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
            <p className="truncate whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {label}
            </p>
            <p className="mt-1 truncate whitespace-nowrap text-sm font-bold tabular text-gray-800 dark:text-gray-100">
                Bs {fmtBs(amountBs)}
            </p>
            <p className="truncate whitespace-nowrap text-[10px] font-medium tabular text-gray-400 dark:text-gray-500">
                ≈ $ {fmtUsd(usd)}
            </p>
        </div>
    );
}

export default function MonthSummaryStrip({ incomeBs, expensesBs, paidBs, rate }) {
    return (
        <section
            aria-label="Resumen del mes"
            className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-3 shadow-sm"
        >
            <SummaryItem label="Ingresos" amountBs={incomeBs} rate={rate} />
            <SummaryItem label="Gastos" amountBs={expensesBs} rate={rate} align="center" />
            <SummaryItem label="Pagado" amountBs={paidBs} rate={rate} align="right" />
        </section>
    );
}

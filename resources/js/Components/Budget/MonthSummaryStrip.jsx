import React from 'react';
import { router } from '@inertiajs/react';
import { motion } from 'framer-motion';
import { fmtBs, fmtUsd } from '@/lib/money';
import useFitText from '@/hooks/useFitText';

// Shared with the insights panel so the strip and the screen it opens agree on
// how the surface grows out of, and tucks back into, this one element.
export const PANEL_SPRING = { type: 'spring', stiffness: 260, damping: 26 };

function SummaryItem({ label, amountBs, rate, align = 'left' }) {
    const usd = Number(rate) > 0 ? Number(amountBs || 0) / Number(rate) : 0;
    const [bsRef, bsSize] = useFitText({ min: 10, max: 16 });
    const [usdRef, usdSize] = useFitText({ min: 8, max: 11 });

    return (
        <div className={`min-w-0 px-3 first:pl-0 last:pr-0 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}>
            <p className="truncate whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {label}
            </p>
            <p
                ref={bsRef}
                style={{ fontSize: `${bsSize}px` }}
                className="mt-1 whitespace-nowrap font-bold leading-tight tabular text-gray-800 dark:text-gray-100"
            >
                Bs {fmtBs(amountBs)}
            </p>
            <p
                ref={usdRef}
                style={{ fontSize: `${usdSize}px` }}
                className="whitespace-nowrap font-medium leading-tight tabular text-gray-400 dark:text-gray-500"
            >
                &asymp; $ {fmtUsd(usd)}
            </p>
        </div>
    );
}

export default function MonthSummaryStrip({ incomeBs, expensesBs, paidBs, rate, insightsUrl }) {
    const openInsights = (event) => {
        // Let modified clicks open a new tab, matching normal link behaviour.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        router.visit(insightsUrl);
    };

    return (
        <a
            href={insightsUrl}
            onClick={openInsights}
            aria-label="Abrir el análisis del mes"
            title="Abrir el análisis del mes"
            className="touch-feedback group block rounded-2xl transition-transform duration-150 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-[#FF8A3D] dark:focus-visible:ring-[#9B7BFF]"
        >
            <motion.section
                layoutId="insights-panel"
                transition={PANEL_SPRING}
                aria-label="Resumen del mes"
                className="grid grid-cols-3 divide-x-2 divide-gray-200 rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm group-hover:shadow-md dark:divide-gray-700 dark:border-gray-800 dark:bg-gray-900"
            >
                <SummaryItem label="Ingresos" amountBs={incomeBs} rate={rate} />
                <SummaryItem label="Gastos" amountBs={expensesBs} rate={rate} align="center" />
                <SummaryItem label="Pagado" amountBs={paidBs} rate={rate} align="right" />
            </motion.section>
        </a>
    );
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import React, { useCallback, useState } from 'react';
import InsightsDashboard from '@/Components/Budget/InsightsDashboard';
import { motion } from 'framer-motion';
import { PANEL_SPRING } from '@/Components/Budget/MonthSummaryStrip';

const MONTH_SHORT = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * "Análisis" is a destination of its own rather than a fourth swipe view: the
 * summary strip is the entry point, and the panel below grows out of that strip
 * so the two screens read as one continuous surface. The shared layoutId
 * carries that motion across the route change.
 */
export default function Insights() {
    const { budget, savingsLedger, rate, dateFilter, today } = usePage().props;
    const [closing, setClosing] = useState(false);

    const [y, m] = String(budget?.month_id || '').split('-').map(Number);
    const monthLabel = y && m ? `${MONTH_SHORT[m - 1]} ${y}` : '';
    const rateValue = rate?.rate || budget?.income_rate || 0;
    const backUrl = route('dashboard', { month: budget?.month_id, day: dateFilter || undefined });

    /**
     * A plain <a href> is a full page load, which tears down the DOM the shared
     * layout animates between, so the transition is simply lost on the way
     * back. Routing through Inertia keeps the dashboard mounted, letting the
     * shared layoutId carry the panel back down into the summary strip.
     *
     * The navigation waits for the shrink to finish rather than firing in the
     * same tick, otherwise the page swap cuts the exit off halfway and the two
     * motions fight each other. Modified clicks are left to the browser so
     * open-in-new-tab still works.
     */
    const handleBack = useCallback((event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        if (closing) return;
        setClosing(true);
    }, [closing]);

    // Navigates only once the shrink has played out, so the handoff to the
    // shared layout is not cut in half by the page swap.
    const finishClosing = useCallback(() => {
        if (closing) router.visit(backUrl);
    }, [closing, backUrl]);

    return (
        <AuthenticatedLayout
            header={
                <h2 className="px-4 font-serif text-3xl font-black uppercase tracking-tight text-white sm:px-0">
                    Análisis
                </h2>
            }
        >
            <Head title="Análisis" />

            <div className="py-6 max-w-lg mx-auto px-4">
                <motion.div
                    layoutId="insights-panel"
                    initial={{ opacity: 0, scale: 0.82, y: -28 }}
                    animate={closing
                        ? { opacity: 0, scale: 0.82, y: -28 }
                        : { opacity: 1, scale: 1, y: 0 }}
                    onAnimationComplete={finishClosing}
                    transition={{ ...PANEL_SPRING, opacity: { duration: 0.25 } }}
                >
                    <InsightsDashboard
                        budget={budget}
                        savingsLedger={savingsLedger || []}
                        rate={rateValue}
                        todayIso={today || dateFilter || ''}
                        onBack={backUrl}
                        onBackClick={handleBack}
                        monthLabel={monthLabel}
                    />
                </motion.div>
            </div>
        </AuthenticatedLayout>
    );
}

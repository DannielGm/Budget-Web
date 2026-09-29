import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AppHeader from '@/Components/AppHeader';
import { Head, router, usePage } from '@inertiajs/react';
import React, { lazy, Suspense, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import SavingsOverview from '@/Components/Budget/SavingsOverview';
import SavingsForm from '@/Components/Budget/SavingsForm';
import TransferModal from '@/Components/Budget/TransferModal';
import { PANEL_SPRING } from '@/Components/Budget/MonthSummaryStrip';

const SavingsPoolSummaryModal = lazy(() => import('@/Components/Budget/SavingsPoolSummaryModal'));

/**
 * The savings summary the pool strip opens.
 *
 * A route rather than a panel inside the savings view, for the same reason
 * "Análisis" is: it needs its own URL, its own back control, and the month and
 * day it was opened from. The panel grows out of the strip through the shared
 * layoutId, so the two screens read as one continuous surface.
 *
 * The pool modal came here with the strip that used to open it. Its movement
 * rows still open the two savings forms, so editing a movement works exactly as
 * it did -- now reachable from the summary as well as from the history list.
 */
export default function Savings() {
    const { budget, savingsLedger, dateFilter } = usePage().props;
    const [closing, setClosing] = useState(false);
    const [selectedPool, setSelectedPool] = useState(null);
    const [movementPool, setMovementPool] = useState(null);
    const [editingSaving, setEditingSaving] = useState(null);
    const [editingTransfer, setEditingTransfer] = useState(null);
    const [showSavingsModal, setShowSavingsModal] = useState(false);

    // Back to the savings view, not the balance card: the strip that opened this
    // screen lives on the savings screen, and landing on the balance view meant
    // the user had to swipe across again to get back to where they were.
    const backUrl = route('dashboard', {
        month: budget?.month_id,
        day: dateFilter || undefined,
        view: 'savings',
    });

    /**
     * A plain <a href> is a full page load, which tears down the DOM the shared
     * layout animates between, so the transition is lost on the way back.
     * Routing through Inertia keeps the dashboard mounted, letting the shared
     * layoutId carry the panel back down into the strip. The navigation waits
     * for the shrink to finish rather than firing in the same tick, otherwise
     * the page swap cuts the exit off halfway. Modified clicks are left to the
     * browser so open-in-new-tab still works.
     */
    const handleBack = useCallback((event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        if (closing) return;
        setClosing(true);
    }, [closing]);

    const finishClosing = useCallback(() => {
        if (closing) router.visit(backUrl);
    }, [closing, backUrl]);

    return (
        <AuthenticatedLayout
            header={
                <AppHeader
                    title="Ahorros"
                    back={{ href: backUrl, onClick: handleBack, label: 'Volver al dashboard' }}
                    onOpenSettings={() => router.visit(route('settings'))}
                />
            }
        >
            <Head title="Ahorros" />

            <div className="py-6 max-w-lg mx-auto px-4">
                <motion.div
                    layoutId="savings-panel"
                    initial={{ opacity: 0, scale: 0.82, y: -28 }}
                    animate={closing
                        ? { opacity: 0, scale: 0.82, y: -28 }
                        : { opacity: 1, scale: 1, y: 0 }}
                    onAnimationComplete={finishClosing}
                    transition={{ ...PANEL_SPRING, opacity: { duration: 0.25 } }}
                >
                    <SavingsOverview
                        budget={budget}
                        onSelectPool={(poolName) => setSelectedPool(poolName)}
                        onAddMovement={() => setMovementPool('Digital')}
                    />
                </motion.div>
            </div>

            <Suspense fallback={null}>
                {selectedPool && (
                    <SavingsPoolSummaryModal
                        show={selectedPool !== null}
                        onClose={() => setSelectedPool(null)}
                        pool={selectedPool}
                        pools={budget?.savings_pools || []}
                        savingsLedger={savingsLedger || []}

                        onAddMovement={(poolName) => setMovementPool(poolName)}
                        onEditMovement={(t) => {
                            setSelectedPool(null);
                            if (t.kind === 'transfer') {
                                setEditingTransfer(t);
                            } else {
                                setEditingSaving({ ...t, category: t.pool });
                                setShowSavingsModal(true);
                            }
                        }}
                    />
                )}
            </Suspense>

            <SavingsForm
                show={showSavingsModal}
                onClose={() => setShowSavingsModal(false)}
                transaction={editingSaving}
                monthId={budget?.month_id}
            />

            <TransferModal
                show={editingTransfer !== null || movementPool !== null}
                onClose={() => {
                    setEditingTransfer(null);
                    setMovementPool(null);
                }}
                monthId={budget?.month_id}
                transfer={editingTransfer}
                pool={movementPool}
            />
        </AuthenticatedLayout>
    );
}
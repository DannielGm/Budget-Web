import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AppHeader from '@/Components/AppHeader';
import { Head, usePage, router } from '@inertiajs/react';
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import BalanceCard from '@/Components/Budget/BalanceCard';
import MonthSummaryStrip from '@/Components/Budget/MonthSummaryStrip';
import { calculateCashExpenses } from '@/lib/budgetExpenses';
import { scopeMonth } from '@/lib/scopedMoney';
import { expensesInRange, filteredCategories } from '@/lib/rangeHelpers';
import ExpenseForm from '@/Components/Budget/ExpenseForm';
import DebtCard from '@/Components/Budget/DebtCard';

import ExpenseCard from '@/Components/Budget/ExpenseCard';
import BudgetForm from '@/Components/Budget/BudgetForm';
import DebtForm from '@/Components/Budget/DebtForm';
import CategoryForm from '@/Components/Budget/CategoryForm';
import CategoryAccordion from '@/Components/Budget/CategoryAccordion';
import BudgetCalendar from '@/Components/Budget/BudgetCalendar';
import SavingsDashboard from '@/Components/Budget/SavingsDashboard';
import RateHistoryDashboard from '@/Components/Budget/RateHistoryDashboard';
import SavingsForm from '@/Components/Budget/SavingsForm';
import TransferModal from '@/Components/Budget/TransferModal';
import Modal from '@/Components/Modal';
import RemoteDesktopPanel from '@/Components/RemoteDesktopPanel';
import { useConfirm } from '@/Components/ConfirmationProvider';
import { useCurrency, counterpartOf } from '@/lib/currency';
import { useFigure } from '@/hooks/useFigure';
// Moon, Sun, MoreVertical, CalendarIcon, Home and SettingsIcon were imported for
// the header that has moved to AppHeader; the view icons below are the header's.
import { Plus, Wallet, BarChart3, TrendingUp, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fmtBs, fmtUsd, fmtPct } from '@/lib/money';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeViews, viewIndexOf, viewNameOf } from '@/hooks/useSwipeViews';
import useHapticFeedback from '@/hooks/useHapticFeedback';

/**
 * Wraps a trigger control in the shared-layout element its form will morph
 * from. The id is applied only while that form is open, so two elements never
 * hold the same layoutId at the same time.
 */
function ModalOrigin({ id, active, children }) {
    if (!active) return children;
    return <motion.div layoutId={id}>{children}</motion.div>;
}

const DebtSummaryModal = lazy(() => import('@/Components/Budget/DebtSummaryModal'));
const BudgetGraph = lazy(() => import('@/Components/Budget/BudgetGraph'));

const MONTH_SHORT = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * The three swipeable dashboards, in swipe order.
 *
 * The index is the contract: it is what the URL's `view` parameter carries and
 * what `changeView` takes, so the order here is the order a swipe moves through.
 * It lives in the page rather than the header because the page owns the view
 * state; the header only draws the switcher it is handed.
 */
const VIEWS = [
    { icon: BarChart3, index: 0, title: 'Presupuesto' },
    { icon: TrendingUp, index: 1, title: 'Tasas BCV' },
    { icon: Wallet, index: 2, title: 'Ahorros' },
];

export default function Dashboard() {
    const {
        budget, monthIds, version, auth, contextRate, dateFilter, today, currentMonthId, rate, savingsLedger, native, rates = {}, view,
    } = usePage().props;
    const confirmAction = useConfirm();
    // The rate history shows this series, with the other one as a comparison.
    const currency = useCurrency();
    // The rate the graph converts its savings series at: whichever series is on
    // screen, or the user's own number when the rate is custom. useFigure
    // already resolves exactly that question, so the graph does not have to.
    const { rate: graphRate } = useFigure();

    // One delegated listener answers every .touch-feedback control in the app.
    useHapticFeedback();

    const [selectedCategoryName, setSelectedCategoryName] = useState(budget.categories[0]?.name);
    const [showCalendar, setShowCalendar] = useState(false);
    const [rangeMode, setRangeMode] = useState('Mes');

    // Modal states
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [editingExpense, setEditingExpense] = useState(null);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [showDebtModal, setShowDebtModal] = useState(false);
    const [editingDebt, setEditingDebt] = useState(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [showSavingsModal, setShowSavingsModal] = useState(false);
    const [editingSaving, setEditingSaving] = useState(null);
    const [showCategoryAccordion, setShowCategoryAccordion] = useState(false);
    const [showDebtSummary, setShowDebtSummary] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [editingTransfer, setEditingTransfer] = useState(null);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showRemoteDesktop, setShowRemoteDesktop] = useState(false);
    // View state for swipeable dashboard (0 = Main, 1 = Rates, 2 = Savings).
    // Seeded from the URL: the view is otherwise gone the moment the user leaves
    // for the savings summary, and the return landed on the balance card.
    const [currentViewIndex, setCurrentViewIndex] = useState(() => viewIndexOf(view));

    const changeView = (index) => {
        if (index === currentViewIndex) return;
        setDirection(index > currentViewIndex ? 1 : -1);
        setCurrentViewIndex(index);
    };




    // BCV rates view (swipe page 1): series fetched lazily per range on first
    // open and cached per range, so swiping back and forth never refetches.
    const [rateSeriesByRange, setRateSeriesByRange] = useState({});
    const [rateLoading, setRateLoading] = useState(false);
    const [rateError, setRateError] = useState(null);
    const [rateRange, setRateRange] = useState('30');
    const [refreshingRate, setRefreshingRate] = useState(false);

    const fetchRateSeries = async (range, force = false) => {
        if (!force && rateSeriesByRange[range]) return;
        setRateLoading(true);
        setRateError(null);
        try {
            // Ask for the series on screen; the endpoint returns the other one
            // alongside it as the comparison line, so both arrive in one request.
            const { data } = await axios.get(route('exchange-rate.series'), { params: { range, currency } });
            setRateSeriesByRange((prev) => ({ ...prev, [range]: data }));
        } catch (err) {
            setRateError(err?.message || 'Error de red');
        } finally {
            setRateLoading(false);
        }
    };

    const handleRefreshRate = async () => {
        setRefreshingRate(true);
        try {
            await axios.post(route('exchange-rate.refresh'));
            setRateSeriesByRange({});
            router.reload({ only: ['rate'] });
            await fetchRateSeries(rateRange, true);
        } catch (err) {
            setRateError(err?.message || 'Error de red');
        } finally {
            setRefreshingRate(false);
        }
    };

    useEffect(() => {
        if (currentViewIndex === 1) {
            fetchRateSeries(rateRange);
        }
    }, [currentViewIndex]);





    // Intersection observer state for bottom category bar
    const [showBottomBar, setShowBottomBar] = useState(false);
    const expensesContainerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setShowBottomBar(entry.isIntersecting);
            },
            {
                root: null,
                rootMargin: '0px',
                threshold: 0.05,
            }
        );

        if (expensesContainerRef.current) {
            observer.observe(expensesContainerRef.current);
        }

        return () => {
            if (expensesContainerRef.current) {
                observer.unobserve(expensesContainerRef.current);
            }
        };
    }, [currentViewIndex]);

    const isPastMonth = budget.month_id !== currentMonthId;

    useEffect(() => {
        if (isPastMonth && !dateFilter) {
            setRangeMode('Mes');
        }
    }, [isPastMonth, dateFilter]);

    // The theme lives in the header now: it is an app-wide display preference,
    // and it used to be unreachable from the other three screens because it was
    // state on this page only.

    // ---- Month / day navigation -------------------------------------------
    const navigate = (monthId, dayIso) => {
        const query = { month: monthId };
        if (dayIso) query.day = dayIso;
        // Carry the open view: switching month from the rates or the savings
        // screen should not throw the user back onto the balance card.
        if (currentViewIndex > 0) query.view = viewNameOf(currentViewIndex);

        router.get(route('dashboard'), query, { preserveState: true, preserveScroll: true });
    };

    const goToToday = () => {
        setRangeMode('Mes');
        navigate(currentMonthId, null);
    };

    // "Mes" clears the day filter (Kotlin rule); 1d/7d keep it.
    const applyRangeMode = (mode) => {
        setRangeMode(mode);
        if (mode === 'Mes' && dateFilter) {
            navigate(budget.month_id, null);
        }
    };

    const rangeDaysFor = (mode) => (mode === 'Mes' ? 30 : mode === '7d' ? 7 : 1);

    const visibleCategories = filteredCategories(budget, dateFilter, rangeDaysFor(rangeMode));

    // Single definition of "Gastos" for the summary strip, shared with
    // BalanceCard and the graph so the three surfaces cannot disagree.
    const stripCashExpenses = calculateCashExpenses(budget, dateFilter);

    // A day filter drops categories that have no expenses that day, so the
    // selected one can be missing from the list. The fallback keeps the
    // category's identity and applies the SAME filter as the list: empty for
    // a day with no matching movements, the full month when no day is set.
    const selectedCategory = visibleCategories.find((c) => c.name === selectedCategoryName)
        ?? (() => {
            const full = budget.categories.find((c) => c.name === selectedCategoryName);
            if (!full) return full;
            return { ...full, expenses: expensesInRange(budget, full.name, dateFilter, rangeDaysFor(rangeMode)) };
        })();

    // Day/range state for debts. With no filter this is the month view and both
    // helpers return the stored totals untouched.
    // One definition of the range, shared by the hero, the strip, the debts card
    // and the plan tint. Deriving these in four places is how they came to
    // disagree with each other under a day filter.
    const scoped = scopeMonth(budget, {
        savingsLedger: savingsLedger || [],
        dateFilter,
        rangeDays: rangeDaysFor(rangeMode),
    });
    const scopedDebts = scoped.debts;
    const scopedCreditPurchasesBs = scoped.creditBs;
    const scopedPaidBs = scoped.debtPaidBs;
    const scopedDebtBs = scoped.debtRemainingBs;

    const isNotToday = dateFilter !== null || budget.month_id !== currentMonthId;

    const monthLabelShort = budget.month_label.replace(/\s+\d{4}$/, '');
    const headerLabel = dateFilter
        ? `${monthLabelShort} - ${Number(dateFilter.slice(8, 10))}`
        : monthLabelShort;

    const dayFilterCaption = dateFilter
        ? `${rangeMode === '1d' ? 'Día' : rangeMode === '7d' ? '7d' : 'Mes'} hasta ${Number(dateFilter.slice(8, 10))} ${MONTH_SHORT[Number(dateFilter.slice(5, 7)) - 1]}`
        : null;

    const handleAddExpense = () => {
        setEditingExpense(null);
        setShowExpenseModal(true);
    };

    const handleEditExpense = (expense) => {
        setEditingExpense(expense);
        setShowExpenseModal(true);
    };

    const handleDeleteExpense = async (expense) => {
        const confirmed = await confirmAction({
            title: 'Eliminar gasto',
            message: `Se eliminará “${expense.label}” por Bs ${fmtBs(expense.amount_bs)}.`,
            detail: 'Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar',
            tone: 'danger',
        });
        if (confirmed) router.delete(route('expenses.destroy', expense.id));
    };

    const handleEditDebt = (debt) => {
        setEditingDebt(debt);
        setShowDebtModal(true);
    };

    const effectiveRate = dateFilter ? rate?.rate : budget.income_rate;
    const creditPurchasesBs = parseFloat(budget.credit_purchases_bs || 0);
    const totalDebtBs = parseFloat(budget.debt_bs || 0);

    // Scoped to the active range so the green/red tint on the expense rows
    // answers the question actually on screen. scopeMonth folds the plan total
    // and the balance together, so the two cannot disagree.
    const isBudgetOk = scoped.planFitsBalance;

    const seedMockData = async () => {
        const confirmed = await confirmAction({
            title: 'Llenar datos de prueba',
            message: 'Se reemplazarán los datos de los últimos cuatro meses.',
            detail: 'Tus datos actuales de esos meses serán sustituidos.',
            confirmLabel: 'Llenar datos',
            tone: 'warning',
        });
        if (confirmed) router.post(route('settings.seed-mock'));
    };
    const swipeVariants = {
        enter: (direction) => {
            return {
                x: direction > 0 ? 1000 : -1000,
                opacity: 0
            };
        },
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1
        },
        exit: (direction) => {
            return {
                zIndex: 0,
                x: direction < 0 ? 1000 : -1000,
                opacity: 0
            };
        }
    };
    const [direction, setDirection] = useState(0);

    /**
     * Shared-layout ids for the forms. The button that opens a form and the
     * modal it opens carry the same id, so the panel grows out of the control
     * that was tapped instead of appearing from nowhere.
     */
    const MODAL_IDS = {
        expense: 'modal-expense',
        debt: 'modal-debt',
        savings: 'modal-savings',
        transfer: 'modal-transfer',
        budget: 'modal-budget',
        category: 'modal-category',
    };

    /**
     * Views only ever change on release. The old implementation passed framer's
     * `drag` straight to each view, so the container tracked the finger 1:1 and
     * the balance graph could never win the gesture for itself.
     */
    const goToView = useCallback((step) => {
        setCurrentViewIndex((current) => {
            const next = current + step;
            if (next < 0 || next > 2) return current;
            setDirection(step);
            return next;
        });
    }, []);

    const swipe = useSwipeViews({
        onNext: () => goToView(1),
        onPrevious: () => goToView(-1),
    });

    return (
        <AuthenticatedLayout
            header={
                <AppHeader
                    title={headerLabel}
                    onTitleClick={() => setShowCalendar(true)}
                    titleHint={`Elegir mes o día. Periodo actual: ${headerLabel}`}
                    onGoToToday={goToToday}
                    isNotToday={isNotToday}
                    views={VIEWS}
                    currentViewIndex={currentViewIndex}
                    onChangeView={changeView}
                    onOpenSettings={() => setShowSettingsModal(true)}
                />
            }
        >
            <Head title="Dashboard" />

            <div
                // No horizontal padding here, and that is deliberate. The three
                // swipe views below are absolutely positioned, so their containing
                // block is this element's PADDING box: `w-full` would be the full
                // width including any padding, while the box itself sits at the
                // CONTENT edge. Padding here plus `w-full` on a view therefore
                // pushed every view 16px past the right edge, where
                // `overflow-x-hidden` silently clipped the right of every card.
                // An old `pr-8` on each view cancelled that overshoot, which is
                // why it went unnoticed for so long. The views are anchored
                // `left-0 right-0` and carry the `px-4` themselves instead.
                className="py-6 max-w-lg mx-auto relative min-h-[85vh] overflow-x-hidden"
                style={{ touchAction: 'pan-y' }}
                {...swipe}
            >
                <AnimatePresence initial={false} custom={direction}>
                    {currentViewIndex === 0 && (
                        <motion.div
                            key="main-dashboard"
                            custom={direction}
                            variants={swipeVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute left-0 right-0 space-y-6 px-4 pb-24"
                        >
                <BalanceCard
                    budget={budget}
                    contextRate={contextRate}
                    rate={rate}
                    dateFilter={dateFilter}
                    rangeDays={rangeDaysFor(rangeMode)}
                    savingsLedger={savingsLedger || []}
                    onEdit={() => setShowBudgetModal(true)}
                />

                <MonthSummaryStrip
                    incomeBs={budget.income_bs}
                    expensesBs={stripCashExpenses}
                    paidBs={scopedPaidBs}
                    rate={budget.income_rate}
                    insightsUrl={route('insights', { month: budget.month_id, day: dateFilter || undefined })}
                />

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="font-bold text-lg dark:text-white">Flujo</h3>
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                            {['Mes', '7d', '1d'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => applyRangeMode(mode)}
                                    disabled={isPastMonth && !dateFilter && mode !== 'Mes'}
                                    className={cn(
                                        'px-3 py-1 text-xs font-bold rounded-md transition-colors focus:outline-none focus:ring-0',
                                        rangeMode === mode
                                            ? 'bg-white dark:bg-gray-700 shadow-sm dark:text-white'
                                            : 'text-gray-500 dark:text-gray-400',
                                        isPastMonth && !dateFilter && mode !== 'Mes' ? 'opacity-50 cursor-not-allowed' : ''
                                    )}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>

                    {dayFilterCaption && (
                        <div className="flex justify-between items-center px-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                {dayFilterCaption}
                            </span>
                            <button
                                onClick={() => navigate(budget.month_id, null)}
                                className="text-xs font-black uppercase tracking-wider text-[#FF8A3D] dark:text-[#9B7BFF] hover:opacity-80"
                            >
                                Ver mes
                            </button>
                        </div>
                    )}

                    <Suspense fallback={<div className="h-48 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-gray-400">Cargando gráfico…</div>}>
                        <BudgetGraph
                            budget={budget}
                            categories={visibleCategories}
                            rangeMode={rangeMode}
                            dateFilter={dateFilter}
                            today={today}
                            savingsLedger={savingsLedger || []}
                            savingsRate={graphRate}
                            savingsCurrency={currency}
                        />
                    </Suspense>
                </div>

                {/* Deuda Card */}
                <DebtCard
                    debts={scopedDebts}
                    totalDebtBs={scopedDebtBs}
                    creditPurchasesBs={scopedCreditPurchasesBs}
                    rate={effectiveRate}
                    onOpenSummary={() => setShowDebtSummary(true)}
                    onAdd={() => { setEditingDebt(null); setShowDebtModal(true); }}
                    layoutId={showDebtModal ? MODAL_IDS.debt : null}
                    onEdit={handleEditDebt}
                />

                <ExpenseCard
                    ref={expensesContainerRef}
                    category={selectedCategory}
                    expenses={selectedCategory?.expenses ?? []}
                    selectedRate={effectiveRate}
                    isBudgetOk={isBudgetOk}
                    dateFilter={dateFilter}
                    onSelectCategory={() => setShowCategoryAccordion(true)}
                    onAdd={handleAddExpense}
                layoutId={showExpenseModal ? MODAL_IDS.expense : null}
                    onEdit={handleEditExpense}
                    onDelete={handleDeleteExpense}
                />
                <footer className="text-center pb-8">
                    <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                        Budget keeper - {version.replace('alpha ', '')}
                    </p>
                </footer>
                        </motion.div>
                    )}

                    {currentViewIndex === 1 && (
                        <motion.div
                            key="rates-dashboard"
                            custom={direction}
                            variants={swipeVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute left-0 right-0 space-y-6 px-4 pb-24"
                        >
                            <RateHistoryDashboard
                                rate={rate}
                                points={rateSeriesByRange[rateRange]?.series || null}
                                comparison={rateSeriesByRange[rateRange]?.comparison || null}
                                currency={rateSeriesByRange[rateRange]?.currency || currency}
                                comparisonCurrency={rateSeriesByRange[rateRange]?.comparison_currency || counterpartOf(currency)}
                                loading={rateLoading}
                                error={rateError}
                                refreshing={refreshingRate}
                                range={rateRange}
                                onRangeChange={(key) => {
                                    setRateRange(key);
                                    fetchRateSeries(key);
                                }}
                                onRefresh={handleRefreshRate}
                                onRetry={() => fetchRateSeries(rateRange)}
                            />

                            <footer className="text-center pb-8">
                                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                                    Budget keeper - {version.replace('alpha ', '')}
                                </p>
                            </footer>
                        </motion.div>
                    )}

                    {currentViewIndex === 2 && (
                        <motion.div
                            key="savings-dashboard"
                            custom={direction}
                            variants={swipeVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute left-0 right-0 space-y-6 px-4 pb-24"
                        >
                             <SavingsDashboard
                                budget={budget}
                                savingsLedger={savingsLedger || []}
                                dateFilter={dateFilter}
                                rangeDays={rangeDaysFor(rangeMode)}
                                summaryUrl={route('savings.dashboard', { month: budget.month_id, day: dateFilter || undefined })}
                                onEditTransfer={(t) => setEditingTransfer(t)}
                                onAddSaving={(transaction) => {
                                    setEditingSaving(transaction);
                                    setShowSavingsModal(true);
                                }}
                                onTransfer={() => setShowTransferModal(true)}
                transferLayoutId={showTransferModal ? MODAL_IDS.transfer : null}
                            />

                            <footer className="text-center pb-8">
                                <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                                    Budget keeper - {version.replace('alpha ', '')}
                                </p>
                            </footer>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            <ExpenseForm
                layoutId={MODAL_IDS.expense}
                show={showExpenseModal}
                onClose={() => setShowExpenseModal(false)}
                expense={editingExpense}
                categoryName={selectedCategoryName}
                monthId={budget.month_id}
                defaultRate={contextRate}
            />

            <BudgetForm
                layoutId={MODAL_IDS.budget}
                show={showBudgetModal}
                onClose={() => setShowBudgetModal(false)}
                budget={budget}
                rates={rates}
            />

            <DebtForm
                layoutId={MODAL_IDS.debt}
                show={showDebtModal}
                onClose={() => setShowDebtModal(false)}
                debt={editingDebt}
                monthId={budget.month_id}
                rate={effectiveRate}
            />

            <CategoryForm
                layoutId={MODAL_IDS.category}
                show={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                category={editingCategory}
                monthId={budget.month_id}
            />

            <CategoryAccordion
                show={showCategoryAccordion}
                onClose={() => setShowCategoryAccordion(false)}
                categories={budget.categories}
                selectedCategoryName={selectedCategoryName}
                onSelect={(name) => {
                    setSelectedCategoryName(name);
                    setShowCategoryAccordion(false);
                }}
                onCreate={() => {
                    setEditingCategory(null);
                    setShowCategoryModal(true);
                }}
                onEdit={(cat) => {
                    setEditingCategory(cat);
                    setShowCategoryModal(true);
                }}
            />

            <SavingsForm
                layoutId={MODAL_IDS.savings}
                show={showSavingsModal}
                onClose={() => setShowSavingsModal(false)}
                transaction={editingSaving}
                monthId={budget.month_id}
            />

            <Suspense fallback={null}>
                {showDebtSummary && (
                    <DebtSummaryModal
                        show={showDebtSummary}
                        onClose={() => setShowDebtSummary(false)}
                        debts={budget.debts}
                        creditPurchasesBs={creditPurchasesBs}
                        currentRate={effectiveRate}
                        totalDebtBs={totalDebtBs}
                    />
                )}
            </Suspense>

            <Modal
                show={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
                maxWidth="sm"
            >
                <div className="max-h-[80dvh] overflow-y-auto p-4 text-gray-700 dark:text-gray-200">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Configuración</h2>
                            {auth?.user && <p className="text-xs text-gray-400">{auth.user.name}</p>}
                        </div>
                        <button onClick={() => setShowSettingsModal(false)} className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Cerrar menú">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-1">
                        {native?.canRemoteDesktop && <button type="button" onClick={() => { setShowSettingsModal(false); setShowRemoteDesktop(true); }} className="menu-button">Escritorio remoto</button>}
                        <button onClick={() => { setShowSettingsModal(false); seedMockData(); }} className="menu-button">Llenar datos de prueba</button>
                        <div className="my-2 border-t border-gray-200 dark:border-gray-700" />
                        <a href={route('settings')} className="menu-button">Configuración</a>
                        {auth?.user ? (
                            <>
                                <a href={route('profile.edit')} className="menu-button">Mi perfil</a>
                                <form method="POST" action={route('logout')} onSubmit={(event) => { event.preventDefault(); router.post(route('logout')); }}>
                                    <button type="submit" className="menu-button text-red-600 dark:text-red-400">Cerrar sesión</button>
                                </form>
                            </>
                        ) : (
                            <>
                                <a href={route('login')} className="menu-button">Iniciar sesión</a>
                                <a href={route('register')} className="menu-button">Crear cuenta</a>
                            </>
                        )}
                    </div>
                </div>
            </Modal>

            <RemoteDesktopPanel show={showRemoteDesktop} onClose={() => setShowRemoteDesktop(false)} />

            <TransferModal
                layoutId={MODAL_IDS.transfer}
                show={showTransferModal || editingTransfer !== null}
                onClose={() => {
                    setShowTransferModal(false);
                    setEditingTransfer(null);
                }}
                monthId={budget.month_id}
                transfer={editingTransfer}
            />

            {/* Month/Day calendar picker (port of BudgetCalendar.kt) */}
            <BudgetCalendar
                show={showCalendar}
                onClose={() => setShowCalendar(false)}
                onSelect={(monthId, dayIso) => {
                    setRangeMode(dayIso ? '1d' : 'Mes');
                    navigate(monthId, dayIso);
                }}
                initialMonthId={budget.month_id}
                initialDayIso={dateFilter}
            />

            {/* Category Selector */}
            <AnimatePresence>
                {showBottomBar && currentViewIndex === 0 && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="fixed bottom-6 left-0 right-0 flex justify-center px-4 pointer-events-none z-50"
                    >
                        <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl p-1 shadow-2xl flex gap-1 pointer-events-auto overflow-x-auto max-w-full no-scrollbar">
                            {budget.categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryName(cat.name)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                        selectedCategoryName === cat.name
                                            ? "bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white shadow-md"
                                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </AuthenticatedLayout>
    );
}

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

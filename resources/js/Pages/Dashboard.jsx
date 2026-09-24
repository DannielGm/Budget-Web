import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, router } from '@inertiajs/react';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import axios from 'axios';
import BalanceCard from '@/Components/Budget/BalanceCard';
import ExpenseForm from '@/Components/Budget/ExpenseForm';
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
import { Plus, Moon, Sun, MoreVertical, Calendar as CalendarIcon, Home, Edit2, Trash2, CreditCard, Settings as SettingsIcon, Wallet, BarChart3, TrendingUp, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

const DebtSummaryModal = lazy(() => import('@/Components/Budget/DebtSummaryModal'));
const SavingsPoolSummaryModal = lazy(() => import('@/Components/Budget/SavingsPoolSummaryModal'));
const BudgetGraph = lazy(() => import('@/Components/Budget/BudgetGraph'));

const MONTH_SHORT = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Port of the Kotlin BudgetScreen's filtering rules:
 *  - null dateFilter  -> every expense
 *  - rangeDays >= 30  -> the whole month
 *  - rangeDays <= 1   -> only the same local day
 *  - otherwise        -> the last N days, clamped to the 1st of the month
 */
export function filteredCategories(budget, dateFilter, rangeDays) {
    if (dateFilter === null || dateFilter === undefined) {
        return budget.categories;
    }

    if (rangeDays >= 30) {
        return budget.categories;
    }

    if (rangeDays <= 1) {
        return budget.categories
            .map((category) => ({
                ...category,
                expenses: budget.expenses.filter(
                    (e) => e.category_name === category.name && sameDay(e.timestamp, dateFilter),
                ),
            }))
            .filter((c) => c.expenses.length > 0);
    }

    const end = new Date(`${dateFilter}T23:59:59`);
    const start = new Date(end);
    start.setDate(end.getDate() - (rangeDays - 1));
    const floor = new Date(`${dateFilter.slice(0, 7)}-01T00:00:00`);
    if (start < floor) start.setTime(floor.getTime());

    return budget.categories
        .map((category) => ({
            ...category,
            expenses: budget.expenses.filter((e) => {
                const t = new Date(e.timestamp);
                return e.category_name === category.name && t >= start && t <= end;
            }),
        }))
        .filter((c) => c.expenses.length > 0);
}

function sameDay(timestampMs, dateIso) {
    const d = new Date(timestampMs);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return iso === dateIso;
}

export default function Dashboard() {
    const {
        budget, monthIds, version, auth, contextRate, dateFilter, today, currentMonthId, rate, savingsLedger,
    } = usePage().props;

    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });
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
    const [selectedPool, setSelectedPool] = useState(null);
    const [movementPool, setMovementPool] = useState(null);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    // View state for swipeable dashboard (0 = Main, 1 = Rates, 2 = Savings)
    const [currentViewIndex, setCurrentViewIndex] = useState(0);
    const [isViewSelectorOpen, setIsViewSelectorOpen] = useState(false);
    const viewSelectorRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (viewSelectorRef.current && !viewSelectorRef.current.contains(event.target)) {
                setIsViewSelectorOpen(false);
            }
        };

        if (isViewSelectorOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isViewSelectorOpen]);




    // BCV rates view (swipe page 1): series fetched lazily per range on first
    // open and cached per range, so swiping back and forth never refetches.
    const [rateSeriesByRange, setRateSeriesByRange] = useState({});
    const [rateLoading, setRateLoading] = useState(false);
    const [rateError, setRateError] = useState(null);
    const [rateRange, setRateRange] = useState('180');
    const [refreshingRate, setRefreshingRate] = useState(false);

    const fetchRateSeries = async (range, force = false) => {
        if (!force && rateSeriesByRange[range]) return;
        setRateLoading(true);
        setRateError(null);
        try {
            const { data } = await axios.get(route('exchange-rate.series'), { params: { range } });
            setRateSeriesByRange((prev) => ({ ...prev, [range]: data.series }));
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

    const toggleTheme = () => {
        const nextDark = !isDark;
        setIsDark(nextDark);
        if (nextDark) {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        }
    };

    // ---- Month / day navigation -------------------------------------------
    const navigate = (monthId, dayIso) => {
        const query = { month: monthId };
        if (dayIso) query.day = dayIso;

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

    const selectedCategory = visibleCategories.find((c) => c.name === selectedCategoryName)
        ?? budget.categories.find((c) => c.name === selectedCategoryName);

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

    const handleDeleteExpense = (expense) => {
        if (confirm('¿Estás seguro de eliminar este gasto?')) {
            router.delete(route('expenses.destroy', expense.id));
        }
    };

    const handleEditDebt = (debt) => {
        setEditingDebt(debt);
        setShowDebtModal(true);
    };

    const creditPurchasesBs = parseFloat(budget.credit_purchases_bs || 0);

    const totalDebtBs = parseFloat(budget.debt_bs || 0);

    const totalPresupuestoBs = (budget.categories || [])
        .filter(c => c.is_presupuesto)
        .reduce((sum, c) => {
            const catExpenses = (budget.expenses || []).filter(e => e.category_name === c.name);
            return sum + catExpenses.reduce((s, e) => s + parseFloat(e.amount_bs || 0), 0);
        }, 0);

    const isBudgetOk = parseFloat(budget.available_balance_bs || 0) >= totalPresupuestoBs;

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

    const handleDragEnd = (e, { offset, velocity }) => {
        const swipe = Math.abs(offset.x) * velocity.x;

        if (swipe < -10000) {
            // Swipe Left -> next view (Main -> Rates -> Savings)
            if (currentViewIndex < 2) {
                setDirection(1);
                setCurrentViewIndex(currentViewIndex + 1);
            }
        } else if (swipe > 10000) {
            // Swipe Right -> previous view
            if (currentViewIndex > 0) {
                setDirection(-1);
                setCurrentViewIndex(currentViewIndex - 1);
            }
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex justify-between items-center w-full px-3 sm:px-0 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {isNotToday && (
                            <button
                                onClick={goToToday}
                                title="Ir a hoy"
                                className="p-1.5 shrink-0 text-white hover:bg-white/10 rounded-full transition-all"
                            >
                                <Home size={18} />
                            </button>
                        )}
                        <button
                            className="flex items-center min-w-0 cursor-pointer text-left"
                            onClick={() => setShowCalendar(true)}
                            title="Elegir mes o día"
                        >
                            <h2 className="text-lg sm:text-2xl font-black font-serif text-white uppercase tracking-tight truncate">
                                {headerLabel}
                            </h2>
                        </button>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                        {/* Collapsible Dashboard View Switcher */}
                        <div className="relative" ref={viewSelectorRef}>
                            {(() => {
                                const views = [
                                    { icon: BarChart3, index: 0, title: 'Presupuesto' },
                                    { icon: TrendingUp, index: 1, title: 'Tasas BCV' },
                                    { icon: Wallet, index: 2, title: 'Ahorros' },
                                ];
                                const activeView = views[currentViewIndex] || views[0];
                                const ActiveIcon = activeView.icon;

                                return (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setIsViewSelectorOpen((prev) => !prev)}
                                            className={cn(
                                                "p-1.5 rounded-full transition-all flex items-center justify-center",
                                                isViewSelectorOpen
                                                    ? "bg-white text-[#FF8A3D] dark:text-[#9B7BFF] shadow-sm"
                                                    : "bg-white/20 text-white hover:bg-white/30"
                                            )}
                                            title={`Vista actual: ${activeView.title} (toca para cambiar)`}
                                            aria-label="Cambiar vista de dashboard"
                                        >
                                            <ActiveIcon size={18} />
                                        </button>

                                        {isViewSelectorOpen && (
                                            <div className="absolute right-0 top-full mt-1.5 p-1 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 flex flex-col gap-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                                                {views.map(({ icon: Icon, index, title }) => {
                                                    const isCurrent = currentViewIndex === index;
                                                    return (
                                                        <button
                                                            key={index}
                                                            type="button"
                                                            onClick={() => {
                                                                if (index !== currentViewIndex) {
                                                                    setDirection(index > currentViewIndex ? 1 : -1);
                                                                    setCurrentViewIndex(index);
                                                                }
                                                                setIsViewSelectorOpen(false);
                                                            }}
                                                            className={cn(
                                                                "p-2 rounded-xl transition-all flex items-center gap-2 text-xs font-semibold whitespace-nowrap pr-3",
                                                                isCurrent
                                                                    ? "bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white shadow-sm"
                                                                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                                                            )}
                                                            title={title}
                                                        >
                                                            <Icon size={16} className="shrink-0" />
                                                            <span>{title}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        <button onClick={toggleTheme} className="p-1.5 text-white hover:bg-white/10 rounded-full transition-all">
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="p-1.5 text-white hover:bg-white/10 rounded-full transition-all"
                            aria-label="Abrir menú de configuración"
                        >
                            <SettingsIcon size={20} />
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="py-6 max-w-lg mx-auto px-4 relative min-h-[85vh] overflow-x-hidden">
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
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={1}
                            onDragEnd={handleDragEnd}
                            className="absolute w-full pr-8 space-y-6 pb-24"
                        >
                <BalanceCard
                    budget={budget}
                    contextRate={contextRate}
                    rate={rate}
                    dateFilter={dateFilter}
                    onEdit={() => setShowBudgetModal(true)}
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
                        />
                    </Suspense>
                </div>

                {/* Deuda Card */}
                <div className="bg-[#1A1A1A] rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
                    <div className="flex justify-between items-center mb-3">
                        <div
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => setShowDebtSummary(true)}
                        >
                            <CreditCard className="text-gray-400 group-hover:text-white transition-colors" size={18} />
                            <h4 className="font-bold text-sm uppercase tracking-widest text-gray-400 group-hover:text-white transition-colors">Estado de Deuda</h4>
                        </div>
                        <button
                            onClick={() => { setEditingDebt(null); setShowDebtModal(true); }}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="mb-4">
                        <p className="text-2xl font-black font-serif tracking-tight tabular">
                            Bs {totalDebtBs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider tabular">
                            $ {budget.income_rate > 0 ? (totalDebtBs / parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                        </p>
                    </div>

                    <div className="space-y-3">
                        {creditPurchasesBs > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-300 font-medium">Compras a crédito</span>
                                <div className="text-right">
                                    <span className="text-sm font-bold block">Bs {creditPurchasesBs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <span className="text-[10px] text-gray-400 font-bold">$ {budget.income_rate > 0 ? (creditPurchasesBs / parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</span>
                                </div>
                            </div>
                        )}
                        {budget.debts.map(debt => {
                            const debtRemainingBs = (parseFloat(debt.opening_bs) + parseFloat(debt.credit_expenses_bs || 0)) - parseFloat(debt.payment_bs);
                            return (
                                <div key={debt.id} className="flex justify-between items-center cursor-pointer hover:bg-white/5 p-1 rounded transition-colors" onClick={() => handleEditDebt(debt)}>
                                    <span className="text-xs text-gray-300 font-medium">{debt.label}</span>
                                    <div className="text-right">
                                        <p className="text-sm font-bold">Bs {debtRemainingBs.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        <p className="text-[10px] text-gray-400 font-bold">$ {budget.income_rate > 0 ? (debtRemainingBs / parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</p>

                                        {parseFloat(debt.payment_bs) > 0 && (
                                            <p className="text-[10px] text-green-400 font-bold">Pagado: Bs {parseFloat(debt.payment_bs).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        )}
                                        {parseFloat(debt.credit_expenses_bs || 0) > 0 && (
                                            <p className="text-[10px] text-red-400 font-bold">Nuevos cargos: Bs {parseFloat(debt.credit_expenses_bs).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div
                    ref={expensesContainerRef}
                    className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 transition-colors"
                >
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setShowCategoryAccordion(true)}>
                            <h4 className="font-bold text-lg dark:text-white uppercase tracking-wide">
                                {selectedCategory?.name || 'Categoría'}
                            </h4>
                            <Edit2 size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <button
                            onClick={handleAddExpense}
                            className="bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white p-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    {selectedCategory && (
                        <div className="mb-4">
                            <span className={cn(
                                "text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest",
                                selectedCategory.is_presupuesto
                                    ? (isBudgetOk ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")
                                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            )}>
                                {selectedCategory.is_presupuesto ? 'Presupuesto' : (selectedCategory.cash_expense ? 'Contado' : 'Crédito')}
                            </span>
                        </div>
                    )}

                    <div className="space-y-4">
                        {(selectedCategory?.expenses ?? budget.expenses.filter(e => e.category_name === selectedCategoryName)).length === 0 ? (
                            <p className="text-center text-sm text-gray-400 font-bold py-6">
                                {dateFilter ? 'No hay gastos en esa fecha' : 'Sin gastos todavía'}
                            </p>
                        ) : (selectedCategory?.expenses ?? budget.expenses.filter(e => e.category_name === selectedCategoryName)).map(expense => (
                            <div key={expense.id} className="flex justify-between items-center group select-none" onDoubleClick={() => handleEditExpense(expense)}>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm dark:text-white group-hover:text-[#FF8A3D] transition-colors">
                                            {expense.label}
                                        </p>
                                        <div className="hidden group-hover:flex items-center gap-1">
                                            <button onClick={() => handleDeleteExpense(expense)} className="p-1 text-gray-400 hover:text-red-500" title="Eliminar gasto">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                        {new Date(expense.timestamp).toLocaleDateString('es-ES')} {new Date(expense.timestamp).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className={cn(
                                        "font-black text-sm transition-colors",
                                        selectedCategory?.is_presupuesto
                                            ? (isBudgetOk ? "text-green-600 dark:text-green-400" : "text-red-500")
                                            : "dark:text-white"
                                    )}>
                                        Bs {parseFloat(expense.amount_bs).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-bold">
                                        $ {(parseFloat(expense.amount_bs) / parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />

                    <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-gray-400 uppercase tracking-widest">TOTAL</span>
                        <div className="text-right">
                            <span className={cn(
                                "font-black text-lg transition-colors block",
                                selectedCategory?.is_presupuesto
                                    ? (isBudgetOk ? "text-green-600 dark:text-green-400" : "text-red-500")
                                    : "dark:text-white"
                            )}>
                                Bs {parseFloat((selectedCategory?.expenses ?? budget.expenses.filter(e => e.category_name === selectedCategoryName)).reduce((sum, e) => sum + parseFloat(e.amount_bs), 0) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold">
                                $ {budget.income_rate > 0 ? (parseFloat((selectedCategory?.expenses ?? budget.expenses.filter(e => e.category_name === selectedCategoryName)).reduce((sum, e) => sum + parseFloat(e.amount_bs), 0) || 0) / parseFloat(budget.income_rate)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                            </span>
                        </div>
                    </div>
                </div>

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
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={1}
                            onDragEnd={handleDragEnd}
                            className="absolute w-full pr-8 space-y-6 pb-24"
                        >
                            <RateHistoryDashboard
                                rate={rate}
                                points={rateSeriesByRange[rateRange] || null}
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
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={1}
                            onDragEnd={handleDragEnd}
                            className="absolute w-full pr-8 space-y-6 pb-24"
                        >
                             <SavingsDashboard
                                budget={budget}
                                savingsLedger={savingsLedger || []}
                                onSelectPool={(poolName) => setSelectedPool(poolName)}
                                onEditTransfer={(t) => setEditingTransfer(t)}
                                onAddSaving={(transaction) => {
                                    setEditingSaving(transaction);
                                    setShowSavingsModal(true);
                                }}
                                onTransfer={() => setShowTransferModal(true)}
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
                show={showExpenseModal}
                onClose={() => setShowExpenseModal(false)}
                expense={editingExpense}
                categoryName={selectedCategoryName}
                monthId={budget.month_id}
                defaultRate={budget.income_rate}
            />

            <BudgetForm
                show={showBudgetModal}
                onClose={() => setShowBudgetModal(false)}
                budget={budget}
            />

            <DebtForm
                show={showDebtModal}
                onClose={() => setShowDebtModal(false)}
                debt={editingDebt}
                monthId={budget.month_id}
            />

            <CategoryForm
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
                show={showSavingsModal}
                onClose={() => setShowSavingsModal(false)}
                transaction={editingSaving}
                monthId={budget.month_id}
                defaultRate={budget.income_rate}
            />

            <Suspense fallback={null}>
                {showDebtSummary && (
                    <DebtSummaryModal
                        show={showDebtSummary}
                        onClose={() => setShowDebtSummary(false)}
                        debts={budget.debts}
                        creditPurchasesBs={creditPurchasesBs}
                        currentRate={budget.income_rate}
                    />
                )}
                                {selectedPool && (
                    <SavingsPoolSummaryModal
                        show={selectedPool !== null}
                        onClose={() => setSelectedPool(null)}
                        pool={selectedPool}
                        pools={budget.savings_pools || []}
                        savingsLedger={savingsLedger || []}
                        currentRate={budget.income_rate}
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
                        <button disabled={!dateFilter} onClick={() => { setShowSettingsModal(false); if (confirm('¿Limpiar los gastos de ESTE DÍA?')) router.post(route('settings.clear-day', budget.month_id), { date: dateFilter }); }} className="menu-button" disabled:opacity-40>Limpiar datos del día</button>
                        <button onClick={() => { setShowSettingsModal(false); if (confirm(`¿Limpiar todo el mes de ${budget.month_label}?`)) router.post(route('settings.clear-month', budget.month_id)); }} className="menu-button">Limpiar mes actual</button>
                        <button onClick={() => { setShowSettingsModal(false); if (confirm('¿Llenar con datos de prueba? Esto reemplazará los últimos 4 meses.')) router.post(route('settings.seed-mock')); }} className="menu-button">Llenar datos de prueba</button>
                        <button onClick={() => { setShowSettingsModal(false); if (confirm('¡PELIGRO! ¿Borrar TODOS los meses y datos?')) router.post(route('settings.clear')); }} className="menu-button text-red-600 dark:text-red-400">Limpiar todos los datos</button>
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

            <TransferModal
                show={showTransferModal || editingTransfer !== null || movementPool !== null}
                onClose={() => {
                    setShowTransferModal(false);
                    setEditingTransfer(null);
                    setMovementPool(null);
                }}
                monthId={budget.month_id}
                transfer={editingTransfer}
                pool={movementPool}
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

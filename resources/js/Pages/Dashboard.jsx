import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage, router } from '@inertiajs/react';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import BalanceCard from '@/Components/Budget/BalanceCard';
import BudgetGraph from '@/Components/Budget/BudgetGraph';
import ExpenseForm from '@/Components/Budget/ExpenseForm';
import BudgetForm from '@/Components/Budget/BudgetForm';
import DebtForm from '@/Components/Budget/DebtForm';
import CategoryForm from '@/Components/Budget/CategoryForm';
import CategoryAccordion from '@/Components/Budget/CategoryAccordion';
import BudgetCalendar from '@/Components/Budget/BudgetCalendar';
import SavingsDashboard from '@/Components/Budget/SavingsDashboard';
import SavingsForm from '@/Components/Budget/SavingsForm';
import TransferModal from '@/Components/Budget/TransferModal';
import Dropdown from '@/Components/Dropdown';
import { Plus, Moon, Sun, MoreVertical, Calendar as CalendarIcon, Home, Edit2, Trash2, CreditCard, Settings as SettingsIcon, Wallet, ArrowRightLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

const DebtSummaryModal = lazy(() => import('@/Components/Budget/DebtSummaryModal'));

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
        budget, monthIds, version, auth, contextRate, dateFilter, today, currentMonthId, rate,
    } = usePage().props;

    const [isDark, setIsDark] = useState(false);
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

    // View state for swipeable dashboard (0 = Main, 1 = Savings)
    const [currentViewIndex, setCurrentViewIndex] = useState(0);

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

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle('dark');
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

    const creditPurchasesBs = budget.categories
        .filter(c => !c.cash_expense)
        .reduce((sum, c) => sum + budget.expenses.filter(e => e.category_name === c.name).reduce((s, e) => s + parseFloat(e.amount_bs), 0), 0);

    const totalDebtBs = budget.debts.reduce((sum, d) => sum + (parseFloat(d.opening_bs) - parseFloat(d.payment_bs)), 0) + creditPurchasesBs;

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
            // Swipe Left -> Go to Savings
            if (currentViewIndex === 0) {
                setDirection(1);
                setCurrentViewIndex(1);
            }
        } else if (swipe > 10000) {
            // Swipe Right -> Go to Main
            if (currentViewIndex === 1) {
                setDirection(-1);
                setCurrentViewIndex(0);
            }
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex justify-between items-center w-full px-4 sm:px-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {isNotToday && (
                            <button
                                onClick={goToToday}
                                title="Ir a hoy"
                                className="p-2 shrink-0 text-white hover:bg-white/10 rounded-full transition-all"
                            >
                                <Home size={20} />
                            </button>
                        )}
                        <button
                            className="flex items-center gap-2 cursor-pointer truncate"
                            onClick={() => setShowCalendar(true)}
                            title="Elegir mes o día"
                        >
                            <h2 className="text-xl sm:text-3xl font-black font-serif text-white uppercase tracking-tight truncate">
                                {headerLabel}
                            </h2>
                        </button>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={() => setShowTransferModal(true)}
                            className="p-2 text-white hover:bg-white/10 rounded-full transition-all"
                            title="Transferir fondos"
                        >
                            <ArrowRightLeft size={20} />
                        </button>

                        <button
                            onClick={() => {
                                setDirection(currentViewIndex === 0 ? 1 : -1);
                                setCurrentViewIndex(currentViewIndex === 0 ? 1 : 0);
                            }}
                            className={cn(
                                "p-2 rounded-full transition-all flex items-center gap-2",
                                currentViewIndex === 1
                                    ? "bg-white text-[#FF8A3D] dark:text-[#9B7BFF]"
                                    : "text-white hover:bg-white/10"
                            )}
                            title={currentViewIndex === 0 ? "Ver Ahorros" : "Ver Presupuesto"}
                        >
                            <Wallet size={20} />
                        </button>

                        <button onClick={toggleTheme} className="p-2 text-white hover:bg-white/10 rounded-full transition-all">
                            {isDark ? <Sun size={24} /> : <Moon size={24} />}
                        </button>
                        <Dropdown>
                            <Dropdown.Trigger>
                                <button className="p-2 text-white hover:bg-white/10 rounded-full transition-all">
                                    <MoreVertical size={24} />
                                </button>
                            </Dropdown.Trigger>
                            <Dropdown.Content
                                align="right"
                                contentClasses="py-1 bg-white dark:bg-gray-900"
                            >
                                <span className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                                    Mantenimiento
                                </span>
                                <Dropdown.Link as="button" onClick={() => { if(confirm('¿Llenar con datos de prueba? Esto reemplazará los últimos 4 meses.')) router.post(route('settings.seed-mock')) }} className="dark:text-gray-200 dark:hover:bg-gray-800 text-left w-full">
                                    Llenar datos de prueba
                                </Dropdown.Link>
                                <Dropdown.Link as="button" onClick={() => { if(confirm('¿Limpiar los gastos de ESTE DÍA?')) router.post(route('settings.clear-day', budget.month_id), { date: dateFilter }) }} className="dark:text-gray-200 dark:hover:bg-gray-800 text-left w-full" disabled={!dateFilter}>
                                    Limpiar datos del día
                                </Dropdown.Link>
                                <Dropdown.Link as="button" onClick={() => { if(confirm(`¿Limpiar todo el mes de ${budget.month_label}?`)) router.post(route('settings.clear-month', budget.month_id)) }} className="dark:text-gray-200 dark:hover:bg-gray-800 text-left w-full">
                                    Limpiar mes actual
                                </Dropdown.Link>
                                <Dropdown.Link as="button" onClick={() => { if(confirm('¡PELIGRO! ¿Borrar TODOS los meses y datos?')) router.post(route('settings.clear')) }} className="text-red-600 dark:hover:bg-gray-800 text-left w-full">
                                    Limpiar todos los datos
                                </Dropdown.Link>

                                {auth?.user ? (
                                    <>
                                        <span className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 border-y border-gray-100 dark:border-gray-800 mt-2">
                                            {auth.user.name}
                                        </span>
                                        <Dropdown.Link href={route('profile.edit')} className="dark:text-gray-200 dark:hover:bg-gray-800">
                                            Mi perfil
                                        </Dropdown.Link>
                                        <Dropdown.Link href={route('settings')} className="dark:text-gray-200 dark:hover:bg-gray-800">
                                            Configuración
                                        </Dropdown.Link>
                                        <form
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                const form = e.target;
                                                fetch(form.action, {
                                                    method: 'POST',
                                                    body: new FormData(form),
                                                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                                                    credentials: 'same-origin',
                                                }).then(() => window.location.reload());
                                            }}
                                            action={route('logout')}
                                            method="POST"
                                        >
                                            <button
                                                type="submit"
                                                className="block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 dark:text-gray-200 dark:hover:bg-gray-800 transition duration-150 ease-in-out hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                                            >
                                                Cerrar sesión
                                            </button>
                                        </form>
                                    </>
                                ) : (
                                    <>
                                        <span className="block px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                                            Cuenta (opcional)
                                        </span>
                                        <Dropdown.Link href={route('settings')} className="dark:text-gray-200 dark:hover:bg-gray-800">
                                            Configuración
                                        </Dropdown.Link>
                                        <Dropdown.Link href={route('login')} className="dark:text-gray-200 dark:hover:bg-gray-800">
                                            Iniciar sesión
                                        </Dropdown.Link>
                                        <Dropdown.Link href={route('register')} className="dark:text-gray-200 dark:hover:bg-gray-800">
                                            Crear cuenta
                                        </Dropdown.Link>
                                    </>
                                )}
                            </Dropdown.Content>
                        </Dropdown>
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
                                    className={cn(
                                        'px-3 py-1 text-xs font-bold rounded-md transition-colors',
                                        rangeMode === mode
                                            ? 'bg-white dark:bg-gray-700 shadow-sm dark:text-white'
                                            : 'text-gray-500 dark:text-gray-400',
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

                    <BudgetGraph
                        budget={budget}
                        categories={visibleCategories}
                    />
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
                        <p className="text-2xl font-black font-serif tracking-tight">
                            Bs {totalDebtBs.toLocaleString('es-ES')}
                        </p>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                            $ {budget.income_rate > 0 ? (totalDebtBs / parseFloat(budget.income_rate)).toLocaleString('es-ES', {minimumFractionDigits: 2}) : '0.00'}
                        </p>
                    </div>

                    <div className="space-y-3">
                        {creditPurchasesBs > 0 && (
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-300 font-medium">Compras a crédito</span>
                                <span className="text-sm font-bold">Bs {creditPurchasesBs.toLocaleString('es-ES')}</span>
                            </div>
                        )}
                        {budget.debts.map(debt => (
                            <div key={debt.id} className="flex justify-between items-center cursor-pointer hover:bg-white/5 p-1 rounded transition-colors" onClick={() => handleEditDebt(debt)}>
                                <span className="text-xs text-gray-300 font-medium">{debt.label}</span>
                                <div className="text-right">
                                    <p className="text-sm font-bold">Bs {(parseFloat(debt.opening_bs) - parseFloat(debt.payment_bs)).toLocaleString('es-ES')}</p>
                                    {parseFloat(debt.payment_bs) > 0 && (
                                        <p className="text-[10px] text-green-400 font-bold">Pagado: Bs {parseFloat(debt.payment_bs).toLocaleString('es-ES')}</p>
                                    )}
                                </div>
                            </div>
                        ))}
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
                            <div key={expense.id} className="flex justify-between items-center group">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm dark:text-white group-hover:text-[#FF8A3D] transition-colors">
                                            {expense.label}
                                        </p>
                                        <div className="hidden group-hover:flex items-center gap-1">
                                            <button onClick={() => handleEditExpense(expense)} className="p-1 text-gray-400 hover:text-blue-500">
                                                <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => handleDeleteExpense(expense)} className="p-1 text-gray-400 hover:text-red-500">
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
                                        Bs {parseFloat(expense.amount_bs).toLocaleString('es-ES')}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-bold">
                                        $ {(parseFloat(expense.amount_bs) / parseFloat(budget.income_rate)).toLocaleString('es-ES', {minimumFractionDigits: 2})}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />

                    <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-gray-400 uppercase tracking-widest">TOTAL</span>
                        <span className={cn(
                            "font-black text-lg transition-colors",
                            selectedCategory?.is_presupuesto
                                ? (isBudgetOk ? "text-green-600 dark:text-green-400" : "text-red-500")
                                : "dark:text-white"
                        )}>
                            Bs {parseFloat((selectedCategory?.expenses ?? budget.expenses.filter(e => e.category_name === selectedCategoryName)).reduce((sum, e) => sum + parseFloat(e.amount_bs), 0) || 0).toLocaleString('es-ES')}
                        </span>
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
                                onAddSaving={(transaction) => {
                                    setEditingSaving(transaction);
                                    setShowSavingsModal(true);
                                }}
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
                        currentRate={budget.income_rate}
                    />
                )}
            </Suspense>

            <TransferModal
                show={showTransferModal}
                onClose={() => setShowTransferModal(false)}
                monthId={budget.month_id}
                defaultRate={budget.income_rate}
                categories={budget.categories}
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

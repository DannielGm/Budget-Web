import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, usePage } from '@inertiajs/react';
import React, { useState } from 'react';
import BalanceCard from '@/Components/Budget/BalanceCard';
import BudgetGraph from '@/Components/Budget/BudgetGraph';
import { ChevronDown, Plus, Moon, Sun, MoreVertical, Calendar as CalendarIcon, Home } from 'lucide-react';

export default function Dashboard() {
    const { budget, monthIds, version, auth } = usePage().props;
    const [isDark, setIsDark] = useState(false);
    const [selectedCategoryName, setSelectedCategoryName] = useState(budget.categories[0]?.name);
    const [showMonthMenu, setShowMonthMenu] = useState(false);

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.documentElement.classList.toggle('dark');
    };

    const selectedCategory = budget.categories.find(c => c.name === selectedCategoryName);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex justify-between items-center w-full px-4 sm:px-0">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => setShowMonthMenu(!showMonthMenu)}>
                        <h2 className="text-3xl font-black font-serif text-white uppercase tracking-tight">
                            {budget.month_label}
                        </h2>
                        <ChevronDown className="text-white" size={24} />
                    </div>

                    <div className="flex items-center gap-1">
                        <button onClick={toggleTheme} className="p-2 text-white hover:bg-white/10 rounded-full transition-all">
                            {isDark ? <Sun size={24} /> : <Moon size={24} />}
                        </button>
                        <button className="p-2 text-white hover:bg-white/10 rounded-full transition-all">
                            <MoreVertical size={24} />
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="py-6 max-w-lg mx-auto px-4 space-y-6">
                <BalanceCard
                    budget={budget}
                    contextRate={budget.income_rate}
                    onEdit={() => console.log('Edit')}
                />

                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="font-bold text-lg dark:text-white">Flujo</h3>
                        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                            <button className="px-3 py-1 text-xs font-bold rounded-md bg-white dark:bg-gray-700 shadow-sm">Mes</button>
                            <button className="px-3 py-1 text-xs font-bold text-gray-500">7d</button>
                            <button className="px-3 py-1 text-xs font-bold text-gray-500">1d</button>
                        </div>
                    </div>
                    <BudgetGraph budget={budget} />
                </div>

                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-lg dark:text-white uppercase tracking-wide">
                            {selectedCategory?.name || 'Categoría'}
                        </h4>
                        <button className="bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white p-2 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all">
                            <Plus size={20} />
                        </button>
                    </div>

                    <div className="space-y-4">
                        {selectedCategory?.expenses?.map(expense => (
                            <div key={expense.id} className="flex justify-between items-center group">
                                <div className="space-y-1">
                                    <p className="font-bold text-sm dark:text-white group-hover:text-[#FF8A3D] transition-colors">
                                        {expense.label}
                                    </p>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                        {new Date(expense.timestamp).toLocaleDateString('es-ES')} {new Date(expense.timestamp).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-sm dark:text-white">
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
                        <span className="font-bold text-xs text-gray-400">TOTAL</span>
                        <span className="font-black text-lg dark:text-white">
                            Bs {parseFloat(selectedCategory?.expenses?.reduce((sum, e) => sum + parseFloat(e.amount_bs), 0) || 0).toLocaleString('es-ES')}
                        </span>
                    </div>
                </div>

                <footer className="text-center pb-8">
                    <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                        Presupuesto {version}
                    </p>
                </footer>
            </div>

            {/* Simple Category Selector - Bottom Sheet or Horizontal Scroll */}
            <div className="fixed bottom-6 left-0 right-0 flex justify-center px-4 pointer-events-none">
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl p-1 shadow-2xl flex gap-1 pointer-events-auto overflow-x-auto max-w-full no-scrollbar">
                    {budget.categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategoryName(cat.name)}
                            className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                selectedCategoryName === cat.name
                                    ? "bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white shadow-md"
                                    : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

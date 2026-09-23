import React, { useState, useEffect } from 'react';
import Modal from '@/Components/Modal';
import { Plus, Trash2, Edit2, ChevronRight, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function CategoryAccordion({
    show,
    onClose,
    categories,
    selectedCategoryName,
    onSelect,
    onCreate,
    onEdit
}) {
    const [activeCategory, setActiveCategory] = useState(selectedCategoryName);

    useEffect(() => {
        if (show) {
            setActiveCategory(selectedCategoryName);
        }
    }, [show, selectedCategoryName]);

    const activeCatObj = categories.find(c => c.name === activeCategory);

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter">
                        Categorías
                    </h2>
                    <button
                        onClick={() => { onCreate(); onClose(); }}
                        className="p-2 bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white rounded-xl shadow-md active:scale-95 transition-all"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 no-scrollbar">
                    {categories.map((cat) => {
                        const isSelected = cat.name === activeCategory;
                        return (
                            <div
                                key={cat.id}
                                className={cn(
                                    "group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none",
                                    isSelected
                                        ? "bg-orange-50 dark:bg-purple-900/20 border-[#FF8A3D] dark:border-[#9B7BFF]"
                                        : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                                )}
                                onClick={() => setActiveCategory(cat.name)}
                                onDoubleClick={() => {
                                    onSelect(cat.name);
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        cat.is_presupuesto ? "bg-blue-400" : (cat.cash_expense ? "bg-green-400" : "bg-red-400")
                                    )} />
                                    <span className={cn(
                                        "font-bold text-sm uppercase tracking-wide",
                                        isSelected ? "text-[#FF8A3D] dark:text-[#9B7BFF]" : "text-gray-700 dark:text-gray-300"
                                    )}>
                                        {cat.name}
                                    </span>
                                </div>
                                {isSelected && (
                                    <ChevronRight size={16} className="text-[#FF8A3D] dark:text-[#9B7BFF]" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {activeCatObj && (
                    <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                        <button
                            onClick={() => { onEdit(activeCatObj); onClose(); }}
                            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
                        >
                            Editar
                        </button>
                        <button
                            onClick={() => { onSelect(activeCatObj.name); onClose(); }}
                            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white hover:opacity-90 shadow-sm transition-opacity text-center"
                        >
                            Ver Gastos
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
}

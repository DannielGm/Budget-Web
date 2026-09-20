import React, { useState } from 'react';
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
    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter">
                        Categorías
                    </h2>
                    <button
                        onClick={() => onCreate()}
                        className="p-2 bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white rounded-xl shadow-md active:scale-95 transition-all"
                    >
                        <Plus size={20} />
                    </button>
                </div>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                    {categories.map((cat) => {
                        const isSelected = cat.name === selectedCategoryName;
                        return (
                            <div
                                key={cat.id}
                                className={cn(
                                    "group flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer",
                                    isSelected
                                        ? "bg-orange-50 dark:bg-purple-900/20 border-[#FF8A3D] dark:border-[#9B7BFF]"
                                        : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                                )}
                                onClick={() => onSelect(cat.name)}
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

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(cat); }}
                                        className="p-1.5 text-gray-400 hover:text-blue-500"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </Modal>
    );
}

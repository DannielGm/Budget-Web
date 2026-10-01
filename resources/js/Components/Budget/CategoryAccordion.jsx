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
        <Modal show={show} onClose={onClose} maxWidth="sm" labelledBy="category-accordion-title">
            <div className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex justify-between items-center mb-6">
                    <h2 id="category-accordion-title" className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter">
                        Categorías
                    </h2>
                    <button
                        type="button"
                        onClick={() => { onCreate(); onClose(); }}
                        aria-label="Nueva categoría"
                        className="touch-feedback p-2 bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white rounded-xl shadow-md active:scale-95 transition-transform"
                    >
                        <Plus size={20} aria-hidden="true" />
                    </button>
                </div>

                <ul className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 no-scrollbar">
                    {categories.map((cat) => {
                        const isSelected = cat.name === activeCategory;
                        return (
                            /* A real button, and one tap selects.
                               This row was a div with onClick, and committing the
                               choice needed a DOUBLE click on top of it. A
                               double-tap is not a gesture a touch screen reports
                               reliably, and it is unreachable by keyboard
                               entirely, so on the device this app is built for the
                               selection could only be made through the footer
                               buttons below -- after the row had already been
                               picked by tap. "Ver gastos" is the action, and it
                               is right there, labelled. */
                            <li key={cat.id} className="list-none">
                            <button
                                type="button"
                                aria-pressed={isSelected}
                                className={cn(
                                    "group flex w-full items-center justify-between p-3 rounded-2xl border transition-colors duration-150 select-none",
                                    isSelected
                                        ? "bg-orange-50 dark:bg-purple-900/20 border-[#FF8A3D] dark:border-[#9B7BFF]"
                                        : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                                )}
                                onClick={() => setActiveCategory(cat.name)}
                            >
                                <span className="flex items-center gap-3">
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "w-2 h-2 rounded-full",
                                            cat.is_presupuesto ? "bg-blue-400" : (cat.cash_expense ? "bg-green-400" : "bg-red-400")
                                        )}
                                    />
                                    <span className={cn(
                                        "font-bold text-sm uppercase tracking-wide",
                                        isSelected ? "text-[#FF8A3D] dark:text-[#9B7BFF]" : "text-gray-700 dark:text-gray-300"
                                    )}>
                                        {cat.name}
                                    </span>
                                </span>
                                {isSelected && (
                                    <ChevronRight size={16} className="shrink-0 text-[#FF8A3D] dark:text-[#9B7BFF]" aria-hidden="true" />
                                )}
                            </button>
                            </li>
                        );
                    })}
                </ul>

                {/* A visible way out. This dialog had none: the only exits were
                    the Android back gesture and tapping the backdrop, so on a
                    desktop browser the Cancelar was the only affordance a user
                    could reach by tabbing. */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
                    >
                        Cancelar
                    </button>
                    {activeCatObj ? (
                        <>
                            <button
                                type="button"
                                onClick={() => { onEdit(activeCatObj); onClose(); }}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
                            >
                                Editar
                            </button>
                            <button
                                type="button"
                                onClick={() => { onSelect(activeCatObj.name); onClose(); }}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white hover:opacity-90 shadow-sm transition-opacity text-center"
                            >
                                Ver gastos
                            </button>
                        </>
                    ) : (
                        <p className="flex-1 self-center py-3 text-center text-xs text-gray-400">
                            Elige una categoría para ver sus gastos.
                        </p>
                    )}
                </div>
            </div>
        </Modal>
    );
}

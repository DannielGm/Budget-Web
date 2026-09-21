import React from 'react';
import Modal from '@/Components/Modal';
import { CreditCard, ArrowDownToLine } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function DebtSummaryModal({ show, onClose, debts = [], currentRate }) {
    const allPayments = (debts || []).reduce((acc, debt) => {
        const payments = debt.payments || [];
        return acc.concat(payments.map(p => ({ ...p, debtLabel: debt.label })));
    }, []).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    const totalRemaining = (debts || []).reduce((sum, d) => sum + (parseFloat(d.opening_bs || 0) - parseFloat(d.payment_bs || 0)), 0);

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-[#1A1A1A] p-2 rounded-xl">
                        <CreditCard className="text-white" size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter leading-none">
                            Estado de Deuda
                        </h2>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                            Resumen del Mes
                        </p>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-6 border border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-bold mb-1">Total Pendiente</p>
                    <p className="text-3xl font-black font-serif text-gray-900 dark:text-white tracking-tight">
                        Bs {totalRemaining.toLocaleString('es-ES')}
                    </p>
                    <p className="text-xs text-[#FF8A3D] dark:text-[#9B7BFF] font-bold uppercase tracking-wider mt-1">
                        $ {currentRate > 0 ? (totalRemaining / parseFloat(currentRate)).toLocaleString('es-ES', {minimumFractionDigits: 2}) : '0.00'}
                    </p>
                </div>

                <div className="mb-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800 pb-2">
                        Historial de Pagos
                    </h3>
                </div>

                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
                    {allPayments.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 font-bold py-6">Sin pagos registrados</p>
                    ) : (
                        allPayments.map(p => (
                            <div key={p.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-2 rounded-lg">
                                        <ArrowDownToLine size={16} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm dark:text-white truncate max-w-[120px]">
                                            {p.debtLabel}
                                        </p>
                                        <div className="flex gap-2 items-center">
                                            <span className="text-[10px] text-gray-400 uppercase">{p.method}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(p.timestamp).toLocaleDateString('es-ES')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-sm text-green-600 dark:text-green-400">
                                        Bs {parseFloat(p.amount_bs).toLocaleString('es-ES')}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
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

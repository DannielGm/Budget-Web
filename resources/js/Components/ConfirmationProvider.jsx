import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { AlertTriangle } from 'lucide-react';

const ConfirmationContext = createContext(null);

const toneClasses = {
    danger: {
        icon: 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400',
        action: 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-500',
    },
    warning: {
        icon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
        action: 'bg-amber-600 hover:bg-amber-700 focus-visible:outline-amber-500',
    },
    brand: {
        icon: 'bg-orange-100 text-[#FF8A3D] dark:bg-violet-950/40 dark:text-[#9B7BFF]',
        action: 'bg-[#FF8A3D] hover:bg-[#ff9a58] dark:bg-[#9B7BFF]',
    },
};

export function ConfirmationProvider({ children }) {
    const resolver = useRef(null);
    const [confirmation, setConfirmation] = useState(null);

    const confirmAction = useCallback((options) => new Promise((resolve) => {
        if (resolver.current) resolver.current(false);
        resolver.current = resolve;
        setConfirmation({
            tone: 'danger',
            cancelLabel: 'Cancelar',
            confirmLabel: 'Confirmar',
            ...options,
        });
    }), []);

    const finish = useCallback((confirmed) => {
        setConfirmation(null);
        if (resolver.current) {
            resolver.current(confirmed);
            resolver.current = null;
        }
    }, []);

    const tone = toneClasses[confirmation?.tone] || toneClasses.danger;

    return (
        <ConfirmationContext.Provider value={confirmAction}>
            {children}
            <Modal show={Boolean(confirmation)} onClose={() => finish(false)} maxWidth="sm">
                <div role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" className="p-5">
                    <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                            <AlertTriangle size={22} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 id="confirmation-title" className="text-lg font-bold uppercase tracking-tight text-gray-900 dark:text-white">{confirmation?.title}</h2>
                            <p id="confirmation-message" className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{confirmation?.message}</p>
                            {confirmation?.detail && <p className="mt-2 text-xs leading-5 text-gray-400">{confirmation.detail}</p>}
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <SecondaryButton autoFocus type="button" onClick={() => finish(false)} className="min-h-11 justify-center dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">{confirmation?.cancelLabel}</SecondaryButton>
                        <PrimaryButton type="button" onClick={() => finish(true)} className={`min-h-11 justify-center text-white ${tone.action}`}>{confirmation?.confirmLabel}</PrimaryButton>
                    </div>
                </div>
            </Modal>
        </ConfirmationContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmationContext);
    if (!context) throw new Error('useConfirm must be used inside ConfirmationProvider');
    return context;
}

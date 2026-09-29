import React, { useState } from 'react';
import { useCurrency, currencySymbol, setDisplayCurrency, USD, EUR } from '@/lib/currency';

/**
 * The display-currency switch.
 *
 * It writes the preference through `setDisplayCurrency`, which updates
 * localStorage and the document attribute before reloading, so switching is
 * instant on the way and consistent on the way back. The attribute is what
 * app.jsx reads when it mounts, and what a reload would read from the same place,
 * so the two paths cannot disagree.
 */
export default function CurrencyToggle() {
    const currency = useCurrency();
    const [busy, setBusy] = useState(false);

    const choose = (next) => {
        if (next === currency) return;
        setBusy(true);
        try {
            // One shared implementation: the dashboard header offers the same
            // switch, and two copies of "write the preference, then reload" is
            // how the two drift apart.
            setDisplayCurrency(next);
        } finally {
            setBusy(false);
        }
    };

    const options = [
        { id: USD, label: 'Dólares', symbol: currencySymbol(USD) },
        { id: EUR, label: 'Euros', symbol: currencySymbol(EUR) },
    ];

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Moneda de presentación
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Cambia el símbolo de todas las cifras. Las cifras en bolívares no cambian.
            </p>

            <div
                role="radiogroup"
                aria-label="Moneda de presentación"
                className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
            >
                {options.map((option) => {
                    const isCurrent = option.id === currency;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            role="radio"
                            aria-checked={isCurrent}
                            disabled={busy}
                            onClick={() => choose(option.id)}
                            className={`touch-feedback min-h-11 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-[#FF8A3D] focus-visible:ring-offset-2 dark:focus-visible:ring-[#9B7BFF] ${
                                isCurrent
                                    ? 'bg-white text-[#FF8A3D] shadow-sm dark:bg-gray-700 dark:text-[#9B7BFF]'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                        >
                            {option.symbol} {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

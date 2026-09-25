import React, { useEffect, useRef, useState } from 'react';
import { BarChart3, TrendingUp, Wallet, Home, Moon, Sun, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const VIEWS = [
    { icon: BarChart3, index: 0, title: 'Presupuesto' },
    { icon: TrendingUp, index: 1, title: 'Tasas BCV' },
    { icon: Wallet, index: 2, title: 'Ahorros' },
];

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function DashboardHeader({ headerLabel, isNotToday, onGoToToday, onOpenCalendar, currentViewIndex, onChangeView, isDark, onToggleTheme, onOpenSettings }) {
    const [open, setOpen] = useState(false);
    const selectorRef = useRef(null);
    const triggerRef = useRef(null);
    const activeView = VIEWS[currentViewIndex] || VIEWS[0];
    const ActiveIcon = activeView.icon;

    const close = (restoreFocus = false) => {
        setOpen(false);
        if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
    };

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event) => {
            if (!selectorRef.current?.contains(event.target)) close();
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') close(true);
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown, { passive: true });
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    return (
        <div className="flex w-full items-center gap-1.5">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
                {isNotToday && (
                    <button type="button" onClick={onGoToToday} title="Ir a hoy" aria-label="Ir a hoy" className="header-icon-button -ml-1">
                        <Home size={19} aria-hidden="true" />
                    </button>
                )}
                <button type="button" onClick={onOpenCalendar} title="Elegir mes o día" aria-label={`Elegir mes o día. Periodo actual: ${headerLabel}`} className="min-w-0 flex-1 rounded-xl px-1 py-2 text-left focus-visible:ring-2 focus-visible:ring-white/80">
                    <span className="block max-w-full truncate whitespace-nowrap font-serif text-lg font-black uppercase tracking-tight text-white sm:text-xl lg:text-2xl">{headerLabel}</span>
                </button>
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
                <div ref={selectorRef} className="relative">
                    <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} className={cn('header-icon-button', open ? 'bg-white text-[#FF8A3D] shadow-sm dark:text-[#9B7BFF]' : 'bg-white/15 hover:bg-white/25')} title={`Vista actual: ${activeView.title}`} aria-label={`Vista actual: ${activeView.title}. Cambiar dashboard`} aria-expanded={open} aria-controls="dashboard-view-selector">
                        <ActiveIcon size={20} aria-hidden="true" />
                    </button>
                    {open && (
                        <div id="dashboard-view-selector" role="menu" aria-label="Dashboards" className="absolute right-0 top-full z-50 mt-1.5 flex w-48 max-w-[calc(100vw-1rem)] flex-col gap-1 overscroll-contain rounded-2xl border border-gray-200 bg-white p-1 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
                            {VIEWS.map(({ icon: Icon, index, title }) => {
                                const isCurrent = currentViewIndex === index;
                                return (
                                    <button key={index} type="button" role="menuitemradio" aria-checked={isCurrent} aria-current={isCurrent ? 'page' : undefined} onClick={() => { if (index !== currentViewIndex) onChangeView(index); close(true); }} className={cn('touch-feedback flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-bold', isCurrent ? 'bg-[#FF8A3D] text-white shadow-sm dark:bg-[#9B7BFF]' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800')}>
                                        <Icon size={17} className="shrink-0" aria-hidden="true" /><span>{title}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <button type="button" onClick={onToggleTheme} className="header-icon-button" title={isDark ? 'Activar tema claro' : 'Activar tema oscuro'} aria-label={isDark ? 'Activar tema claro' : 'Activar tema oscuro'}>
                    {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
                </button>
                <button type="button" onClick={onOpenSettings} className="header-icon-button" aria-label="Abrir configuración">
                    <SettingsIcon size={20} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

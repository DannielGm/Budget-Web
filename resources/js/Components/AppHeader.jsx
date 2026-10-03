import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowLeftRight,
    Home,
    MoreHorizontal,
    Moon,
    Settings as SettingsIcon,
    Sun,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { router } from '@inertiajs/react';
import { useCurrency, currencySymbol, setDisplayCurrency, counterpartOf, EUR } from '@/lib/currency';
import useMenuDismiss from '@/hooks/useMenuDismiss';
import { remeasureFitText } from '@/hooks/useFitText';
import useTheme from '@/hooks/useTheme';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const MENU_ID = 'app-header-overflow';

/**
 * The one header every signed-in screen renders.
 *
 * It used to be `DashboardHeader`, imported by Dashboard.jsx and nothing else, so
 * Savings, Análisis and Configuración each hand-rolled a second header into the
 * layout's header slot. Four headers, four gutter conventions and two different
 * title sizes that jumped as you navigated. The gutter is the layout's job now
 * (this renders no horizontal padding of its own), the title is a real <h1> on
 * every screen, and the controls that were once four separate buttons are two:
 * a currency pill, and an overflow menu.
 *
 * `back` is a prop rather than a free slot because the four screens disagree about
 * what "back" means -- a real link out to the dashboard, or the "return to today"
 * shortcut -- and both shapes are a single control.
 *
 * The view switcher is a full-width segmented control on its own row rather than a
 * pill in the title row. That is what makes it work on a phone: the old pill hid
 * the view name below the `sm` breakpoint, on the one device where an icon alone
 * cannot say which of the three dashboards you are on, and the name was hidden in
 * exactly the case the code said it existed for.
 */
export default function AppHeader({
    title,
    subtitle,
    onTitleClick,
    titleHint,
    back,
    onGoToToday,
    isNotToday = false,
    views,
    currentViewIndex = 0,
    onChangeView,
    onOpenSettings,
    showSettings = true,
    showCurrency = true,
}) {
    const [isDark, toggleTheme] = useTheme();
    const [menuOpen, setMenuOpen] = useState(false);
    const triggerRef = useRef(null);
    const menuRef = useMenuDismiss(menuOpen, (restoreFocus) => {
        setMenuOpen(false);
        // Closing this menu can leave every fitted figure on the screen sized
        // for a width it no longer has, and nothing resizes, so useFitText never
        // hears about it. This is the one dismiss path -- tap-away, Escape and the
        // Android back gesture all arrive here -- so it is the one place that has
        // to say so. Re-measuring rather than reloading: the figures are already
        // correct, only their size is stale, and a refetch would be a network
        // round trip for a layout that has already settled.
        remeasureFitText();
        if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
    });

    // The switch reads as the currency it moves TO, not the one on screen, so the
    // label is the action. A switch labelled with the currency you are already in
    // reads as a no-op.
    const currency = useCurrency();
    const otherCurrency = counterpartOf(currency);
    const otherName = otherCurrency === EUR ? 'euros' : 'dólares';

    // A menu is a keyboard widget, not a list that happens to be visible: once it
    // is open the arrow keys have to move between its rows. Tab would walk out of
    // the menu and into the page behind it, which is never what the user meant.
    const onMenuKeyDown = (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const rows = [...(menuRef.current?.querySelectorAll('[role^="menuitem"]') ?? [])];
        if (!rows.length) return;
        const at = rows.indexOf(document.activeElement);
        const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? rows.length - 1
                : (at + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
        rows[next].focus();
    };

    // Opening the menu should land the keyboard on a row, not leave it on the
    // trigger with the panel open behind it.
    useEffect(() => {
        if (!menuOpen) return;
        menuRef.current?.querySelector('[role^="menuitem"]')?.focus();
    }, [menuOpen, menuRef]);

    return (
        <div className="w-full">
            <div className="flex items-center gap-1.5">
                {back && (
                    <a
                        href={back.href}
                        onClick={(event) => {
                            if (back.onClick) return back.onClick(event);
                            // No caller handler means a bare href, and a bare href
                            // is a full document load: the SPA unmounts, the app
                            // re-bootstraps, and the state the user just set up is
                            // gone. Inertia keeps the page alive. Modified clicks
                            // are still left to the browser, so open-in-new-tab
                            // and middle-click behave as they do on any link.
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                            event.preventDefault();
                            router.visit(back.href);
                        }}
                        className="header-icon-button shrink-0"
                        title={back.label}
                        aria-label={back.label}
                    >
                        {back.icon === 'home'
                            ? <Home size={20} aria-hidden="true" />
                            : <ArrowLeft size={20} aria-hidden="true" />}
                    </a>
                )}

                {/* Always present, never mounted on the spot. It used to appear and
                    disappear with `isNotToday`, which shoved the title sideways every
                    time the month changed; now it dims out of the way instead. */}
                {onGoToToday && (
                    <button
                        type="button"
                        onClick={onGoToToday}
                        disabled={!isNotToday}
                        title="Ir a hoy"
                        aria-label="Ir a hoy"
                        className={cn('header-icon-button shrink-0', !isNotToday && 'opacity-40')}
                    >
                        <Home size={19} aria-hidden="true" />
                    </button>
                )}

                <div className="min-w-0 flex-1">
                    <h1 className="min-w-0 font-serif text-2xl font-black uppercase leading-tight tracking-tight text-white lg:text-3xl">
                        {onTitleClick ? (
                            <button
                                type="button"
                                onClick={onTitleClick}
                                title={titleHint || title}
                                aria-label={titleHint || title}
                                className="touch-feedback block max-w-full truncate rounded-xl px-1 py-1 text-left hover:bg-white/10"
                            >
                                {title}
                            </button>
                        ) : (
                            <span className="block truncate px-1 py-1">{title}</span>
                        )}
                    </h1>
                    {subtitle && (
                        <p className="truncate px-1 text-[10px] font-bold uppercase tracking-widest text-white/60">
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                    {showCurrency && (
                        <button
                            type="button"
                            onClick={() => setDisplayCurrency(otherCurrency)}
                            className="header-pill-button bg-white/15 px-3 hover:bg-white/25"
                            title={`Ver en ${otherName}`}
                            aria-label={`Ver las cifras en ${otherName}`}
                        >
                            <ArrowLeftRight size={18} aria-hidden="true" />
                            <span className="text-[11px] font-black">{currencySymbol(otherCurrency)}</span>
                        </button>
                    )}

                    <div ref={menuRef} className="relative">
                        <button
                            ref={triggerRef}
                            type="button"
                            onClick={() => setMenuOpen((value) => !value)}
                            className={cn('header-icon-button', menuOpen ? 'bg-white/25' : 'hover:bg-white/15')}
                            title="Más opciones"
                            aria-label="Más opciones"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            aria-controls={menuOpen ? MENU_ID : undefined}
                        >
                            <MoreHorizontal size={20} aria-hidden="true" />
                        </button>


                        {menuOpen && (
                            <div
                                id={MENU_ID}
                                role="menu"
                                aria-label="Opciones"
                                onKeyDown={onMenuKeyDown}
                                className="absolute right-0 top-full z-50 mt-1.5 flex w-60 max-w-[calc(100vw-1rem)] flex-col gap-1 overscroll-contain rounded-2xl border border-gray-200 bg-white p-1.5 shadow-2xl dark:border-gray-800 dark:bg-gray-900"
                            >
                                <button
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={isDark}
                                    onClick={toggleTheme}
                                    className="touch-feedback flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    {isDark
                                        ? <Sun size={17} className="shrink-0" aria-hidden="true" />
                                        : <Moon size={17} className="shrink-0" aria-hidden="true" />}
                                    <span>{isDark ? 'Tema claro' : 'Tema oscuro'}</span>
                                </button>

                                {showSettings && onOpenSettings && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                                        className="touch-feedback flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                        <SettingsIcon size={17} className="shrink-0" aria-hidden="true" />
                                        <span>Configuración</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* The view switcher doubles as the swipe affordance: the three
                dashboards are a swipe with no other sign they are swipeable, and
                the active segment is the only thing telling you where you are. */}
            {views && (
                <div role="group" aria-label="Dashboards" className="mt-1.5 flex gap-1 rounded-2xl bg-white/15 p-1">
                    {views.map(({ icon: Icon, index, title: viewTitle }) => {
                        const isCurrent = index === currentViewIndex;
                        return (
                            <button
                                key={index}
                                type="button"
                                onClick={() => { if (!isCurrent) onChangeView(index); }}
                                aria-current={isCurrent ? 'page' : undefined}
                                className={cn(
                                    'touch-feedback flex min-h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-black uppercase tracking-wide',
                                    /* The active chip is white, and the brand orange on
                                       white is about 2.5:1 -- unreadable at 11px
                                       bold. Orange-700 reads at ~4.6:1 on the same
                                       white and is still visibly the brand. Same
                                       reasoning for the dark-mode violet on white. */
                                    isCurrent
                                        ? 'bg-white text-orange-700 shadow-sm dark:text-violet-700'
                                        : 'text-white/80 hover:bg-white/15 hover:text-white',
                                )}
                            >
                                <Icon size={15} className="shrink-0" aria-hidden="true" />
                                <span className="truncate">{viewTitle}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

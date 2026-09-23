import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/Components/Modal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MONTH_SHORT = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const MIN_YEAR = 1;

const monthIdOf = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * Web port of the Kotlin app's BudgetCalendar composable: a month/day
 * picker dialog with multi-month navigation, a year jump input and a
 * Monday-first grid. Days after today are disabled.
 *
 * Modes:
 *  - select (default): "Ver día" / "Ver mes" actions.
 *  - pickDay: single "Elegir fecha" action (used by the expense editor).
 */
export default function BudgetCalendar({
    show,
    onClose,
    onSelect,
    initialMonthId,
    initialDayIso = null,
    mode = 'select',
    title = 'Seleccionar fecha',
}) {
    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const todayMonthId = useMemo(() => monthIdOf(today), [today]);
    const maxYear = today.getFullYear();

    const initial = useMemo(() => {
        const [y, m, d] = (initialMonthId ?? todayMonthId).split('-').map(Number);
        const day = initialDayIso ? Number(initialDayIso.split('-')[2]) : null;
        return { year: y, monthIndex: m - 1, day };
    }, [initialMonthId, initialDayIso, todayMonthId]);

    const [viewYear, setViewYear] = useState(initial.year);
    const [viewMonth, setViewMonth] = useState(initial.monthIndex);
    const [yearInput, setYearInput] = useState(String(initial.year));
    const [selectedDay, setSelectedDay] = useState(initial.day);

    useEffect(() => {
        if (!show) return;
        setViewYear(initial.year);
        setViewMonth(initial.monthIndex);
        setYearInput(String(initial.year));
        setSelectedDay(initial.day);
    }, [show, initial]);

    const clampMonth = (year, monthIndex) => {
        const clampedYear = Math.min(Math.max(year, MIN_YEAR), maxYear);
        if (clampedYear === maxYear) {
            return { year: clampedYear, monthIndex: Math.min(monthIndex, today.getMonth()) };
        }
        return { year: clampedYear, monthIndex };
    };

    const shiftMonth = (delta) => {
        let year = viewYear;
        let monthIndex = viewMonth + delta;
        if (monthIndex < 0) { monthIndex = 11; year -= 1; }
        if (monthIndex > 11) { monthIndex = 0; year += 1; }
        const clamped = clampMonth(year, monthIndex);
        setViewYear(clamped.year);
        setViewMonth(clamped.monthIndex);
        setYearInput(String(clamped.year));
        setSelectedDay(null);
    };

    const goToStringYear = () => {
        const parsed = parseInt(yearInput, 10);
        if (Number.isNaN(parsed)) {
            setYearInput(String(viewYear));
            return;
        }
        const clamped = clampMonth(parsed, viewMonth);
        setViewYear(clamped.year);
        setViewMonth(clamped.monthIndex);
        setYearInput(String(clamped.year));
        setSelectedDay(null);
    };

    const grid = useMemo(() => {
        const first = new Date(viewYear, viewMonth, 1);
        const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
        // Monday-first offset (0 = Monday).
        const offset = (first.getDay() + 6) % 7;
        const weeks = Math.ceil((offset + daysInMonth) / 7);
        const cells = [];
        for (let i = 0; i < weeks * 7; i += 1) {
            const dayNumber = i - offset + 1;
            cells.push(dayNumber >= 1 && dayNumber <= daysInMonth ? dayNumber : null);
        }
        return cells;
    }, [viewYear, viewMonth]);

    const dayIso = (dayNumber) =>
        `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;

    const canGoNext = viewYear < maxYear || viewMonth < today.getMonth();

    const emit = (withDay) => {
        const iso = withDay && selectedDay ? dayIso(selectedDay) : null;
        onSelect(monthIdOf(new Date(viewYear, viewMonth, 1)), iso);
        onClose();
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight mb-4">
                    {title}
                </h2>

                <div className="flex items-center justify-between mb-4">
                    <button
                        type="button"
                        onClick={() => shiftMonth(-1)}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200"
                        aria-label="Mes anterior"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <p className="text-base font-black uppercase text-gray-900 dark:text-gray-100">
                        {MONTH_NAMES[viewMonth]} {viewYear}
                    </p>

                    <button
                        type="button"
                        onClick={() => shiftMonth(1)}
                        disabled={!canGoNext}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Mes siguiente"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center justify-center gap-2 mb-4">
                    <span className="text-xs font-bold text-gray-400 uppercase">Año</span>
                    <input
                        type="number"
                        value={yearInput}
                        min={MIN_YEAR}
                        max={maxYear}
                        onChange={(e) => setYearInput(e.target.value)}
                        onBlur={goToStringYear}
                        onKeyDown={(e) => e.key === 'Enter' && goToStringYear()}
                        className="w-20 rounded-lg border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white text-sm px-2 py-1 text-center"
                    />
                    <button
                        type="button"
                        onClick={goToStringYear}
                        className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:opacity-80"
                    >
                        Ir
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                    {DAY_LABELS.map((label) => (
                        <span key={label} className="text-[10px] font-black text-gray-400 uppercase py-1">
                            {label}
                        </span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1 text-center">
                    {grid.map((day, index) => {
                        if (day === null) {
                            return <span key={`empty-${index}`} />;
                        }

                        const iso = dayIso(day);
                        const isFuture = new Date(`${iso}T00:00:00`) > today;
                        const isSelected = selectedDay === day;
                        const isToday = iso === today.toISOString().slice(0, 10);

                        return (
                            <button
                                key={iso}
                                type="button"
                                disabled={isFuture}
                                onClick={() => setSelectedDay(day)}
                                aria-label={`${day} de ${MONTH_NAMES[viewMonth]} de ${viewYear}`}
                                className={
                                    'rounded-full py-1 text-sm font-bold transition-colors ' +
                                    (isSelected
                                        ? 'bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white'
                                        : isFuture
                                            ? 'text-gray-300 dark:text-gray-700 cursor-not-allowed'
                                            : isToday
                                                ? 'text-[#FF8A3D] dark:text-[#9B7BFF] font-black hover:bg-gray-100 dark:hover:bg-gray-800'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800')
                                }
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                    <SecondaryButton onClick={onClose} className="w-full sm:w-auto justify-center dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    {mode === 'pickDay' ? (
                        <PrimaryButton
                            onClick={() => emit(true)}
                            disabled={!selectedDay}
                            className="w-full sm:w-auto justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity"
                        >
                            Elegir fecha
                        </PrimaryButton>
                    ) : (
                        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto">
                            <PrimaryButton
                                onClick={() => emit(true)}
                                disabled={!selectedDay}
                                className="w-full sm:w-auto justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity"
                            >
                                Ver día
                            </PrimaryButton>
                            <PrimaryButton
                                onClick={() => emit(false)}
                                className="w-full sm:w-auto justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity"
                            >
                                Ver mes
                            </PrimaryButton>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export { monthIdOf, MONTH_SHORT };

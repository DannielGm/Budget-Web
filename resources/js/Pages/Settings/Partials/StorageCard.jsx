import { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { useConfirm } from '@/Components/ConfirmationProvider';
import { Card } from './BackupCard';
import BudgetCalendar from '@/Components/Budget/BudgetCalendar';
import { CalendarDays, Database, Trash2 } from 'lucide-react';

const pad = (value) => String(value).padStart(2, '0');
const prettyIso = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

/**
 * Deleting what is stored on the device: one day, one month, or all of it.
 *
 * These actions used to live in the dashboard's overflow menu as well, with
 * different wording and less reach — the dashboard copy could only clear the
 * month that happened to be open. One home, one set of labels, and every
 * action picks its own target.
 *
 * All destructive actions go through the app's ConfirmationProvider rather
 * than the browser's `confirm()`: the native dialog is a blocking system
 * alert that looks nothing like the rest of the app, and on Android it can be
 * dismissed by a stray back gesture — which is not an acceptable answer to
 * "delete everything".
 */
export default function StorageCard({ months = [] }) {
    const confirmAction = useConfirm();
    const { post: postClearDay, processing: clearingDay } = useForm();
    const { post: postClearMonth, processing: clearingMonth } = useForm();
    const { post: postClearAll, processing: clearingAll } = useForm();

    const [monthId, setMonthId] = useState('');
    const [showDayPicker, setShowDayPicker] = useState(false);
    const [dayIso, setDayIso] = useState('');

    const clearDay = async () => {
        if (!dayIso) return;
        // The day belongs to exactly one month; derive it rather than asking
        // for a month and a day that could disagree.
        const targetMonth = dayIso.slice(0, 7);

        const confirmed = await confirmAction({
            title: 'Borrar este día',
            message: `Se eliminarán los gastos, deudas, pagos, ahorros y transferencias del ${prettyIso(dayIso)}.`,
            detail: 'Se conservan el mes, sus categorías y las tasas de cambio. No se puede deshacer.',
            confirmLabel: 'Borrar día',
            tone: 'danger',
        });

        if (confirmed) {
            postClearDay(route('settings.clear-day', targetMonth), {
                month_id: targetMonth,
                date: dayIso,
            });
            setDayIso('');
        }
    };

    const clearMonth = async () => {
        const confirmed = await confirmAction({
            title: 'Borrar este mes',
            message: 'Se eliminarán los gastos, deudas, pagos, ahorros y transferencias del mes seleccionado.',
            detail: 'Se conservan el mes en la lista, sus categorías y las tasas de cambio. No se puede deshacer.',
            confirmLabel: 'Borrar mes',
            tone: 'danger',
        });

        if (confirmed && monthId) {
            postClearMonth(route('settings.clear-month'), { month_id: monthId });
            setMonthId('');
        }
    };

    const clearAll = async () => {
        const confirmed = await confirmAction({
            title: 'Borrar todo',
            message: 'Se eliminarán todos los meses, gastos, deudas, pagos, ahorros y transferencias.',
            detail: 'Las tasas de cambio del BCV se conservan. Si necesitas conservar algo, exporta un respaldo antes de continuar.',
            confirmLabel: 'Borrar todo',
            tone: 'danger',
        });

        if (confirmed) {
            postClearAll(route('settings.clear'));
        }
    };

    const busy = clearingDay || clearingMonth || clearingAll;

    return (
        <Card icon={Trash2} title="Almacenamiento" subtitle="Borra los datos guardados en este dispositivo.">
            <div className="mt-4 space-y-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                        Borrar un día
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setShowDayPicker(true)}
                            disabled={busy}
                            className="flex flex-1 items-center justify-between gap-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-left text-sm font-medium dark:text-white"
                        >
                            <span className={dayIso ? 'tabular' : 'text-gray-400 dark:text-gray-500'}>
                                {dayIso ? prettyIso(dayIso) : 'Elegir fecha...'}
                            </span>
                            <CalendarDays size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={clearDay}
                            disabled={!dayIso || busy}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold shadow transition-colors"
                        >
                            Borrar
                        </button>
                    </div>
                </div>

                {months.length > 0 && (
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                            Borrar un mes
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={monthId}
                                onChange={(event) => setMonthId(event.target.value)}
                                className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                            >
                                <option value="">Seleccionar mes...</option>
                                {months.map((month) => (
                                    <option key={month.month_id} value={month.month_id}>
                                        {month.month_label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={clearMonth}
                                disabled={!monthId || busy}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold shadow transition-colors"
                            >
                                Borrar
                            </button>
                        </div>
                    </div>
                )}

                <div className="h-px bg-red-200 dark:bg-red-800/20" />

                <button
                    type="button"
                    onClick={clearAll}
                    disabled={busy}
                    className="w-full py-3 bg-red-700 hover:bg-red-800 disabled:bg-gray-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                    <Trash2 size={16} aria-hidden="true" />
                    Borrar Todo
                </button>

                <p className="flex items-start gap-1.5 text-[11px] leading-4 text-gray-400 dark:text-gray-500">
                    <Database size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                    Las tasas de cambio del BCV nunca se borran: son la referencia global de la app.
                </p>
            </div>

            <BudgetCalendar
                show={showDayPicker}
                onClose={() => setShowDayPicker(false)}
                mode="pickDay"
                title="Fecha a borrar"
                initialMonthId={dayIso ? dayIso.slice(0, 7) : undefined}
                initialDayIso={dayIso || null}
                onSelect={(calMonthId, pickedDayIso) => {
                    if (!pickedDayIso) return;
                    setDayIso(pickedDayIso);
                }}
            />
        </Card>
    );
}

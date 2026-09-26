import { useState } from 'react';
import { useForm } from '@inertiajs/react';
import { useConfirm } from '@/Components/ConfirmationProvider';
import { Card } from './BackupCard';
import { Trash2 } from 'lucide-react';

/**
 * Deleting data: one month at a time, or all of it.
 *
 * Every action here is destructive and irreversible, so each one is confirmed
 * through the app's ConfirmationProvider rather than the browser's `confirm()`.
 * The native dialog is a blocking system alert that looks nothing like the
 * rest of the app, and on Android it can be dismissed by a stray back gesture —
 * which is not an acceptable answer to "delete everything".
 */
export default function StorageCard({ months = [] }) {
    const confirmAction = useConfirm();
    const { post: postClear, processing: clearing } = useForm();
    const { post: postClearMonth, processing: clearingMonth } = useForm();
    const [monthId, setMonthId] = useState('');

    const clearMonth = async () => {
        const confirmed = await confirmAction({
            title: 'Borrar este mes',
            message: 'Se eliminarán todos los datos del mes seleccionado. Esta acción no se puede deshacer.',
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
            message: 'Se eliminarán todos los meses y sus registros. Esta acción no se puede deshacer.',
            detail: 'Si necesitas conservar algo, exporta un respaldo antes de continuar.',
            confirmLabel: 'Borrar todo',
            tone: 'danger',
        });

        if (confirmed) {
            postClear(route('settings.clear'));
        }
    };

    return (
        <Card icon={Trash2} title="Almacenamiento" subtitle="Borra los datos guardados en este dispositivo.">
            <div className="mt-4 space-y-3">
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
                                disabled={!monthId || clearingMonth}
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
                    disabled={clearing}
                    className="w-full py-3 bg-red-700 hover:bg-red-800 disabled:bg-gray-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                >
                    <Trash2 size={16} />
                    Borrar Todo
                </button>
            </div>
        </Card>
    );
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';
import PrimaryButton from '@/Components/PrimaryButton';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ClipboardPaste,
    Database,
    Download,
    Loader2,
    Share2,
    Trash2,
    Upload,
} from 'lucide-react';

/** How long to wait for the system picker to answer, and how often to ask. */
const STATUS_POLL_MS = 1000;
const STATUS_POLL_TRIES = 20;

export default function Settings() {
    const { version, months = [], monthIds = [], native = {}, flash = {}, errors = {} } = usePage().props;
    const { post: postClear, processing: processingClear } = useForm();
    const { post: postClearMonth } = useForm();

    const [pasted, setPasted] = useState('');
    const [showPaste, setShowPaste] = useState(false);
    const [waiting, setWaiting] = useState(false);
    const [pickerMessage, setPickerMessage] = useState(null);
    const [pickedAt, setPickedAt] = useState(null);
    const [pickerResult, setPickerResult] = useState(null);

    const canSaveToDevice = Boolean(native.canSave);
    const canShare = Boolean(native.canShare);
    const canUseDevicePicker = Boolean(native.canPick);

    // A restore wipes everything first, so it is confirmed before it starts —
    // the same guard the danger zone below uses.
    const confirmRestore = () =>
        confirm('¿Restaurar este respaldo? Todos los datos actuales serán reemplazados.');

    const handleExport = (mode) => {
        // Without the native pickers a download is the only transport there is,
        // and in a browser it is also the better one.
        if (!canSaveToDevice && !canShare) {
            window.location.href = route('export');
            return;
        }

        router.post(route('backup.export'), { mode }, { preserveScroll: true });
    };

    const handlePickFile = () => {
        setPickerResult(null);
        setPickerMessage('Elige el archivo de respaldo en tu dispositivo...');
        setPickedAt(new Date().toISOString());
        setWaiting(true);

        router.post(route('backup.import.pick'), {}, {
            preserveScroll: true,
            onError: (validationErrors) => {
                setWaiting(false);
                setPickerMessage(null);
                setPickerResult({
                    status: 'error',
                    message: validationErrors.file || 'No se pudo abrir el explorador de archivos.',
                });
            },
        });
    };

    // The picker answers long after its own request returned, and into a request
    // of its own with no page attached — so the outcome is polled for instead of
    // awaited.
    useEffect(() => {
        if (!waiting || pickedAt === null) return;

        let attempts = 0;

        const timer = setInterval(async () => {
            attempts += 1;

            try {
                const { data } = await window.axios.get(route('backup.status'));
                const result = data?.result;

                if (result && new Date(result.at) >= new Date(pickedAt)) {
                    setWaiting(false);
                    setPickerMessage(null);
                    setPickerResult(result);

                    if (result.status === 'ok') {
                        router.reload({ only: ['months', 'monthIds'] });
                    }

                    return;
                }
            } catch (e) {
                // A failed poll is not a failed import — keep waiting.
            }

            if (attempts >= STATUS_POLL_TRIES) {
                setWaiting(false);
                setPickerMessage(null);
                setPickerResult({
                    status: 'cancelled',
                    message: 'No se recibió respuesta del selector de archivos.',
                });
            }
        }, STATUS_POLL_MS);

        return () => clearInterval(timer);
    }, [waiting, pickedAt]);

    const handleImportFile = (e) => {
        const file = e.target.files?.[0];
        if (!file || !confirmRestore()) return;

        const formData = new FormData();
        formData.append('file', file);

        router.post(route('import'), formData, {
            preserveScroll: true,
            forceFormData: true,
            onFinish: () => {
                e.target.value = '';
            },
        });
    };

    const handlePasteImport = (e) => {
        e.preventDefault();
        if (!pasted.trim() || !confirmRestore()) return;

        router.post(route('import'), { json: pasted }, {
            preserveScroll: true,
            onSuccess: () => setPasted(''),
        });
    };

    const handleClearAll = () => {
        if (confirm('¿Estás seguro de borrar TODOS los datos? Esta acción no se puede deshacer.')) {
            postClear(route('settings.clear'));
        }
    };

    const handleClearMonth = (monthId) => {
        if (confirm('¿Estás seguro de borrar todos los datos de este mes? Esta acción no se puede deshacer.')) {
            postClearMonth(route('settings.clear-month'), { month_id: monthId });
        }
    };

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center px-4 sm:px-0">
                    <h2 className="text-3xl font-black font-serif text-white uppercase tracking-tight">
                        Configuración
                    </h2>
                </div>
            }
        >
            <Head title="Configuración" />

            <div className="py-6 max-w-lg mx-auto px-4 space-y-6">
                <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 transition-colors">
                    <h3 className="font-bold text-lg dark:text-white mb-4 uppercase tracking-wide flex items-center gap-2">
                        <Database size={20} className="text-[#FF8A3D] dark:text-[#9B7BFF]" />
                        Datos y Copias
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">
                                Exporta tu información a un archivo JSON para tener un respaldo o transferir tus datos.
                            </p>

                            <PrimaryButton
                                onClick={() => handleExport('save')}
                                className="w-full flex justify-center gap-2 bg-[#FF8A3D] dark:bg-[#9B7BFF]"
                            >
                                <Download size={18} />
                                {canSaveToDevice ? 'Guardar Respaldo' : 'Exportar Datos'}
                            </PrimaryButton>

                            {canShare && (
                                <button
                                    type="button"
                                    onClick={() => handleExport('share')}
                                    className="mt-2 w-full flex justify-center items-center gap-2 py-2 px-4 border border-[#FF8A3D] dark:border-[#9B7BFF] text-[#FF8A3D] dark:text-[#9B7BFF] rounded-xl text-sm font-bold hover:bg-orange-50 dark:hover:bg-purple-900/20 transition-all uppercase tracking-widest"
                                >
                                    <Share2 size={16} />
                                    Compartir Respaldo
                                </button>
                            )}

                            {flash.backup_export && (
                                <Notice tone="ok">
                                    {flash.backup_export.filename} listo.{' '}
                                    {flash.backup_export.mode === 'share'
                                        ? 'Elige con qué app compartirlo.'
                                        : 'Elige dónde guardarlo.'}
                                </Notice>
                            )}

                            {errors.backup && <Notice tone="error">{errors.backup}</Notice>}
                        </div>

                        <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">
                                Importa un archivo de respaldo previo. Nota: Esto reemplazará los datos actuales.
                            </p>

                            {canUseDevicePicker && (
                                <button
                                    type="button"
                                    onClick={handlePickFile}
                                    disabled={waiting}
                                    className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-[#FF8A3D] dark:border-[#9B7BFF] text-[#FF8A3D] dark:text-[#9B7BFF] rounded-xl text-sm font-bold disabled:opacity-60 hover:bg-orange-50 dark:hover:bg-purple-900/20 transition-all uppercase tracking-widest"
                                >
                                    {waiting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                    {waiting ? 'Esperando archivo...' : 'Importar Datos'}
                                </button>
                            )}

                            {/* The file input only exists in a browser: the WebView in
                                the compiled app has no file chooser behind it. */}
                            {!native.isNative && (
                                <label className="w-full">
                                    <input
                                        type="file"
                                        accept=".json,application/json"
                                        onChange={handleImportFile}
                                        className="hidden"
                                    />
                                    <div className="flex justify-center items-center gap-2 py-2 px-4 border border-[#FF8A3D] dark:border-[#9B7BFF] text-[#FF8A3D] dark:text-[#9B7BFF] rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-50 dark:hover:bg-purple-900/20 transition-all uppercase tracking-widest">
                                        <Upload size={18} />
                                        Importar Datos
                                    </div>
                                </label>
                            )}

                            {pickerMessage && <Notice tone="info">{pickerMessage}</Notice>}

                            {pickerResult && (
                                <Notice
                                    tone={
                                        pickerResult.status === 'ok'
                                            ? 'ok'
                                            : pickerResult.status === 'error'
                                              ? 'error'
                                              : 'info'
                                    }
                                >
                                    {pickerResult.message}
                                </Notice>
                            )}

                            {flash.backup_import && (
                                <Notice tone="ok">
                                    Respaldo restaurado: {flash.backup_import.months}{' '}
                                    {flash.backup_import.months === 1 ? 'mes' : 'meses'} y{' '}
                                    {flash.backup_import.rows} registros.
                                </Notice>
                            )}

                            {errors.file && <Notice tone="error">{errors.file}</Notice>}

                            <button
                                type="button"
                                onClick={() => setShowPaste((visible) => !visible)}
                                className="mt-3 w-full flex justify-center items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors"
                            >
                                <ClipboardPaste size={14} />
                                {showPaste ? 'Ocultar' : 'Pegar respaldo manualmente'}
                            </button>

                            {showPaste && (
                                <form onSubmit={handlePasteImport} className="mt-2 space-y-2">
                                    <textarea
                                        rows={5}
                                        value={pasted}
                                        onChange={(e) => setPasted(e.target.value)}
                                        placeholder='{ "format": "bkeeper-backup", ... }'
                                        className="w-full rounded-xl border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 text-xs font-mono focus:border-[#FF8A3D] dark:focus:border-[#9B7BFF]"
                                    />
                                    <PrimaryButton
                                        type="submit"
                                        disabled={!pasted.trim()}
                                        className="w-full flex justify-center gap-2 bg-[#FF8A3D] dark:bg-[#9B7BFF] disabled:opacity-60"
                                    >
                                        Restaurar
                                    </PrimaryButton>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-2xl p-6 transition-colors">
                    <h3 className="font-bold text-lg text-red-600 dark:text-red-400 mb-4 uppercase tracking-wide flex items-center gap-2">
                        <Trash2 size={20} />
                        Zona de Peligro
                    </h3>
                    <p className="text-sm text-red-500/80 dark:text-red-400/80 mb-4 font-medium">
                        Borra permanentemente presupuestos, gastos, deudas y transacciones de ahorro.
                    </p>

                    {months.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                                <Calendar size={14} className="inline mr-1" />
                                Limpiar un mes
                            </label>
                            <div className="flex gap-2">
                                <select
                                    defaultValue=""
                                    className="flex-1 px-3 py-2 border border-red-200 dark:border-red-800/30 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm focus:ring-2 focus:ring-red-500/30"
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
                                    onClick={() => {
                                        const select = document.querySelector('select');
                                        const monthId = select.value;
                                        if (monthId) {
                                            handleClearMonth(monthId);
                                            select.value = '';
                                        }
                                    }}
                                    disabled={processingClear}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-bold shadow transition-colors"
                                >
                                    Borrar
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="h-px bg-red-200 dark:bg-red-800/20 my-4" />

                    <button
                        onClick={handleClearAll}
                        disabled={processingClear}
                        className="w-full py-3 bg-red-700 hover:bg-red-800 disabled:bg-gray-400 text-white rounded-xl text-sm font-bold shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} />
                        Borrar Todo
                    </button>
                </div>

                <footer className="text-center pb-8 pt-4">
                    <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                        Budget keeper - {version.replace('alpha ', '')}
                    </p>
                </footer>
            </div>
        </AuthenticatedLayout>
    );
}

/**
 * Inline banner for the export/import outcomes. The page has no toast system of
 * its own, and a modal alert would land on top of the system file picker — so
 * the result is shown where the action was taken.
 */
function Notice({ tone = 'info', children }) {
    const tones = {
        ok: 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-300',
        error: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-300',
        info: 'bg-orange-50 dark:bg-purple-900/10 border-orange-100 dark:border-purple-900/30 text-[#FF8A3D] dark:text-[#9B7BFF]',
    };

    const Icon = tone === 'ok' ? CheckCircle2 : tone === 'error' ? AlertTriangle : Database;

    return (
        <div
            className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${
                tones[tone] ?? tones.info
            }`}
        >
            <Icon size={16} className="shrink-0" />
            <span className="break-words">{children}</span>
        </div>
    );
}

import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import React from 'react';
import PrimaryButton from '@/Components/PrimaryButton';
import { Download, Upload, Trash2, Database, Calendar } from 'lucide-react';

export default function Settings() {
    const { version, months = [], monthIds = [] } = usePage().props;
    const { post: postClear, processing: processingClear } = useForm();
    const { post: postClearMonth } = useForm();

    const handleExport = () => {
        window.location.href = route('export');
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        router.post(route('import'), formData, {
            onSuccess: () => alert('Importación exitosa'),
            onError: (errors) => alert('Error: ' + Object.values(errors).join(', ')),
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
                            <PrimaryButton onClick={handleExport} className="w-full flex justify-center gap-2 bg-[#FF8A3D] dark:bg-[#9B7BFF]">
                                <Download size={18} />
                                Exportar Datos
                            </PrimaryButton>
                        </div>

                        <div className="h-px bg-gray-100 dark:bg-gray-800 my-4" />

                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">
                                Importa un archivo de respaldo previo. Nota: Esto reemplazará los datos actuales.
                            </p>
                            <label className="w-full">
                                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                                <div className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-[#FF8A3D] dark:border-[#9B7BFF] text-[#FF8A3D] dark:text-[#9B7BFF] rounded-xl text-sm font-bold cursor-pointer hover:bg-orange-50 dark:hover:bg-purple-900/20 transition-all uppercase tracking-widest">
                                    <Upload size={18} />
                                    Importar Datos
                                </div>
                            </label>
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

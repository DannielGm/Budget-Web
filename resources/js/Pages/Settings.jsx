import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import React from 'react';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { Download, Upload, Trash2, Database } from 'lucide-react';

export default function Settings() {
    const { version } = usePage().props;
    const { post, processing } = useForm();

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

    const handleClearData = () => {
        if (confirm('¿Estás seguro de borrar TODOS los datos? Esta acción no se puede deshacer.')) {
            post(route('dashboard'), { data: { action: 'clear_all' } }); // Logic to be handled in controller
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
                        Borra permanentemente todos los presupuestos, gastos y deudas registrados.
                    </p>
                    <button
                        onClick={handleClearData}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg transition-all uppercase tracking-widest"
                    >
                        Limpiar Todo
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

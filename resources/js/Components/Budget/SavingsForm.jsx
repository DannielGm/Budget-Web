import React, { useEffect } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';

export default function SavingsForm({ show, onClose, transaction = null, monthId, defaultRate }) {
    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm({
        month_id: monthId,
        type: transaction?.type || 'deposit',
        category: transaction?.category || 'Digital',
        amount_usd: transaction?.amount_usd || '',
        exchange_rate: transaction?.exchange_rate || defaultRate || '',
        timestamp: transaction?.timestamp || Date.now(),
    });

    useEffect(() => {
        if (transaction) {
            setData({
                month_id: monthId,
                type: transaction.type,
                category: transaction.category,
                amount_usd: transaction.amount_usd,
                exchange_rate: transaction.exchange_rate,
                timestamp: transaction.timestamp,
            });
        } else {
            reset();
            setData('month_id', monthId);
            setData('exchange_rate', defaultRate);
            setData('timestamp', Date.now());
        }
    }, [transaction, monthId, show]);

    const submit = (e) => {
        e.preventDefault();

        if (transaction) {
            patch(route('savings.update', transaction.id), {
                onSuccess: () => {
                    reset();
                    onClose();
                },
            });
        } else {
            post(route('savings.store'), {
                onSuccess: () => {
                    reset();
                    onClose();
                },
            });
        }
    };

    const handleClose = () => {
        clearErrors();
        onClose();
    };

        const handleDelete = () => {
        if (window.confirm('¿Estás seguro de eliminar este movimiento de ahorro?')) {
            router.delete(route('savings.destroy', transaction.id), {
                preserveScroll: true,
                onSuccess: () => {
                    reset();
                    onClose();
                },
            });
        }
    };


    return (
        <Modal show={show} onClose={handleClose} maxWidth="md">
            <form onSubmit={submit} className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                    {transaction && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            title="Eliminar operación"
                            className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
                        {transaction ? 'Editar Ahorro' : 'Nuevo Ahorro'}
                    </h2>
                </div>

                <div className="space-y-4">
                    <div>
                        <InputLabel value="Tipo de Operación" className="dark:text-gray-300" />
                        <div className="flex gap-2 mt-1">
                            <button
                                type="button"
                                onClick={() => setData('type', 'deposit')}
                                className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold border transition-colors ${data.type === 'deposit' ? 'bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                            >
                                Depósito
                            </button>
                            <button
                                type="button"
                                onClick={() => setData('type', 'withdrawal')}
                                className={`flex-1 py-2 px-4 rounded-xl text-sm font-bold border transition-colors ${data.type === 'withdrawal' ? 'bg-[#FF8A3D] dark:bg-[#9B7BFF] text-white border-transparent' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}
                            >
                                Retiro
                            </button>
                        </div>
                        <InputError message={errors.type} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="category" value="Categoría" className="dark:text-gray-300" />
                        <select
                            id="category"
                            value={data.category}
                            onChange={(e) => setData('category', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                        >
                            <option value="Digital">Digital</option>
                            <option value="Bank">Banco</option>
                            <option value="Physical">Físico</option>
                        </select>
                        <InputError message={errors.category} className="mt-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <InputLabel htmlFor="amount_usd" value="Monto ($)" className="dark:text-gray-300" />
                            <TextInput
                                id="amount_usd"
                                type="number"
                                step="0.01"
                                name="amount_usd"
                                value={data.amount_usd}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('amount_usd', e.target.value)}
                                required
                            />
                            <InputError message={errors.amount_usd} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="exchange_rate" value="Tasa (Bs/$)" className="dark:text-gray-300" />
                            <TextInput
                                id="exchange_rate"
                                type="number"
                                step="0.01"
                                name="exchange_rate"
                                value={data.exchange_rate}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('exchange_rate', e.target.value)}
                                required
                            />
                            <InputError message={errors.exchange_rate} className="mt-2" />
                        </div>
                    </div>

                    <div>
                        <p className="text-xs text-gray-400 font-bold dark:text-gray-500">
                            Equivalente: Bs {data.amount_usd && data.exchange_rate ? (parseFloat(data.amount_usd) * parseFloat(data.exchange_rate)).toLocaleString('es-ES') : '0.00'}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton onClick={handleClose} className="dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        {transaction ? 'Actualizar' : 'Guardar'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

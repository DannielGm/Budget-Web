import React, { useEffect } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm } from '@inertiajs/react';

export default function ExpenseForm({ show, onClose, expense = null, categoryName, monthId, defaultRate }) {
    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm({
        id: expense?.id || '',
        month_id: monthId,
        category_name: categoryName,
        label: expense?.label || '',
        amount_bs: expense?.amount_bs || '',
        rate: expense?.rate || defaultRate || '',
        timestamp: expense?.timestamp || Date.now(),
    });

    useEffect(() => {
        if (expense) {
            setData({
                id: expense.id,
                month_id: monthId,
                category_name: categoryName,
                label: expense.label,
                amount_bs: expense.amount_bs,
                rate: expense.rate,
                timestamp: expense.timestamp,
            });
        } else {
            reset();
            setData('category_name', categoryName);
            setData('month_id', monthId);
            setData('rate', defaultRate);
            setData('timestamp', Date.now());
        }
    }, [expense, categoryName, monthId, show]);

    const submit = (e) => {
        e.preventDefault();

        if (expense) {
            patch(route('expenses.update', expense.id), {
                onSuccess: () => {
                    reset();
                    onClose();
                },
            });
        } else {
            post(route('expenses.store'), {
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

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md">
            <form onSubmit={submit} className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-tight">
                    {expense ? 'Editar Gasto' : `Nuevo Gasto en ${categoryName}`}
                </h2>

                <div className="space-y-4">
                    <div>
                        <InputLabel htmlFor="label" value="Concepto" className="dark:text-gray-300" />
                        <TextInput
                            id="label"
                            type="text"
                            name="label"
                            value={data.label}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('label', e.target.value)}
                            required
                            autoFocus
                        />
                        <InputError message={errors.label} className="mt-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <InputLabel htmlFor="amount_bs" value="Monto (Bs)" className="dark:text-gray-300" />
                            <TextInput
                                id="amount_bs"
                                type="number"
                                step="0.01"
                                name="amount_bs"
                                value={data.amount_bs}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('amount_bs', e.target.value)}
                                required
                            />
                            <InputError message={errors.amount_bs} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="rate" value="Tasa (BCV)" className="dark:text-gray-300" />
                            <TextInput
                                id="rate"
                                type="number"
                                step="0.01"
                                name="rate"
                                value={data.rate}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('rate', e.target.value)}
                                required
                            />
                            <InputError message={errors.rate} className="mt-2" />
                        </div>
                    </div>

                    <div>
                        <p className="text-xs text-gray-400 font-bold dark:text-gray-500">
                            Equivalente: $ {data.amount_bs && data.rate ? (parseFloat(data.amount_bs) / parseFloat(data.rate)).toFixed(2) : '0.00'}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton onClick={handleClose} className="dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        {expense ? 'Guardar Cambios' : 'Crear Gasto'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

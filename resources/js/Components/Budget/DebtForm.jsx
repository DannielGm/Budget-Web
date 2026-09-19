import React, { useEffect } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm } from '@inertiajs/react';

export default function DebtForm({ show, onClose, debt = null, monthId }) {
    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm({
        month_id: monthId,
        label: debt?.label || '',
        opening_bs: debt?.opening_bs || '',
        payment_bs: debt?.payment_bs || '0',
    });

    useEffect(() => {
        if (debt) {
            setData({
                month_id: monthId,
                label: debt.label,
                opening_bs: debt.opening_bs,
                payment_bs: debt.payment_bs,
            });
        } else {
            reset();
            setData('month_id', monthId);
        }
    }, [debt, monthId, show]);

    const submit = (e) => {
        e.preventDefault();

        if (debt) {
            patch(route('debts.update', debt.id), {
                onSuccess: () => {
                    reset();
                    onClose();
                },
            });
        } else {
            post(route('debts.store'), {
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
                    {debt ? 'Editar Deuda' : 'Nueva Deuda'}
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
                            disabled={!!debt} // Labels are usually static for carried debts
                        />
                        <InputError message={errors.label} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="opening_bs" value="Monto Inicial (Bs)" className="dark:text-gray-300" />
                        <TextInput
                            id="opening_bs"
                            type="number"
                            step="0.01"
                            name="opening_bs"
                            value={data.opening_bs}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('opening_bs', e.target.value)}
                            required
                            disabled={!!debt && !debt.label.includes('Compras a crédito')}
                        />
                        <InputError message={errors.opening_bs} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="payment_bs" value="Pago Realizado (Bs)" className="dark:text-gray-300" />
                        <TextInput
                            id="payment_bs"
                            type="number"
                            step="0.01"
                            name="payment_bs"
                            value={data.payment_bs}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('payment_bs', e.target.value)}
                            required
                        />
                        <InputError message={errors.payment_bs} className="mt-2" />
                    </div>

                    <div>
                        <p className="text-xs text-gray-400 font-bold dark:text-gray-500">
                            Restante: Bs {data.opening_bs && data.payment_bs ? (parseFloat(data.opening_bs) - parseFloat(data.payment_bs)).toLocaleString('es-ES') : '0.00'}
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton onClick={handleClose} className="dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        {debt ? 'Actualizar Pago' : 'Crear Deuda'}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

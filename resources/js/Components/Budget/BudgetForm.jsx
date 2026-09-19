import React, { useEffect } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm } from '@inertiajs/react';

export default function BudgetForm({ show, onClose, budget }) {
    const { data, setData, patch, processing, errors, reset, clearErrors } = useForm({
        income_bs: budget.income_bs || '0',
        income_rate: budget.income_rate || '0',
        opening_balance_bs: budget.opening_balance_bs || '0',
    });

    useEffect(() => {
        if (show) {
            setData({
                income_bs: budget.income_bs,
                income_rate: budget.income_rate,
                opening_balance_bs: budget.opening_balance_bs,
            });
        }
    }, [show, budget]);

    const submit = (e) => {
        e.preventDefault();
        patch(route('budgets.update', budget.month_id), {
            onSuccess: () => onClose(),
        });
    };

    const handleClose = () => {
        clearErrors();
        onClose();
    };

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md">
            <form onSubmit={submit} className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 uppercase tracking-tight">
                    Configuración de {budget.month_label}
                </h2>

                <div className="space-y-4">
                    <div>
                        <InputLabel htmlFor="income_bs" value="Ingreso Mensual (Bs)" className="dark:text-gray-300" />
                        <TextInput
                            id="income_bs"
                            type="number"
                            step="0.01"
                            name="income_bs"
                            value={data.income_bs}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('income_bs', e.target.value)}
                            required
                        />
                        <InputError message={errors.income_bs} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="income_rate" value="Tasa de Cambio (BCV)" className="dark:text-gray-300" />
                        <TextInput
                            id="income_rate"
                            type="number"
                            step="0.01"
                            name="income_rate"
                            value={data.income_rate}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('income_rate', e.target.value)}
                            required
                        />
                        <InputError message={errors.income_rate} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="opening_balance_bs" value="Saldo Inicial (Bs)" className="dark:text-gray-300" />
                        <TextInput
                            id="opening_balance_bs"
                            type="number"
                            step="0.01"
                            name="opening_balance_bs"
                            value={data.opening_balance_bs}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('opening_balance_bs', e.target.value)}
                            required
                        />
                        <InputError message={errors.opening_balance_bs} className="mt-2" />
                        <p className="mt-1 text-[10px] text-gray-400 font-medium">
                            Arrastre del mes anterior. Edite solo si es necesario.
                        </p>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton onClick={handleClose} className="dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        Guardar
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

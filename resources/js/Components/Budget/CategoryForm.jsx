import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormattedNumberInput from '@/Components/FormattedNumberInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router, usePage } from '@inertiajs/react';
import { CreditCard } from 'lucide-react';

export default function CategoryForm({ show, onClose, category, monthId }) {
    const { budget } = usePage().props;
    const { data, setData, post, patch, processing, errors, reset, clearErrors, transform } = useForm({
        name: category?.name || '',
        month_id: monthId,
        cash_expense: category?.cash_expense ?? true,
        is_presupuesto: category?.is_presupuesto ?? false,
        planned_bs: category?.planned_bs || '',
        debt_id: category?.debt_id || '',
        type: '', // we will map this to the backend 'type' field
    });

    const [isLinked, setIsLinked] = useState(!!category?.debt_id);

    // We compute 'type' based on the booleans
    const currentType = data.is_presupuesto ? 'presupuesto' : (data.cash_expense ? 'contado' : 'credito');

    const handleTypeChange = (type) => {
        if (type === 'contado') {
            setData(d => ({ ...d, cash_expense: true, is_presupuesto: false }));
        } else if (type === 'credito') {
            setData(d => ({ ...d, cash_expense: false, is_presupuesto: false }));
        } else if (type === 'presupuesto') {
            setData(d => ({ ...d, cash_expense: true, is_presupuesto: true }));
        }
    };

    useEffect(() => {
        if (show && category) {
            setData({
                name: category.name,
                month_id: monthId,
                cash_expense: category.cash_expense,
                is_presupuesto: category.is_presupuesto,
                planned_bs: category.planned_bs || '',
                debt_id: category.debt_id || '',
                type: category.is_presupuesto ? 'presupuesto' : (category.cash_expense ? 'contado' : 'credito')
            });
            setIsLinked(!!category.debt_id);
        } else if (show && !category) {
            reset();
            setData({
                name: '',
                month_id: monthId,
                cash_expense: true,
                is_presupuesto: false,
                planned_bs: '',
                debt_id: '',
                type: 'contado'
            });
            setIsLinked(false);
        }
    }, [show, category, monthId]);

    transform((formData) => ({
        ...formData,
        type: formData.is_presupuesto ? 'presupuesto' : (formData.cash_expense ? 'contado' : 'credito'),
        debt_id: (!formData.cash_expense && !formData.is_presupuesto && isLinked) ? formData.debt_id : null
    }));

    const submit = (e) => {
        e.preventDefault();

        if (category) {
            patch(route('categories.update', category.id), {
                onSuccess: () => onClose(),
            });
        } else {
            post(route('categories.store'), {
                onSuccess: () => onClose(),
            });
        }
    };

    const handleDelete = () => {
        if (confirm(`¿Estás seguro de eliminar la categoría "${category.name}" y TODOS sus gastos?`)) {
            router.delete(route('categories.destroy', category.id), {
                onSuccess: () => onClose(),
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
                    {category ? `Editar Categoría: ${category.name}` : 'Nueva Categoría'}
                </h2>

                <div className="space-y-4">
                    <div>
                        <InputLabel htmlFor="name" value="Nombre" className="dark:text-gray-300" />
                        <TextInput
                            id="name"
                            type="text"
                            name="name"
                            value={data.name}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('name', e.target.value)}
                            required
                        />
                        <InputError message={errors.name} className="mt-2" />
                    </div>

                    <div className="space-y-3 mt-4">
                        <InputLabel value="Tipo de Categoría" className="dark:text-gray-300" />

                        <select
                            value={currentType}
                            onChange={(e) => handleTypeChange(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                        >
                            <option value="contado">Gasto de contado (Resta del saldo disponible)</option>
                            <option value="credito">Compra a crédito (Se suma a deudas)</option>
                            {!category && (
                                <option value="presupuesto">Presupuesto (Solo planificación, no altera el balance)</option>
                            )}
                        </select>
                    </div>

                    {currentType === 'presupuesto' && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 mt-4">
                            <InputLabel htmlFor="planned_bs" value="Monto Planificado (Bs) [Opcional]" className="dark:text-gray-300" />
                            <FormattedNumberInput
                                id="planned_bs"
                                name="planned_bs"
                                value={data.planned_bs}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('planned_bs', e.target.value)}
                            />
                            <InputError message={errors.planned_bs} className="mt-2" />
                            <p className="text-[10px] text-gray-500 mt-2">Este monto servirá de referencia en la pestaña de Gastos.</p>
                        </div>
                    )}

                    {currentType === 'credito' && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    id="isLinked"
                                    checked={isLinked}
                                    onChange={(e) => setIsLinked(e.target.checked)}
                                    className="rounded dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                                />
                                <InputLabel htmlFor="isLinked" value="Vincular a cuenta de deuda" className="dark:text-gray-300 cursor-pointer flex items-center gap-1 font-bold">
                                    <CreditCard size={14} className="text-[#FF8A3D] dark:text-[#9B7BFF]" /> Vincular a cuenta de deuda
                                </InputLabel>
                            </div>

                            {isLinked && (
                                <div>
                                    <select
                                        value={data.debt_id}
                                        onChange={(e) => setData('debt_id', e.target.value)}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                                        required
                                    >
                                        <option value="" disabled>Seleccione una deuda...</option>
                                        {budget.debts.filter(d => d.label !== 'Compras a crédito').map(d => (
                                            <option key={d.id} value={d.id}>{d.label}</option>
                                        ))}
                                    </select>
                                    <InputError message={errors.debt_id} className="mt-2" />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-4">
                    {category ? (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors py-2 sm:py-0 w-full sm:w-auto text-center"
                        >
                            Eliminar Categoría
                        </button>
                    ) : <div className="hidden sm:block"></div>}

                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <SecondaryButton onClick={handleClose} className="w-full sm:w-auto justify-center dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                            Cancelar
                        </SecondaryButton>
                        <PrimaryButton className="w-full sm:w-auto justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                            Guardar
                        </PrimaryButton>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

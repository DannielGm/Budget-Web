import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router } from '@inertiajs/react';

export default function CategoryForm({ show, onClose, category, monthId }) {
    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm({
        name: category?.name || '',
        month_id: monthId,
        cash_expense: category?.cash_expense ?? true,
        is_presupuesto: category?.is_presupuesto ?? false,
    });

    useEffect(() => {
        if (show && category) {
            setData({
                name: category.name,
                month_id: monthId,
                cash_expense: category.cash_expense,
                is_presupuesto: category.is_presupuesto,
            });
        } else if (show && !category) {
            reset();
            setData('month_id', monthId);
            setData('cash_expense', true);
            setData('is_presupuesto', false);
        }
    }, [show, category]);

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

                    <div className="flex items-center gap-2 mt-4">
                        <input
                            type="checkbox"
                            id="cash_expense"
                            checked={data.cash_expense}
                            onChange={(e) => setData('cash_expense', e.target.checked)}
                            className="rounded dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                        />
                        <InputLabel htmlFor="cash_expense" value="Gasto de contado (Resta del saldo)" className="dark:text-gray-300 cursor-pointer" />
                    </div>

                    {!category && (
                        <div className="flex items-center gap-2 mt-4">
                            <input
                                type="checkbox"
                                id="is_presupuesto"
                                checked={data.is_presupuesto}
                                onChange={(e) => setData('is_presupuesto', e.target.checked)}
                                className="rounded dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                            />
                            <InputLabel htmlFor="is_presupuesto" value="Categoría de Presupuesto (Solo planificación, no resta del saldo real)" className="dark:text-gray-300 cursor-pointer" />
                        </div>
                    )}
                </div>

                <div className="mt-8 flex justify-between gap-3">
                    {category ? (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="text-red-500 hover:text-red-700 text-sm font-bold transition-colors"
                        >
                            Eliminar Categoría
                        </button>
                    ) : <div></div>}

                    <div className="flex gap-3">
                        <SecondaryButton onClick={handleClose} className="dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                            Cancelar
                        </SecondaryButton>
                        <PrimaryButton className="bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                            Guardar
                        </PrimaryButton>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

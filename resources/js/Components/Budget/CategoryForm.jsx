import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router } from '@inertiajs/react';

export default function CategoryForm({ show, onClose, category, monthId }) {
    const { data, setData, post, patch, processing, errors, reset, clearErrors, transform } = useForm({
        name: category?.name || '',
        month_id: monthId,
        type: category?.is_presupuesto ? 'presupuesto' : (category?.cash_expense ? 'contado' : 'credito'),
    });

    transform((data) => ({
        name: data.name,
        month_id: data.month_id,
        cash_expense: data.type === 'contado',
        is_presupuesto: data.type === 'presupuesto',
    }));

    useEffect(() => {
        if (show && category) {
            setData({
                name: category.name,
                month_id: monthId,
                type: category.is_presupuesto ? 'presupuesto' : (category.cash_expense ? 'contado' : 'credito'),
            });
        } else if (show && !category) {
            reset();
            setData('month_id', monthId);
            setData('type', 'contado');
        }
    }, [show, category, monthId]);

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

                        <div className="flex items-center gap-2">
                            <input
                                type="radio"
                                id="type_contado"
                                name="category_type"
                                value="contado"
                                checked={data.type === 'contado'}
                                onChange={(e) => setData('type', e.target.value)}
                                className="dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                            />
                            <InputLabel htmlFor="type_contado" value="Gasto de contado (Resta del saldo disponible)" className="dark:text-gray-300 cursor-pointer" />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="radio"
                                id="type_credito"
                                name="category_type"
                                value="credito"
                                checked={data.type === 'credito'}
                                onChange={(e) => setData('type', e.target.value)}
                                className="dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                            />
                            <InputLabel htmlFor="type_credito" value="Compra a crédito (Se suma a deudas)" className="dark:text-gray-300 cursor-pointer" />
                        </div>

                        {!category && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    id="type_presupuesto"
                                    name="category_type"
                                    value="presupuesto"
                                    checked={data.type === 'presupuesto'}
                                    onChange={(e) => setData('type', e.target.value)}
                                    className="dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                                />
                                <InputLabel htmlFor="type_presupuesto" value="Presupuesto (Solo planificación, no altera el balance)" className="dark:text-gray-300 cursor-pointer" />
                            </div>
                        )}
                    </div>
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

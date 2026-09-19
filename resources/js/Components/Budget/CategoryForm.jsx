import React, { useEffect } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm } from '@inertiajs/react';

export default function CategoryForm({ show, onClose, category, monthId }) {
    const { data, setData, patch, processing, errors, reset, clearErrors } = useForm({
        name: category?.name || '',
        planned_bs: category?.planned_bs || '0',
    });

    useEffect(() => {
        if (show && category) {
            setData({
                name: category.name,
                planned_bs: category.planned_bs,
            });
        }
    }, [show, category]);

    const submit = (e) => {
        e.preventDefault();
        patch(route('categories.update', category.id), {
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
                    Editar Categoría: {category?.name}
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

                    <div>
                        <InputLabel htmlFor="planned_bs" value="Presupuesto (Bs)" className="dark:text-gray-300" />
                        <TextInput
                            id="planned_bs"
                            type="number"
                            step="0.01"
                            name="planned_bs"
                            value={data.planned_bs}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('planned_bs', e.target.value)}
                            required
                        />
                        <InputError message={errors.planned_bs} className="mt-2" />
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

import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormattedNumberInput from '@/Components/FormattedNumberInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import BudgetCalendar from '@/Components/Budget/BudgetCalendar';
import { useForm, usePage } from '@inertiajs/react';
import { ArrowRightLeft } from 'lucide-react';

const pad = (n) => String(n).padStart(2, '0');

function formatTimestamp(ms) {
    const d = new Date(ms);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpenseForm({ show, onClose, expense = null, categoryName, monthId, defaultRate }) {
    const { budget } = usePage().props;
    const [showDatePicker, setShowDatePicker] = useState(false);
    const { data, setData, post, patch, processing, errors, reset, clearErrors, transform } = useForm({
        id: expense?.id || '',
        month_id: monthId,
        category_name: categoryName,
        label: expense?.label || '',
        amount_bs: expense?.amount_bs || '',
        rate: expense?.rate || defaultRate || '',
        timestamp: expense?.timestamp || Date.now(),
    });

    const category = budget.categories.find(c => c.name === categoryName);
    const isPresupuesto = category?.is_presupuesto;
    const [moveToReal, setMoveToReal] = useState(false);
    const [targetCategory, setTargetCategory] = useState('');

    const realCategories = budget.categories.filter(c => !c.is_presupuesto);

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
        setMoveToReal(false);
        setTargetCategory(realCategories.length > 0 ? realCategories[0].name : '');
    }, [expense, categoryName, monthId, show]);

    transform((data) => {
        if (expense && isPresupuesto && moveToReal && targetCategory) {
            // "Convertir en gasto real": move the expense out of the
            // presupuesto category into the chosen real one.
            return { ...data, category_name: targetCategory };
        }
        // Never send the unchanged category on edit; update() must not
        // move expenses INTO presupuesto categories.
        if (expense) {
            const { category_name, ...rest } = data;
            return rest;
        }
        return data;
    });

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
                            <FormattedNumberInput
                                id="amount_bs"
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
                            <FormattedNumberInput
                                id="rate"
                                name="rate"
                                value={data.rate}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('rate', e.target.value)}
                                required
                            />
                            <InputError message={errors.rate} className="mt-2" />
                        </div>
                    </div>

                    {expense && isPresupuesto && (
                        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 mt-2">
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    id="moveToReal"
                                    checked={moveToReal}
                                    onChange={(e) => setMoveToReal(e.target.checked)}
                                    className="rounded dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                                />
                                <InputLabel htmlFor="moveToReal" value="Convertir en gasto real" className="dark:text-gray-300 cursor-pointer flex items-center gap-1 font-bold">
                                    <ArrowRightLeft size={14} className="text-[#FF8A3D] dark:text-[#9B7BFF]" /> Convertir en gasto real
                                </InputLabel>
                            </div>
                            {moveToReal && (
                                <select
                                    value={targetCategory}
                                    onChange={(e) => setTargetCategory(e.target.value)}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                                >
                                    {realCategories.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    <div>
                        <InputLabel htmlFor="timestamp" value="Fecha del gasto" className="dark:text-gray-300" />
                        <div className="flex items-center gap-2 mt-1">
                            <TextInput
                                id="timestamp"
                                type="text"
                                value={formatTimestamp(Number(data.timestamp))}
                                readOnly
                                className="flex-1 dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            />
                            <button
                                type="button"
                                onClick={() => setShowDatePicker(true)}
                                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:opacity-80"
                            >
                                Elegir
                            </button>
                            <button
                                type="button"
                                onClick={() => setData('timestamp', Date.now())}
                                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:opacity-80"
                            >
                                Hoy
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 font-bold dark:text-gray-500 mt-2">
                            Tasa BCV aplicada automáticamente.
                        </p>
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

            {/* pickDay mode: choose the expense timestamp from the calendar */}
            <BudgetCalendar
                show={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                mode="pickDay"
                title="Fecha del gasto"
                initialMonthId={monthId}
                initialDayIso={(() => {
                    const d = new Date(Number(data.timestamp));
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                })()}
                onSelect={(calMonthId, dayIso) => {
                    if (!dayIso) return;
                    const previous = new Date(Number(data.timestamp));
                    const picked = new Date(`${dayIso}T00:00:00`);
                    picked.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
                    setData('timestamp', picked.getTime());
                }}
            />
        </Modal>
    );
}

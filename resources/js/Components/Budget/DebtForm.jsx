import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

export default function DebtForm({ show, onClose, debt = null, monthId }) {
    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm({
        month_id: monthId,
        label: debt?.label || '',
        opening_bs: debt?.opening_bs || '',
        payment_bs: debt?.payment_bs || '0',
    });

    const [isAdditive, setIsAdditive] = useState(false);
    const [additiveAmount, setAdditiveAmount] = useState('');
    const [additiveMethod, setAdditiveMethod] = useState('Transferencia');
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (debt) {
            setData({
                month_id: monthId,
                label: debt.label,
                opening_bs: debt.opening_bs,
                payment_bs: debt.payment_bs,
            });
            setIsAdditive(false);
            setAdditiveAmount('');
            setShowHistory(false);
        } else {
            reset();
            setData('month_id', monthId);
        }
    }, [debt, monthId, show]);

    const submit = (e) => {
        e.preventDefault();

        let finalPayment = data.payment_bs;
        if (debt && isAdditive && additiveAmount !== '') {
            finalPayment = (parseFloat(debt.payment_bs) + parseFloat(additiveAmount)).toString();
        }

        if (debt) {
            patch(route('debts.update', debt.id), {
                data: { ...data, payment_bs: finalPayment, additive_amount: isAdditive ? additiveAmount : null, additive_method: additiveMethod },
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

    const handleDeletePayment = (paymentId) => {
        if (confirm("¿Borrar este pago?")) {
            router.delete(route('debt-payments.destroy', paymentId), { preserveScroll: true });
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

                    {debt ? (
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-2 mb-3">
                                <input
                                    type="checkbox"
                                    id="additiveDebt"
                                    checked={isAdditive}
                                    onChange={(e) => setIsAdditive(e.target.checked)}
                                    className="rounded dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                                />
                                <InputLabel htmlFor="additiveDebt" value={`Registrar nuevo pago (Total actual: Bs ${parseFloat(debt.payment_bs).toLocaleString('es-ES')})`} className="dark:text-gray-300 cursor-pointer" />
                            </div>

                            {isAdditive ? (
                                <div className="space-y-3">
                                    <TextInput
                                        id="additiveAmount"
                                        type="number"
                                        step="0.01"
                                        placeholder="Monto a pagar"
                                        value={additiveAmount}
                                        className="block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                        onChange={(e) => setAdditiveAmount(e.target.value)}
                                        required
                                    />
                                    <select
                                        value={additiveMethod}
                                        onChange={(e) => setAdditiveMethod(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                                    >
                                        <option value="Transferencia">Transferencia</option>
                                        <option value="Pago Móvil">Pago Móvil</option>
                                        <option value="Efectivo Bs">Efectivo Bs</option>
                                        <option value="Efectivo USD">Efectivo USD</option>
                                        <option value="Binance">Binance</option>
                                    </select>
                                </div>
                            ) : (
                                <TextInput
                                    id="payment_bs"
                                    type="number"
                                    step="0.01"
                                    name="payment_bs"
                                    value={data.payment_bs}
                                    className="block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                    onChange={(e) => setData('payment_bs', e.target.value)}
                                    required
                                />
                            )}
                        </div>
                    ) : (
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
                    )}

                    <div>
                        <p className="text-xs text-gray-400 font-bold dark:text-gray-500">
                            Restante: Bs {data.opening_bs && (isAdditive ? (parseFloat(data.opening_bs) - parseFloat(debt.payment_bs) - (parseFloat(additiveAmount)||0)) : (parseFloat(data.opening_bs) - parseFloat(data.payment_bs))) ? (parseFloat(data.opening_bs) - (isAdditive ? (parseFloat(debt.payment_bs) + (parseFloat(additiveAmount)||0)) : parseFloat(data.payment_bs))).toLocaleString('es-ES') : '0.00'}
                        </p>
                    </div>

                    {debt?.payments && debt.payments.length > 0 && (
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setShowHistory(!showHistory)}
                                className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors uppercase tracking-wider"
                            >
                                Historial de pagos {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {showHistory && (
                                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                                    {debt.payments.map((p) => (
                                        <div key={p.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">
                                            <div>
                                                <p className="text-sm font-bold dark:text-gray-200">Bs {parseFloat(p.amount_bs).toLocaleString('es-ES')}</p>
                                                <div className="flex gap-2 items-center">
                                                    <span className="text-[10px] text-gray-400 uppercase">{p.method}</span>
                                                    <span className="text-[10px] text-gray-400">{new Date(p.timestamp).toLocaleDateString('es-ES')}</span>
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => handleDeletePayment(p.id)} className="p-1 text-red-400 hover:text-red-600 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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

import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormattedNumberInput from '@/Components/FormattedNumberInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/Components/ConfirmationProvider';
import { useRateLabel, useTodayRateInBs } from '@/hooks/useFigure';
import { fmtBs } from '@/lib/money';
import { currencySymbol, useCurrency, USD, EUR } from '@/lib/currency';
import { useFormDirty } from '@/hooks/useDismissOnBackButton';

/** The two pots a deposit can land in, in the order they are offered. */
const POT_CHOICES = [USD, EUR];

/* The active pot was brand orange on bg-orange-50: about 2.4:1, and it is the
   control that says which currency the amount below is in. Orange-700 on the
   same tint is ~4.4:1; the border and the dark-mode violet keep the brand
   colour, which only have to be distinguishable rather than readable. */
const potButton = (active) => `rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors ${active
    ? 'border-[#FF8A3D] bg-orange-50 text-orange-700 dark:border-[#9B7BFF] dark:bg-purple-950/40 dark:text-purple-300'
    : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400'}`;

export default function SavingsForm({ show, onClose, transaction = null, monthId,
    layoutId = null,
}) {
    // A movement is saved in one currency, and a pool keeps its dollars and its
    // euros in separate pots, so the form says which one this is. It defaults to
    // the currency on screen -- you are recording what you can see -- and the
    // rate follows the choice, because the dollar and the euro rates are different numbers and
    // using the wrong one writes a bolivar amount twenty percent out.
    const displayCurrency = useCurrency();
    const [currency, setCurrency] = useState(transaction?.currency || displayCurrency);
    // Today's rate, not the day on screen: the movement is being made now and is
    // stamped now, so pricing it at a rate from a past day would be wrong.
    const usdRate = useTodayRateInBs(USD);
    const eurRate = useTodayRateInBs(EUR);
    const rateInBs = currency === EUR ? eurRate : usdRate;
    const rateLabel = useRateLabel(currency);
    const confirmAction = useConfirm();
    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm({
        month_id: monthId,
        type: transaction?.type || 'deposit',
        category: transaction?.category || 'Digital',
        currency: transaction?.currency || displayCurrency,
        amount_usd: transaction?.amount_usd || '',
        exchange_rate: transaction?.exchange_rate || rateInBs || '',
        timestamp: transaction?.timestamp || Date.now(),
    });

    useEffect(() => {
        if (transaction) {
            // Rows written before the column existed are dollars.
            const pot = transaction.currency || USD;
            setCurrency(pot);
            setData({
                month_id: monthId,
                type: transaction.type,
                category: transaction.category,
                currency: pot,
                amount_usd: transaction.amount_usd,
                exchange_rate: transaction.exchange_rate,
                timestamp: transaction.timestamp,
            });
        } else {
            reset();
            setCurrency(displayCurrency);
            setData('month_id', monthId);
            setData('currency', displayCurrency);
            setData('exchange_rate', displayCurrency === EUR ? eurRate : usdRate);
            setData('timestamp', Date.now());
        }
    }, [transaction, monthId, show]);

    // Switching the pot's currency re-prices the rate only while the field still
    // holds the one the form filled in: a rate the user typed is theirs, and
    // silently replacing it would throw their number away.
    const changeCurrency = (next) => {
        setCurrency(next);
        setData('currency', next);

        if (Number(data.exchange_rate) === Number(rateInBs)) {
            setData('exchange_rate', next === EUR ? eurRate : usdRate);
        }
    };

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

    const handleDelete = async () => {
        const confirmed = await confirmAction({
            title: 'Eliminar movimiento de ahorro',
            message: 'Se eliminará el movimiento de ahorro seleccionado.',
            detail: 'El saldo de la cuenta de ahorro se recalculará automáticamente.',
            confirmLabel: 'Eliminar movimiento',
            tone: 'danger',
        });
        if (!confirmed) return;
        router.delete(route('savings.destroy', transaction.id), {
            preserveScroll: true,
            onSuccess: () => { reset(); onClose(); },
        });
    };


    const isDirty = useFormDirty(data, show);

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md" layoutId={layoutId} labelledBy="savings-form-title" dirty={isDirty}>
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
                    <h2 id="savings-form-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
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

                    <div className="mb-4">
                        <InputLabel htmlFor="savings_currency" value="Guardado en" className="dark:text-gray-300" />
                        <div className="mt-1 grid grid-cols-2 gap-2">
                            {POT_CHOICES.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => changeCurrency(option)}
                                    aria-pressed={currency === option}
                                    className={potButton(currency === option)}
                                >
                                    {/* The name, not the code: "$ USD" said the same
                                        thing twice. The code is not lost -- it is
                                        what the rate label under the field uses. */}
                                    {currencySymbol(option)} {option === EUR ? 'Euros' : 'Dólares'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <InputLabel htmlFor="amount_usd" value={`Monto (${currencySymbol(currency)})`} className="dark:text-gray-300" />
                            <FormattedNumberInput
                                id="amount_usd"
                                name="amount_usd"
                                value={data.amount_usd}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('amount_usd', e.target.value)}
                                required
                            />
                            <InputError message={errors.amount_usd} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="exchange_rate" value={`Tasa (${rateLabel})`} className="dark:text-gray-300" />
                            <FormattedNumberInput
                                id="exchange_rate"
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
                        <p className="text-xs text-gray-500 font-bold dark:text-gray-400">
                            {data.amount_usd && data.exchange_rate
                                ? `Equivalente: Bs ${fmtBs(Number(data.amount_usd) * Number(data.exchange_rate))}`
                                : 'Equivalente: Bs 0,00'}
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                    <SecondaryButton onClick={handleClose} className="w-full sm:w-auto justify-center dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="w-full sm:w-auto justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        {processing ? 'Guardando…' : (transaction ? 'Actualizar' : 'Guardar')}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

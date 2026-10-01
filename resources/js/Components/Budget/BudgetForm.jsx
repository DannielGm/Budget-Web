import React, { useEffect, useRef, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormattedNumberInput from '@/Components/FormattedNumberInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import BudgetCalendar from '@/Components/Budget/BudgetCalendar';
import { useForm } from '@inertiajs/react';
import { useCurrency, EUR } from '@/lib/currency';
import { useFormDirty } from '@/hooks/useDismissOnBackButton';
import { Calendar as CalendarIcon } from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

/**
 * What the "Tasa Diaria BCV" switch does to the form's rate.
 *
 * Pulled out of the component because the rule is the bug. The switch used to
 * write the MONTH's rate, which is the first of the month carried forward, so a
 * switch promising a daily figure wrote yesterday's number; and it used to be
 * wired to the negation of is_custom_rate, so the box showed checked while the
 * state it wrote meant "custom". Both were only observable by pressing it.
 *
 * A function makes them assertable. On = today's published rate for the series
 * on screen. Off = keep what the user typed, which is the number they chose and
 * the one that must survive a save.
 *
 * @param checked    the switch's new position: true means follow BCV daily
 * @param dailyRate  today's published rate for the display series, 0 if unknown
 * @param current    the rate in the form right now
 */
export function applyDailyRateSwitch(checked, dailyRate, current) {
    if (!checked) return { is_custom_rate: true, income_rate: current };
    if (!(Number(dailyRate) > 0)) return { is_custom_rate: false, income_rate: current };

    return { is_custom_rate: false, income_rate: dailyRate };
}

export default function BudgetForm({ show, onClose, budget, rates = {},
    layoutId = null,
}) {
    const currency = useCurrency();
    // Today's published rate for the series on screen -- what the daily switch
    // writes. `latest` is a real BCV observation; the form's own value is the
    // month's, and writing that back would make the switch a no-op that looks
    // like it did something.
    //
    // The rates arrive as a prop rather than from usePage(), so the form needs
    // no page context and can be rendered on its own. Same reason the graph
    // takes its rate as a prop: a component that reads only what it is given
    // can be checked, and one that reaches for a global cannot.
    const dailyRate = Number((currency === EUR ? rates?.eur : rates?.usd)?.latest) || 0;
    const { data, setData, patch, processing, errors, reset, clearErrors, transform } = useForm({
        income_bs: budget.income_bs || '0',
        income_rate: budget.income_rate || '0',
        opening_balance_bs: budget.opening_balance_bs || '0',
        is_custom_rate: budget.is_custom_rate ?? false,
    });

    const [isAdditive, setIsAdditive] = useState(false);
    const [additiveAmount, setAdditiveAmount] = useState('');
    const [showCalendar, setShowCalendar] = useState(false);

    transform((formData) => {
        let finalIncome = formData.income_bs;
        if (isAdditive && additiveAmount !== '') {
            finalIncome = (parseFloat(budget.income_bs) + parseFloat(additiveAmount)).toString();
        }
        return {
            ...formData,
            income_bs: finalIncome,
        };
    });

    // Seed when the form OPENS, not whenever `budget` changes identity.
    //
    // This also depended on `budget`, and Inertia hands over a fresh budget
    // object after every response, so the effect re-ran on each one and reset
    // the fields from the stored values. A toggle or a typed rate was therefore
    // visibly applied and then silently reverted -- the switch lit up and the
    // mark did not stick. The guard below seeds on the show transition only,
    // so re-opening is still correct but an in-flight response is not.
    const wasShown = useRef(false);
    useEffect(() => {
        if (show && !wasShown.current) {
            setData({
                income_bs: budget.income_bs,
                income_rate: budget.income_rate,
                opening_balance_bs: budget.opening_balance_bs,
                is_custom_rate: budget.is_custom_rate ?? false,
            });
            setIsAdditive(false);
            setAdditiveAmount('');
        }
        wasShown.current = show;
    }, [show, budget, setData]);

    const handleFetchHistoricalRate = async (monthId, dayIso) => {
        if (!dayIso) return;
        try {
            // Ask for the series actually on screen. Requesting dollars here and
            // storing the answer in a euro screen would write a real but wrong
            // rate into income_rate and flag it custom, which is exactly the bug
            // the currency toggle would otherwise hide behind a correct symbol.
            const response = await axios.get(route('exchange-rate.history'), { params: { date: dayIso, currency } });
            if (response.data?.rate && parseFloat(response.data.rate) > 0) {
                // Update the form data with the fetched rate
                setData(d => ({...d, income_rate: response.data.rate, is_custom_rate: true}));
                // Also close the calendar once the rate is selected
                setShowCalendar(false);
            } else {
                alert('No se encontró una tasa registrada para esta fecha.');
            }
        } catch (error) {
            console.error("Failed to fetch rate", error);
            alert('Error al buscar la tasa histórica.');
        }
    };

    const submit = (e) => {
        e.preventDefault();

        patch(route('budgets.update', budget.month_id), {
            onSuccess: () => onClose(),
        });
    };

    // The Cancelar button is the deliberate exit and is allowed to discard
    // without asking -- the guard is for the accidental ones.
    const isDirty = useFormDirty(data, show);
    const handleClose = () => { clearErrors(); onClose(); };

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md" layoutId={layoutId} labelledBy="budget-form-title" dirty={isDirty}>
            <form onSubmit={submit} className="p-6 bg-white dark:bg-gray-900 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                      <h2 id="budget-form-title" className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
                          Configuración de {budget.month_label}
                      </h2>
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 select-none">
                          <input
                              type="checkbox"
                              // Checked means "follow today's BCV rate", which is
                              // what the label says. It used to be the negation
                              // of is_custom_rate, so the box showed checked
                              // while the state it wrote was "custom" -- the
                              // label and the meaning were crossed, which is why
                              // the mark looked like it disagreed with the press.
                              checked={!data.is_custom_rate}
                              onChange={(e) => setData(d => ({
                                  ...d,
                                  ...applyDailyRateSwitch(e.target.checked, dailyRate, d.income_rate),
                              }))}
                              className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-[#FF8A3D] focus:ring-[#FF8A3D] dark:border-gray-600 dark:bg-gray-900 dark:text-[#9B7BFF] dark:focus:ring-[#9B7BFF]"
                          />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-300">
                              Tasa Diaria BCV
                          </span>
                      </label>
                  </div>

                <div className="space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                id="additiveIncome"
                                checked={isAdditive}
                                onChange={(e) => setIsAdditive(e.target.checked)}
                                className="rounded dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-[#FF8A3D] focus:ring-[#FF8A3D]"
                            />
                            <InputLabel htmlFor="additiveIncome" value={`Sumar al ingreso actual (Bs ${parseFloat(budget.income_bs).toLocaleString('es-ES')})`} className="dark:text-gray-300 cursor-pointer" />
                        </div>

                        {isAdditive ? (
                            <FormattedNumberInput
                                id="additiveAmount"
                                name="additiveAmount"
                                placeholder="Monto a sumar…"
                                value={additiveAmount}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setAdditiveAmount(e.target.value)}
                                required
                            />
                        ) : (
                            <FormattedNumberInput
                                id="income_bs"
                                name="income_bs"
                                value={data.income_bs}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('income_bs', e.target.value)}
                                required
                            />
                        )}
                        <InputError message={errors.income_bs} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="income_rate" value="Tasa de Cambio (BCV)" className="dark:text-gray-300" />
                        <div className="flex gap-2">
                            <FormattedNumberInput
                                id="income_rate"
                                name="income_rate"
                                value={data.income_rate}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => {
                                    setData(d => ({...d, income_rate: e.target.value, is_custom_rate: true}));
                                }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowCalendar(true)}
                                className="px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <CalendarIcon size={20} />
                            </button>
                        </div>
                        <InputError message={errors.income_rate} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="opening_balance_bs" value="Saldo Inicial (Bs)" className="dark:text-gray-300" />
                        <FormattedNumberInput
                            id="opening_balance_bs"
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

                <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                    <SecondaryButton onClick={handleClose} className="w-full sm:w-auto justify-center dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="w-full sm:w-auto justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        {processing ? 'Guardando…' : 'Guardar'}
                    </PrimaryButton>
                </div>
            </form>

            <BudgetCalendar
                show={showCalendar}
                onClose={() => setShowCalendar(false)}
                onSelect={handleFetchHistoricalRate}
                initialMonthId={budget.month_id}
                mode="pickDay"
                title="Buscar tasa histórica"
            />
        </Modal>
    );
}

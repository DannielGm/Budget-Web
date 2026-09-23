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
import { Calendar as CalendarIcon } from 'lucide-react';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export default function BudgetForm({ show, onClose, budget }) {
    const { rate } = usePage().props;
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

    useEffect(() => {
        if (show) {
            setData({
                income_bs: budget.income_bs,
                income_rate: budget.income_rate,
                opening_balance_bs: budget.opening_balance_bs,
            });
            setIsAdditive(false);
            setAdditiveAmount('');
        }
    }, [show, budget]);

    const handleFetchHistoricalRate = async (monthId, dayIso) => {
        if (!dayIso) return;
        try {
            const response = await axios.get(route('exchange-rate.history'), { params: { date: dayIso } });
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

    const handleClose = () => {
        clearErrors();
        onClose();
    };

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md">
            <form onSubmit={submit} className="p-6 bg-white dark:bg-gray-900 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 uppercase tracking-tight">
                          Configuración de {budget.month_label}
                      </h2>
                      <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider select-none">
                              Tasa Diaria BCV
                          </span>
                          <button
                              type="button"
                              onClick={() => {
                                  const isNowAuto = !!data.is_custom_rate; // toggling it back to auto
                                  if (isNowAuto && rate?.rate) {
                                      setData(d => ({ ...d, is_custom_rate: false, income_rate: rate.rate }));
                                  } else {
                                      setData('is_custom_rate', !data.is_custom_rate);
                                  }
                              }}
                              className={cn(
                                  "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FF8A3D] focus:ring-offset-2",
                                  !data.is_custom_rate ? "bg-[#FF8A3D] dark:bg-[#9B7BFF]" : "bg-gray-200 dark:bg-gray-700"
                              )}
                          >
                              <span
                                  className={cn(
                                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                      !data.is_custom_rate ? "translate-x-4" : "translate-x-0"
                                  )}
                              />
                          </button>
                      </div>
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
                                placeholder="Monto a sumar"
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
                        Guardar
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

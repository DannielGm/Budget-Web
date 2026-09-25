import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormattedNumberInput from '@/Components/FormattedNumberInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import BudgetCalendar from '@/Components/Budget/BudgetCalendar';
import { router, useForm, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { fmtBs, fmtUsd, fmtRate } from '@/lib/money';

const pad = (n) => String(n).padStart(2, '0');

function formatTimestamp(ms) {
    const d = new Date(ms);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ExpenseForm({ show, onClose, expense = null, categoryName, monthId, defaultRate }) {
    const { budget } = usePage().props;
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showRateEditor, setShowRateEditor] = useState(false);
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
    const amountBs = Number(data.amount_bs) || 0;
    const appliedRate = Number(data.rate) || 0;
    const amountUsd = appliedRate > 0 ? amountBs / appliedRate : 0;
    const availableBalance = Number(budget.available_balance_bs) || 0;
    const isCash = Boolean(category?.cash_expense) && !isPresupuesto;
    const impactTitle = isPresupuesto
        ? 'Solo seguimiento del presupuesto'
        : isCash
            ? 'Se descontará del saldo disponible'
            : 'Se sumará a las compras a crédito';
    const impactTone = isPresupuesto
        ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-300'
        : isCash
            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
            : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300';

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
        setShowRateEditor(false);
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

    const handleDelete = () => {
        if (!expense || !window.confirm(`¿Eliminar “${expense.label}”? Esta acción no se puede deshacer.`)) return;
        router.delete(route('expenses.destroy', expense.id), {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md">
            <form onSubmit={submit} className="max-h-[88vh] overflow-y-auto p-5 bg-white dark:bg-gray-900 transition-colors sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                    {expense && (
                        <button type="button" onClick={handleDelete} title="Eliminar gasto" aria-label="Eliminar gasto" className="touch-feedback shrink-0 rounded-xl p-2.5 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                            <Trash2 size={18} aria-hidden="true" />
                        </button>
                    )}
                    <div className="min-w-0">
                        <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">{expense ? 'Editar gasto' : 'Nuevo gasto'}</h2>
                        <p className="mt-0.5 truncate text-xs font-bold text-gray-400">{categoryName} · {isPresupuesto ? 'Presupuesto' : isCash ? 'Contado' : 'Crédito'}</p>
                    </div>
                </div>

                <div className="space-y-5">
                    <div>
                        <InputLabel htmlFor="label" value="Concepto" className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400" />
                        <TextInput
                            id="label" type="text" name="label" value={data.label}
                            className="mt-2 block min-h-12 w-full rounded-xl px-4 text-base dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('label', e.target.value)} placeholder="Ej.: Supermercado"
                            enterKeyHint="next" autoComplete="off" required
                        />
                        <InputError message={errors.label} className="mt-2" />
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                        <InputLabel htmlFor="amount_bs" value="Monto" className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400" />
                        <div className="mt-2 flex items-center gap-2">
                            <span className="font-serif text-xl font-black text-gray-400">Bs</span>
                            <FormattedNumberInput
                                id="amount_bs" name="amount_bs" value={data.amount_bs}
                                className="min-h-14 w-full border-0 bg-transparent px-0 text-3xl font-black font-serif tabular shadow-none focus:ring-0 dark:text-white"
                                onChange={(e) => setData('amount_bs', e.target.value)} inputMode="decimal"
                                aria-describedby="amount-usd-help" required
                            />
                        </div>
                        <p id="amount-usd-help" className="mt-1 text-sm font-bold tabular text-gray-500 dark:text-gray-300">
                            ≈ $ {fmtUsd(amountUsd)} <span className="text-xs font-medium text-gray-400">@ {fmtRate(appliedRate)} Bs/USD</span>
                        </p>
                        <InputError message={errors.amount_bs} className="mt-2" />
                    </div>

                    <div className="rounded-xl border border-gray-100 dark:border-gray-800">
                        <button type="button" onClick={() => setShowRateEditor((value) => !value)} className="touch-feedback flex min-h-12 w-full items-center justify-between px-4 text-left" aria-expanded={showRateEditor}>
                            <span><span className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Tasa aplicada</span><span className="mt-0.5 block text-sm font-bold tabular text-gray-700 dark:text-gray-200">{fmtRate(appliedRate)} Bs/USD</span></span>
                            {showRateEditor ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                        </button>
                        {showRateEditor && (
                            <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                                <InputLabel htmlFor="rate" value="Cambiar tasa BCV" className="text-xs font-bold text-gray-500 dark:text-gray-400" />
                                <FormattedNumberInput id="rate" name="rate" value={data.rate} className="mt-2 block min-h-11 w-full dark:bg-gray-800 dark:text-white dark:border-gray-700" onChange={(e) => setData('rate', e.target.value)} inputMode="decimal" required />
                                <InputError message={errors.rate} className="mt-2" />
                            </div>
                        )}
                    </div>

                    {expense && isPresupuesto && (
                        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                            <label htmlFor="moveToReal" className="flex cursor-pointer items-center gap-3">
                                <input type="checkbox" id="moveToReal" checked={moveToReal} onChange={(e) => setMoveToReal(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-[#FF8A3D] focus:ring-[#FF8A3D] dark:border-gray-700" />
                                <span className="text-sm font-bold text-indigo-900 dark:text-indigo-200">Convertir en gasto real</span>
                            </label>
                            <p className="mt-2 text-xs text-indigo-700/80 dark:text-indigo-300/80">Al convertirlo, pasará a reducir el saldo disponible.</p>
                            {moveToReal && (
                                <div className="mt-3">
                                    <InputLabel htmlFor="targetCategory" value="Categoría real" className="text-xs font-bold text-indigo-700 dark:text-indigo-300" />
                                    <select id="targetCategory" value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border-indigo-200 bg-white text-sm text-gray-800 dark:border-indigo-900 dark:bg-gray-900 dark:text-white">
                                        {realCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <InputLabel htmlFor="timestamp" value="Fecha y hora" className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400" />
                        <TextInput id="timestamp" type="text" value={formatTimestamp(Number(data.timestamp))} readOnly className="mt-2 block min-h-12 w-full dark:bg-gray-800 dark:text-white dark:border-gray-700" />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setShowDatePicker(true)} className="touch-feedback min-h-11 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-wider text-gray-700 dark:border-gray-700 dark:text-gray-200">Elegir fecha</button>
                            <button type="button" onClick={() => setData('timestamp', Date.now())} className="touch-feedback min-h-11 rounded-xl border border-gray-200 text-xs font-black uppercase tracking-wider text-gray-700 dark:border-gray-700 dark:text-gray-200">Ahora</button>
                        </div>
                    </div>

                    <div className={`rounded-xl border p-4 ${impactTone}`} aria-live="polite">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Efecto de este gasto</p>
                        <p className="mt-1 text-sm font-black">{impactTitle}</p>
                        {isCash && amountBs > 0 && <p className="mt-1 text-xs font-bold tabular">Saldo después: Bs {fmtBs(availableBalance - amountBs)}</p>}
                    </div>
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <SecondaryButton onClick={handleClose} className="min-h-12 w-full justify-center dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 sm:w-auto">Cancelar</SecondaryButton>
                    <PrimaryButton className="min-h-12 w-full justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity sm:w-auto" disabled={processing}>
                        {processing ? 'Guardando…' : expense ? 'Guardar cambios' : 'Guardar gasto'}
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

import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormattedNumberInput from '@/Components/FormattedNumberInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import BudgetCalendar from '@/Components/Budget/BudgetCalendar';
import { useForm, router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { useConfirm } from '@/Components/ConfirmationProvider';
import { fmtBs, fmtUsd, fmtRate } from '@/lib/money';
import { calculateDebt, n } from '@/lib/debtMath';
import { useCurrencySymbol, useBolivarFigure, useRateLabel } from '@/hooks/useFigure';

const pad = (value) => String(value).padStart(2, '0');
const paymentDate = (ms) => {
    const d = new Date(Number(ms));
    return isNaN(d.getTime()) ? '--/--/----' : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const tabs = [
    { id: 'details', label: 'Datos' },
    { id: 'payment', label: 'Registrar pago' },
    { id: 'history', label: 'Historial' },
];

export default function DebtForm({ show, onClose, debt = null, monthId, rate = 0,
    layoutId = null,
}) {
    const confirmAction = useConfirm();
    const symbol = useCurrencySymbol();
    const foreign = useBolivarFigure();
    const rateLabel = useRateLabel();
    const { data, setData, post, patch, processing, errors, reset, clearErrors, transform } = useForm({
        month_id: monthId,
        label: debt?.label || '',
        opening_bs: debt?.opening_bs || '',
        payment_bs: debt?.payment_bs || '',
        additive_amount: '',
        additive_method: 'Transferencia',
        additive_timestamp: Date.now(),
    });
    const [mode, setMode] = useState('details');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isAdditive, setIsAdditive] = useState(false);

    transform((values) => ({
        ...values,
        additive_amount: isAdditive ? values.additive_amount : null,
        additive_method: isAdditive ? values.additive_method : null,
        additive_timestamp: isAdditive ? values.additive_timestamp : null,
    }));

    useEffect(() => {
        if (!show) return;
        reset();
        setData({
            month_id: monthId,
            label: debt?.label || '',
            opening_bs: debt?.opening_bs || '',
            payment_bs: debt?.payment_bs || '',
            additive_amount: '',
            additive_method: 'Transferencia',
            additive_timestamp: Date.now(),
        });
        setMode('details');
        setIsAdditive(false);
        clearErrors();
    }, [debt, monthId, show]);

    const summary = useMemo(() => calculateDebt({
        ...(debt || {}),
        opening_bs: data.opening_bs,
        payment_bs: debt?.payment_bs || 0,
        credit_expenses_bs: debt?.credit_expenses_bs || 0,
        payments: debt?.payments || [],
    }, rate), [data.opening_bs, debt, rate]);
    const additive = isAdditive ? n(data.additive_amount) : 0;
    const remainingAfterPayment = Math.max(0, summary.remainingBs - additive);
    const amountUsd = n(rate) > 0 ? n(data.additive_amount) / n(rate) : 0;

    const close = () => { clearErrors(); reset(); onClose(); };
    const submit = (event) => {
        event.preventDefault();
        const options = { onSuccess: close };
        if (debt) patch(route('debts.update', debt.id), options);
        else post(route('debts.store'), options);
    };
    const removeDebt = async () => {
        const confirmed = await confirmAction({
            title: 'Eliminar deuda',
            message: `Se eliminará “${debt.label}” y todo su historial de pagos.`,
            detail: 'Esta acción no se puede deshacer.',
            confirmLabel: 'Eliminar deuda',
            tone: 'danger',
        });
        if (confirmed) router.delete(route('debts.destroy', debt.id), { onSuccess: close });
    };
    const removePayment = async (payment) => {
        const confirmed = await confirmAction({
            title: 'Eliminar pago',
            message: `Se eliminará el pago de Bs ${fmtBs(payment.amount_bs)}.`,
            detail: 'El pendiente de la deuda aumentará en el mismo monto.',
            confirmLabel: 'Eliminar pago',
            tone: 'danger',
        });
        if (confirmed) router.delete(route('debt-payments.destroy', payment.id), { preserveScroll: true });
    };

    return (
        <Modal show={show} onClose={close} maxWidth="md" layoutId={layoutId}>
            <form onSubmit={submit} className="max-h-[88dvh] overflow-y-auto bg-white p-5 dark:bg-gray-900">

                <div className="flex items-center gap-3">
                    {debt && <button type="button" onClick={removeDebt} aria-label={`Eliminar deuda ${debt.label}`} className="touch-feedback flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={18} /></button>}
                    <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold uppercase tracking-tight text-gray-900 dark:text-gray-100">{debt ? 'Administrar deuda' : 'Nueva deuda'}</h2><p className="truncate text-xs text-gray-400">{debt ? `${debt.label} · Bs ${fmtBs(summary.remainingBs)}` : 'Registra el saldo inicial y su seguimiento.'}</p></div>
                </div>

                {debt && <div role="tablist" aria-label="Secciones de deuda" className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">{tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={mode === tab.id} onClick={() => { setMode(tab.id); setIsAdditive(tab.id === 'payment'); }} className={`touch-feedback min-h-11 rounded-lg px-1 text-[10px] font-black uppercase tracking-wide ${mode === tab.id ? 'bg-white text-[#FF8A3D] shadow-sm dark:text-[#9B7BFF]' : 'text-gray-500 dark:text-gray-400'}`}>{tab.label}</button>)}</div>}

                <div className="mt-5 space-y-4">
                    {(mode === 'details' || !debt) && <>
                        <div><InputLabel htmlFor="label" value="Nombre de la deuda" className="dark:text-gray-300" /><TextInput id="label" value={data.label} onChange={(e) => setData('label', e.target.value)} required disabled={!!debt && debt.label.includes('Compras a crédito')} className="mt-1 block w-full dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><InputError message={errors.label} className="mt-2" /></div>
                        <div><InputLabel htmlFor="opening_bs" value="Saldo inicial (Bs)" className="dark:text-gray-300" /><FormattedNumberInput id="opening_bs" value={data.opening_bs} onChange={(e) => setData('opening_bs', e.target.value)} disabled={!!debt} className="mt-1 block w-full dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><InputError message={errors.opening_bs} className="mt-2" /></div>
                        {!debt && <div><InputLabel htmlFor="payment_bs" value="Pago inicial (Bs) · opcional" className="dark:text-gray-300" /><FormattedNumberInput id="payment_bs" value={data.payment_bs} onChange={(e) => setData('payment_bs', e.target.value)} className="mt-1 block w-full dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><InputError message={errors.payment_bs} className="mt-2" /></div>}
                    </>}

                    {debt && <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-800/60"><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Estado actual</p><dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-300">Saldo original</dt><dd className="font-bold tabular text-gray-900 dark:text-white">Bs {fmtBs(summary.openingBs)}</dd></div><div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-300">Nuevos cargos</dt><dd className="font-bold tabular text-red-500 dark:text-red-400">Bs {fmtBs(summary.currentChargesBs)}</dd></div><div className="flex justify-between gap-3 border-t border-gray-200 pt-2 dark:border-gray-700"><dt className="font-bold text-gray-900 dark:text-white">Pendiente</dt><dd className="text-base font-black tabular text-gray-900 dark:text-white">Bs {fmtBs(summary.remainingBs)}<span className="block text-[10px] font-bold text-gray-500 dark:text-gray-400">≈ {fmtUsd(summary.remainingUsd)}</span></dd></div></dl></div>}

                    {mode === 'payment' && debt && <div className="space-y-4 rounded-2xl border border-gray-100 p-4 dark:border-gray-800"><div><InputLabel htmlFor="additive_amount" value="Monto del pago (Bs)" className="dark:text-gray-300" /><FormattedNumberInput id="additive_amount" value={data.additive_amount} onChange={(e) => setData('additive_amount', e.target.value)} required className="mt-1 block w-full dark:border-gray-700 dark:bg-gray-800 dark:text-white" /><p className="mt-1 text-[10px] font-bold tabular text-gray-400">≈ {fmtUsd(amountUsd)} @ {fmtRate(rate)} {rateLabel}</p><InputError message={errors.additive_amount} className="mt-2" /></div>
                        <div><InputLabel htmlFor="additive_method" value="Método" className="dark:text-gray-300" /><TextInput id="additive_method" value={data.additive_method} onChange={(e) => setData('additive_method', e.target.value)} className="mt-1 block w-full dark:border-gray-700 dark:bg-gray-800 dark:text-white" /></div>
                        <div><InputLabel value="Fecha del pago" className="dark:text-gray-300" /><div className="mt-1 grid grid-cols-2 gap-2"><button type="button" onClick={() => setShowDatePicker(true)} className="touch-feedback min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-bold dark:border-gray-700 dark:bg-gray-800">{paymentDate(data.additive_timestamp)}</button><button type="button" onClick={() => setData('additive_timestamp', Date.now())} className="touch-feedback min-h-11 rounded-xl border border-gray-200 px-3 text-sm font-bold dark:border-gray-700 dark:bg-gray-800">Hoy</button></div></div>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">Después del pago: <span className="tabular text-gray-700 dark:text-white">Bs {fmtBs(remainingAfterPayment)}</span></p>
                    </div>}


                    {mode === 'history' && debt && <div><p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Historial de pagos</p><div className="space-y-2">{summary.payments.length ? summary.payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><div className="min-w-0"><p className="truncate text-sm font-bold dark:text-gray-100">{payment.method}</p><p className="text-[10px] text-gray-400">{paymentDate(payment.timestamp)}</p></div><div className="flex shrink-0 items-center gap-2"><span className="whitespace-nowrap text-sm font-black tabular text-emerald-600 dark:text-emerald-400">Bs {fmtBs(payment.amount_bs)}</span><button type="button" onClick={() => removePayment(payment)} aria-label={`Eliminar pago de Bs ${fmtBs(payment.amount_bs)}`} className="touch-feedback flex h-11 w-11 items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><Trash2 size={16} /></button></div></div>) : <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 dark:border-gray-700">Sin pagos registrados</p>}</div></div>}
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <SecondaryButton type="button" onClick={close} className="w-full justify-center dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">Cancelar</SecondaryButton>
                    {mode !== 'history' && <PrimaryButton type="submit" disabled={processing} className="w-full justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90">{processing ? 'Guardando…' : debt ? (mode === 'payment' ? 'Registrar pago' : 'Guardar cambios') : 'Crear deuda'}</PrimaryButton>}
                </div>
            </form>

            <BudgetCalendar show={showDatePicker} onClose={() => setShowDatePicker(false)} mode="pickDay" title="Fecha del pago" initialMonthId={monthId} initialDayIso={(() => { const d = new Date(Number(data.additive_timestamp)); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })()} onSelect={(calMonthId, dayIso) => { if (!dayIso) return; const previous = new Date(Number(data.additive_timestamp)); const picked = new Date(`${dayIso}T00:00:00`); picked.setHours(previous.getHours(), previous.getMinutes(), 0, 0); setData('additive_timestamp', picked.getTime()); setShowDatePicker(false); }} />
        </Modal>
    );
}

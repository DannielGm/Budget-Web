import React, { useEffect } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import FormattedNumberInput from '@/Components/FormattedNumberInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router } from '@inertiajs/react';
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react';
import { useConfirm } from '@/Components/ConfirmationProvider';

const POOL_LABELS = { Digital: 'Digital', Bank: 'Banco', Physical: 'Físico' };
const POOLS = ['Digital', 'Bank', 'Physical'];
const EXTERNAL = 'Externo';

/**
 * Unified savings movement form (create + edit + delete).
 *  - Opened from the savings card  -> cash <-> pool movements (Depósito / Retiro).
 *  - Opened from a pool square     -> the pool's own movements, where the
 *    counterpart defaults to "Externo" (a brute fact depósito/retiro that does
 *    NOT touch the available budget) and can optionally be another pool.
 * The equivalent rate is always derived from the two entered amounts (pools may
 * use non-official rates), never from BCV.
 */
export default function TransferModal({ show, onClose, monthId, transfer = null, pool = null }) {
    const confirmAction = useConfirm();
    const { data, setData, post, patch, processing, errors, reset, clearErrors } = useForm({
        month_id: monthId,
        source_type: 'cash',
        source_id: '',
        destination_type: 'saving',
        destination_id: 'Digital',
        amount_bs: '',
        amount_usd: '',
        timestamp: Date.now(),
        note: '',
    });

    useEffect(() => {
        if (!show) return;

        if (transfer) {
            // Edit mode: prefill from the stored row.
            setData({
                month_id: monthId,
                source_type: transfer.source_type,
                source_id: transfer.source_id || '',
                destination_type: transfer.destination_type,
                destination_id: transfer.destination_id || '',
                amount_bs: transfer.amount_bs,
                amount_usd: transfer.amount_usd,
                timestamp: transfer.timestamp,
                note: transfer.note || '',
            });
            return;
        }

        reset();
        setData('month_id', monthId);
        setData('timestamp', Date.now());

        if (pool) {
            // Pool mode: default to a brute fact Depósito into this pool.
            setData('source_type', 'external');
            setData('source_id', '');
            setData('destination_type', 'saving');
            setData('destination_id', pool);
        } else {
            setData('destination_id', 'Digital');
        }
    }, [show, monthId, transfer, pool]);

    const isEditing = transfer !== null;
    const isPoolMode = pool !== null;

    // In pool mode the "movement direction" is which leg the pool sits on.
    const isDeposit = isPoolMode
        ? data.destination_type === 'saving'
        : data.source_type === 'cash';

    // When depositing into a pool from Externo, the Bs amount is implicit (no budget impact).
    const isPoolToPool = isPoolMode && isDeposit && data.source_type === 'external';

    // Counterpart shown next to the pool (Externo or the other pools).
    const counterpart = isPoolMode
        ? (data.destination_type === 'saving' ? data.source_type : data.destination_type) === 'external'
            ? EXTERNAL
            : (data.destination_type === 'saving' ? data.source_id : data.destination_id)
        : null;

    const handleOrigin = (value) => {
        setData('source_type', value);
        if (value === 'saving') {
            setData('source_id', '');
            setData('destination_type', 'cash');
            setData('destination_id', '');
        } else {
            setData('destination_type', 'saving');
            setData('destination_id', 'Digital');
        }
    };

    // Pool mode: flip between Depósito (pool as destination) and Retiro (pool as source).
    const setDirection = (deposit) => {
        if (deposit) {
            setData('source_type', counterpart === EXTERNAL ? 'external' : 'saving');
            setData('source_id', counterpart === EXTERNAL ? '' : counterpart);
            setData('destination_type', 'saving');
            setData('destination_id', pool);
        } else {
            setData('source_type', 'saving');
            setData('source_id', pool);
            setData('destination_type', 'external');
            setData('destination_id', '');
        }
    };

    // Pool mode: choose the counterpart (Externo = no budget impact, or another pool).
    const handleCounterpart = (value) => {
        const type = value === EXTERNAL ? 'external' : 'saving';
        const id = value === EXTERNAL ? '' : value;
        if (data.destination_type === 'saving') {
            setData('source_type', type);
            setData('source_id', id);
        } else {
            setData('destination_type', type);
            setData('destination_id', id);
        }
    };

    // Effective rate derived from the entered amounts.
    const derivedRate = parseFloat(data.amount_bs) > 0 && parseFloat(data.amount_usd) > 0
        ? parseFloat(data.amount_bs) / parseFloat(data.amount_usd)
        : null;

    const submit = (e) => {
        e.preventDefault();
        const options = {
            onSuccess: () => {
                reset();
                onClose();
            },
        };

        if (isEditing) {
            patch(route('transfers.update', transfer.id), options);
        } else {
            post(route('transfers.store'), options);
        }
    };

    const handleDelete = async () => {
        if (!isEditing) return;
        const confirmed = await confirmAction({
            title: 'Eliminar movimiento',
            message: 'Se eliminará este movimiento de transferencia.',
            detail: 'Los saldos de efectivo y ahorro se revertirán automáticamente.',
            confirmLabel: 'Eliminar movimiento',
            tone: 'danger',
        });
        if (!confirmed) return;
        router.delete(route('transfers.destroy', transfer.id), {
            onSuccess: () => { reset(); onClose(); },
        });
    };

    const handleClose = () => {
        clearErrors();
        onClose();
    };

    const title = isEditing
        ? 'Editar Movimiento'
        : isPoolMode
            ? (isDeposit ? 'Nuevo Depósito' : 'Nuevo Retiro')
            : (isDeposit ? 'Nuevo Depósito' : 'Nuevo Retiro');

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md">
            <form onSubmit={submit} className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex items-center gap-2 mb-6">
                    {isEditing && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            title="Eliminar movimiento"
                            className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                    <div className={`p-2 rounded-lg ${isDeposit
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}
                    >
                        {isDeposit ? <ArrowDownToLine size={24} /> : <ArrowUpFromLine size={24} />}
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter">
                        {title}
                    </h2>
                    {isPoolMode && (
                        <span className="ml-auto text-[10px] px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 font-black uppercase tracking-wider">
                            {POOL_LABELS[pool] || pool}
                        </span>
                    )}
                </div>

                <div className="space-y-4">
                    {isPoolMode ? (
                        <>
                            {/* Depósito / Retiro toggle (same pattern as SavingsForm) */}
                            <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => setDirection(true)}
                                    className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${isDeposit ? 'bg-green-500 text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                >
                                    Depósito
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDirection(false)}
                                    className={`py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${!isDeposit ? 'bg-red-500 text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                >
                                    Retiro
                                </button>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <InputLabel
                                    value={isDeposit ? `Origen (fuera de ${POOL_LABELS[pool] || pool})` : `Destino (fuera de ${POOL_LABELS[pool] || pool})`}
                                    className="dark:text-gray-300 font-bold uppercase tracking-wider text-xs mb-2"
                                />
                                {isDeposit ? (
                                    <select
                                        value={counterpart}
                                        onChange={(e) => handleCounterpart(e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                                    >
                                        <option value={EXTERNAL}>{EXTERNAL} (no afecta el saldo disponible)</option>
                                        {POOLS.filter((p) => p !== pool).map((p) => (
                                            <option key={p} value={p}>{POOL_LABELS[p]}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="block w-full rounded-md border-gray-300 shadow-sm dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm py-2 px-3">
                                        <span className="text-gray-400">{EXTERNAL} (no afecta el saldo disponible)</span>
                                    </div>
                                )}
                                {counterpart === EXTERNAL && (
                                    <p className="text-[10px] text-gray-400 font-bold mt-2">
                                        Movimiento externo al presupuesto: no altera el efectivo disponible.
                                    </p>
                                )}
                                <InputError message={errors.source_id || errors.destination_id} className="mt-2" />
                                <InputError message={errors.source_type || errors.destination_type} className="mt-2" />
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Origin */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <InputLabel value="Origen" className="dark:text-gray-300 font-bold uppercase tracking-wider text-xs mb-2" />
                                <select
                                    value={data.source_type}
                                    onChange={(e) => handleOrigin(e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                                >
                                    <option value="cash">Efectivo Disponible (Bs)</option>
                                    <option value="saving">Fondo de Ahorro</option>
                                </select>
                                {data.source_type === 'saving' && (
                                    <select
                                        value={data.source_id}
                                        onChange={(e) => setData('source_id', e.target.value)}
                                        className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                                    >
                                        <option value="">- Seleccionar fondo -</option>
                                        {POOLS.map((p) => (
                                            <option key={p} value={p}>{POOL_LABELS[p]}</option>
                                        ))}
                                    </select>
                                )}
                                <InputError message={errors.source_type} className="mt-2" />
                                <InputError message={errors.source_id} className="mt-2" />
                            </div>

                            {/* Destination (counterpart only, no expense categories) */}
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <InputLabel value="Destino" className="dark:text-gray-300 font-bold uppercase tracking-wider text-xs mb-2" />
                                {data.source_type === 'cash' ? (
                                    <select
                                        value={data.destination_id}
                                        onChange={(e) => setData('destination_id', e.target.value)}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                                    >
                                        <option value="">- Seleccionar fondo -</option>
                                        {POOLS.map((p) => (
                                            <option key={p} value={p}>{POOL_LABELS[p]}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <p className="text-sm font-bold text-gray-600 dark:text-gray-300 py-2">
                                        Efectivo Disponible (Bs)
                                    </p>
                                )}
                                <InputError message={errors.destination_type} className="mt-2" />
                                <InputError message={errors.destination_id} className="mt-2" />
                            </div>
                        </>
                    )}

                    {/* Amounts */}
                    <div className={`grid gap-4 ${isPoolToPool ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {!isPoolToPool && (
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
                        )}
                        <div>
                            <InputLabel htmlFor="amount_usd" value="Monto ($)" className="dark:text-gray-300" />
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
                    </div>

                    {/* Equivalence derived from the entered amounts — only when both amounts are editable */}
                    {!isPoolToPool && (
                        <div>
                            <p className="text-xs text-gray-400 font-bold dark:text-gray-500">
                                {derivedRate
                                    ? `Equivalente: Bs ${parseFloat(data.amount_bs).toLocaleString('es-ES', { minimumFractionDigits: 2 })} @ ${derivedRate.toLocaleString('es-ES', { minimumFractionDigits: 2 })} Bs/$`
                                    : 'Equivalente: ingresa ambos montos para ver la tasa efectiva'}
                            </p>
                        </div>
                    )}

                    <div>
                        <InputLabel htmlFor="note" value="Concepto" className="dark:text-gray-300" />
                        <TextInput
                            id="note"
                            type="text"
                            value={data.note}
                            placeholder="Ej: Compra de divisas, Retiro para gastos"
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('note', e.target.value)}
                        />
                        <InputError message={errors.note} className="mt-2" />
                    </div>
                </div>

                <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                    <SecondaryButton onClick={handleClose} className="w-full sm:w-auto justify-center dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="w-full sm:w-auto justify-center bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        {isEditing ? 'Guardar' : (isDeposit ? 'Depositar' : 'Retirar')}
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

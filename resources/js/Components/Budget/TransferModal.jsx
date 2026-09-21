import React, { useEffect } from 'react';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { useForm, router } from '@inertiajs/react';
import { ArrowRightLeft } from 'lucide-react';

export default function TransferModal({ show, onClose, monthId, defaultRate, categories }) {
    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        month_id: monthId,
        source_type: 'cash',
        source_id: '',
        destination_type: 'category',
        destination_id: categories[0]?.name || '',
        amount_bs: '',
        amount_usd: '',
        rate: defaultRate || '',
        timestamp: Date.now(),
        note: '',
    });

    useEffect(() => {
        if (show) {
            reset();
            setData('month_id', monthId);
            setData('rate', defaultRate);
            setData('timestamp', Date.now());
            setData('destination_id', categories[0]?.name || '');
        }
    }, [show, monthId]);

    const submit = (e) => {
        e.preventDefault();
        post(route('transfers.store'), {
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    };

    const handleClose = () => {
        clearErrors();
        onClose();
    };

    return (
        <Modal show={show} onClose={handleClose} maxWidth="md">
            <form onSubmit={submit} className="p-6 bg-white dark:bg-gray-900 transition-colors">
                <div className="flex items-center gap-2 mb-6">
                    <div className="bg-[#FF8A3D]/10 p-2 rounded-lg">
                        <ArrowRightLeft className="text-[#FF8A3D] dark:text-[#9B7BFF]" size={24} />
                    </div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter">
                        Nueva Transferencia
                    </h2>
                </div>

                <div className="space-y-4">
                    {/* Source Selection */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                        <InputLabel value="Origen" className="dark:text-gray-300 font-bold uppercase tracking-wider text-xs mb-2" />
                        <select
                            value={data.source_type}
                            onChange={(e) => setData('source_type', e.target.value)}
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
                                <option value="Binance">Binance</option>
                                <option value="Bank">Banco</option>
                                <option value="Physical">Físico</option>
                            </select>
                        )}
                        <InputError message={errors.source_type} className="mt-2" />
                        <InputError message={errors.source_id} className="mt-2" />
                    </div>

                    {/* Destination Selection */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                        <InputLabel value="Destino" className="dark:text-gray-300 font-bold uppercase tracking-wider text-xs mb-2" />
                        <select
                            value={data.destination_type}
                            onChange={(e) => {
                                setData('destination_type', e.target.value);
                                if (e.target.value === 'category') setData('destination_id', categories[0]?.name || '');
                                else if (e.target.value === 'saving') setData('destination_id', '');
                                else setData('destination_id', '');
                            }}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                        >
                            <option value="category">Gasto en Categoría</option>
                            <option value="saving">Fondo de Ahorro</option>
                            <option value="cash">Efectivo Disponible (Bs)</option>
                        </select>
                        {data.destination_type === 'category' && (
                            <select
                                value={data.destination_id}
                                onChange={(e) => setData('destination_id', e.target.value)}
                                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                            >
                                {categories.map(c => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                            </select>
                        )}
                        {data.destination_type === 'saving' && (
                            <select
                                value={data.destination_id}
                                onChange={(e) => setData('destination_id', e.target.value)}
                                className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#FF8A3D] focus:ring-[#FF8A3D] dark:bg-gray-800 dark:text-white dark:border-gray-700 sm:text-sm"
                            >
                                <option value="">- Seleccionar fondo -</option>
                                <option value="Binance">Binance</option>
                                <option value="Bank">Banco</option>
                                <option value="Physical">Físico</option>
                            </select>
                        )}
                        <InputError message={errors.destination_type} className="mt-2" />
                        <InputError message={errors.destination_id} className="mt-2" />
                    </div>

                    {/* Amount */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <InputLabel htmlFor="amount_bs" value="Monto (Bs)" className="dark:text-gray-300" />
                            <TextInput
                                id="amount_bs"
                                type="number"
                                step="0.01"
                                value={data.amount_bs}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('amount_bs', e.target.value)}
                                required
                            />
                            <InputError message={errors.amount_bs} className="mt-2" />
                        </div>
                        <div>
                            <InputLabel htmlFor="amount_usd" value="Monto ($)" className="dark:text-gray-300" />
                            <TextInput
                                id="amount_usd"
                                type="number"
                                step="0.01"
                                value={data.amount_usd}
                                className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                                onChange={(e) => setData('amount_usd', e.target.value)}
                            />
                            <InputError message={errors.amount_usd} className="mt-2" />
                        </div>
                    </div>

                    <div>
                        <InputLabel htmlFor="note" value="Nota (Opcional)" className="dark:text-gray-300" />
                        <TextInput
                            id="note"
                            type="text"
                            value={data.note}
                            className="mt-1 block w-full dark:bg-gray-800 dark:text-white dark:border-gray-700"
                            onChange={(e) => setData('note', e.target.value)}
                        />
                        <InputError message={errors.note} className="mt-2" />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <SecondaryButton onClick={handleClose} className="dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600">
                        Cancelar
                    </SecondaryButton>
                    <PrimaryButton className="bg-[#FF8A3D] dark:bg-[#9B7BFF] hover:opacity-90 transition-opacity" disabled={processing}>
                        Transferir
                    </PrimaryButton>
                </div>
            </form>
        </Modal>
    );
}

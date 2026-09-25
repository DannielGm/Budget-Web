import React, { useEffect, useState } from 'react';
import Modal from '@/Components/Modal';
import axios from 'axios';
import { MonitorSmartphone, Copy, Check, Power, ShieldCheck, Wifi } from 'lucide-react';

const remaining = (expiresAt) => Math.max(0, Math.ceil((Number(expiresAt) * 1000 - Date.now()) / 1000));

export default function RemoteDesktopPanel({ show, onClose }) {
    const [status, setStatus] = useState({ active: false });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState('');
    const [seconds, setSeconds] = useState(0);

    const refresh = async () => {
        try {
            const { data } = await axios.get(route('remote-desktop.status'));
            setStatus(data); setSeconds(remaining(data.expires_at));
            if (!data.active) setError('');
            return data;
        } catch (e) { setError(e?.response?.data?.message || 'No se pudo leer el estado.'); return {}; }
    };

    useEffect(() => {
        if (!show) return;
        refresh();
        const timer = setInterval(refresh, 5000);
        return () => clearInterval(timer);
    }, [show]);

    useEffect(() => {
        if (!status.active || seconds <= 0) return;
        const timer = setTimeout(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
        return () => clearTimeout(timer);
    }, [status.active, seconds]);

    const start = async () => {
        setBusy(true); setError('');
        try {
            const { data } = await axios.post(route('remote-desktop.start'), { port: 8080, ttl_minutes: 15 });
            if (data.status === 'error' || data.error) setError(data.message || data.error);
            else { setStatus(data); setSeconds(remaining(data.expires_at)); }
        } catch (e) { setError(e?.response?.data?.message || 'No se pudo activar la conexión.'); }
        setBusy(false);
    };

    const stop = async () => {
        setBusy(true); setError('');
        try { const { data } = await axios.post(route('remote-desktop.stop')); setStatus(data); setSeconds(0); }
        catch (e) { setError(e?.response?.data?.message || 'No se pudo desconectar.'); }
        setBusy(false);
    };

    const copy = async (value, key) => {
        await navigator.clipboard.writeText(value);
        setCopied(key); setTimeout(() => setCopied(''), 1500);
    };

    const minutes = Math.floor(seconds / 60);
    const secs = String(seconds % 60).padStart(2, '0');


    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-5 bg-white dark:bg-gray-900">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"><MonitorSmartphone size={24} /></div>
                    <div className="min-w-0 flex-1">
                        <h2 className="text-lg font-black uppercase tracking-tight text-gray-900 dark:text-white">Escritorio remoto</h2>
                        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Edita los mismos datos desde una computadora en la misma red Wi-Fi.</p>
                    </div>
                </div>

                {!status.active ? (
                    <div className="mt-6">
                        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-4 border border-gray-100 dark:border-gray-800">
                            <div className="flex gap-3"><ShieldCheck size={18} className="shrink-0 text-emerald-500" /><p className="text-sm leading-6 text-gray-600 dark:text-gray-300">La conexión requiere un código temporal y se cierra automáticamente después de 15 minutos.</p></div>
                        </div>
                        <button type="button" onClick={start} disabled={busy} className="touch-feedback mt-5 min-h-11 w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50">
                            {busy ? 'Activando…' : 'Activar escritorio remoto'}
                        </button>
                    </div>
                ) : (
                    <ActiveConnection status={status} minutes={minutes} secs={secs} copied={copied} busy={busy} copy={copy} stop={stop} />
                )}

                {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-300">{error}</p>}
            </div>
        </Modal>
    );
}

function ActiveConnection({ status, minutes, secs, copied, busy, copy, stop }) {
    return (
        <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Activo · {minutes}:{secs}</div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dirección</p><button type="button" onClick={() => copy(status.url, 'url')} className="mt-1 flex min-h-11 w-full items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-3 text-left"><span className="truncate text-sm font-bold text-gray-800 dark:text-gray-100">{status.url}</span>{copied === 'url' ? <Check size={17} className="text-emerald-500" /> : <Copy size={17} className="text-gray-400" />}</button></div>
            <div><p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Código temporal</p><button type="button" onClick={() => copy(status.token, 'token')} className="mt-1 flex min-h-12 w-full items-center justify-between rounded-xl bg-gray-950 dark:bg-black px-4"><span className="font-mono text-lg font-black tracking-[0.2em] text-white">{status.token}</span>{copied === 'token' ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} className="text-white/50" />}</button></div>
            <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400"><Wifi size={16} /> La computadora y el teléfono deben estar en la misma red.</div>
            <button type="button" onClick={stop} disabled={busy} className="touch-feedback min-h-11 w-full rounded-xl border border-red-200 dark:border-red-900 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 disabled:opacity-50"><Power size={17} className="mr-2 inline" /> Desconectar escritorio</button>
        </div>
    );
}

/**
 * A titled card. The Settings page is a stack of these, and the wrapper owns the
 * heading style so a new section cannot come out looking different from the rest.
 */
export function Card({ icon: Icon, title, subtitle, children }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
                <div className="bg-[#FF8A3D] dark:bg-violet-500/20 rounded-xl p-2.5">
                    <Icon size={20} className="text-white dark:text-[#9B7BFF]" />
                </div>
                <div className="min-w-0">
                    <h2 className="text-sm font-black uppercase tracking-tight text-gray-900 dark:text-white">{title}</h2>
                    {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

/**
 * A backup transport, as a button that is either live or explained.
 *
 * An unavailable transport still renders, disabled, with the reason attached.
 * Hiding it — which is what the page used to do — means a user on a build
 * without sharing has no way to learn the feature exists, and no way to tell
 * whether a button is missing or merely broken.
 */
export function TransportButton({ action, icon: Icon, onClick, busy, className = '' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!action.enabled || busy}
            // A touch screen has no hover, so the reason is also printed below
            // the button; the title is the desktop equivalent.
            title={action.reason ?? undefined}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors ${
                action.enabled
                    ? 'bg-[#FF8A3D] hover:bg-[#ff9a58] text-white shadow'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            } ${className}`}
        >
            <Icon size={16} />
            {busy ? 'Abriendo…' : action.label}
        </button>
    );
}

/**
 * The reason a transport is unavailable, printed under the button rather than
 * left to a hover the device does not have.
 */
export function TransportReason({ action }) {
    if (action.enabled || !action.reason) {
        return null;
    }

    return (
        <p className="mt-1 text-[11px] leading-4 text-gray-400 dark:text-gray-500">{action.reason}</p>
    );
}


import Notice from './Notice';
import { useForm } from '@inertiajs/react';
import { Download, FolderOpen, Save, Share2, Upload, Database } from 'lucide-react';

const ICONS = {
    download: Download,
    save: Save,
    share: Share2,
    file: Upload,
    pick: FolderOpen,
};

/**
 * Moving a backup on and off the device.
 *
 * Which buttons appear, and which are live, is decided entirely by the server
 * (see BackupTransports) and arrives as `exportActions` / `importActions`. The
 * page renders that list as given and adds no capability logic of its own —
 * which is the point, because it used to decide for itself and could disagree
 * with the route that then refused the request.
 */
export default function BackupCard({
    exportActions = [],
    importActions = [],
    exportFlash,
    importFlash,
    pickedImport,
    errors = {},
    exportBusy,
    importBusy,
    onExport,
    onPick,
}) {
    const fileAction = importActions.find((action) => action.id === 'file');
    const pickAction = importActions.find((action) => action.id === 'pick');

    return (
        <>
            <Card icon={Database} title="Respaldo" subtitle="Guarda una copia de tus datos o restaura una anterior.">
                <div className="mt-4 space-y-3">
                    {exportActions.map((action) => (
                        <div key={action.id}>
                            <TransportButton
                                action={action}
                                icon={ICONS[action.id] ?? Download}
                                busy={exportBusy === action.id}
                                onClick={() => onExport(action.id)}
                            />
                            <TransportReason action={action} />
                        </div>
                    ))}

                    {errors.backup && <Notice tone="error">{errors.backup}</Notice>}

                    {exportFlash && (
                        <Notice tone="ok">
                            Respaldo listo: {exportFlash.filename}
                            {exportFlash.bytes ? ` (${Math.round(exportFlash.bytes / 1024)} KB)` : ''}.
                        </Notice>
                    )}
                </div>
            </Card>

            <Card icon={Upload} title="Restaurar" subtitle="Reemplaza todos los datos actuales con los del respaldo.">
                <div className="mt-4 space-y-3">
                    {pickAction && (
                        <div>
                            <TransportButton
                                action={pickAction}
                                icon={FolderOpen}
                                busy={importBusy}
                                onClick={onPick}
                            />
                            <TransportReason action={pickAction} />
                        </div>
                    )}

                    {fileAction?.enabled && <FileUpload />}

                    {errors.file && <Notice tone="error">{errors.file}</Notice>}

                    {pickedImport && (
                        <Notice tone={pickedImport.status === 'ok' ? 'ok' : 'info'}>
                            {pickedImport.message}
                        </Notice>
                    )}

                    {importFlash && (
                        <Notice tone="ok">
                            Respaldo restaurado: {importFlash.months} meses y {importFlash.rows} registros.
                        </Notice>
                    )}

                    <ImportPastePanel />
                </div>
            </Card>
        </>
    );
}

/**
 * The browser transport. A native form post rather than Inertia, because the
 * response is a redirect carrying the restored data and the page has to leave
 * alone for the browser to process the file upload.
 */
function FileUpload() {
    return (
        <form method="post" action={route('import')} encType="multipart/form-data">
            <input type="hidden" name="_token" value={csrfToken()} />
            <input
                type="file"
                name="file"
                accept=".json,application/json"
                required
                className="block w-full text-xs text-gray-600 dark:text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#FF8A3D] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white dark:file:bg-[#9B7BFF]"
            />
            <button
                type="submit"
                className="mt-2 w-full py-3 bg-[#FF8A3D] hover:bg-[#ff9a58] text-white rounded-xl text-sm font-bold shadow"
            >
                Restaurar
            </button>
        </form>
    );
}

/**
 * The transport that depends on nothing: no bridge, no file chooser, no
 * network. It is the one that still works on a build missing a plugin, so it is
 * offered last and never disabled.
 *
 * Posted through Inertia rather than as a native form, because the payload is
 * just a string and Inertia carries the CSRF token from the XSRF-TOKEN cookie.
 * That is the mechanism every other write in this app already uses, and it
 * means this form needs no token of its own.
 */
function ImportPastePanel() {
    // Errors arrive keyed on `file` whatever the transport was, because that is
    // what the import route reports them under; BackupCard renders them once
    // for the whole card rather than per form.
    const { data, setData, post, processing } = useForm({ json: '' });

    return (
        <details className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 select-none">
                Pegar contenido del respaldo
            </summary>
            <div className="mt-3 space-y-2">
                <textarea
                    value={data.json}
                    onChange={(event) => setData({ json: event.target.value })}
                    rows={4}
                    spellCheck={false}
                    placeholder='{"format":"bkeeper-backup", …}'
                    className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs font-mono"
                />
                <button
                    type="button"
                    onClick={() => post(route('import'), { onSuccess: () => setData({ json: '' }) })}
                    disabled={processing || !data.json.trim()}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg text-xs font-bold transition-colors"
                >
                    {processing ? 'Restaurando…' : 'Restaurar'}
                </button>
            </div>
        </details>
    );
}

import { AlertTriangle, CheckCircle2, Database } from 'lucide-react';

/**
 * Inline banner for the export/import outcomes. The page has no toast system of
 * its own, and a modal alert would land on top of the system file picker — so
 * the result is shown where the action was taken.
 */
export default function Notice({ tone = 'info', children }) {
    const tones = {
        ok: 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30 text-green-700 dark:text-green-300',
        error: 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-300',
        info: 'bg-orange-50 dark:bg-purple-900/10 border-orange-100 dark:border-purple-900/30 text-[#FF8A3D] dark:text-[#9B7BFF]',
    };

    const Icon = tone === 'ok' ? CheckCircle2 : tone === 'error' ? AlertTriangle : Database;

    return (
        <div
            className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs font-medium ${
                tones[tone] ?? tones.info
            }`}
        >
            <Icon size={16} className="shrink-0" />
            <span className="break-words">{children}</span>
        </div>
    );
}

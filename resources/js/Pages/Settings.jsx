import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router, usePage } from '@inertiajs/react';
import React, { useEffect, useState } from 'react';
import BackupCard from '@/Pages/Settings/Partials/BackupCard';
import StorageCard from '@/Pages/Settings/Partials/StorageCard';
import CurrencyToggle from '@/Pages/Settings/Partials/CurrencyToggle';

/**
 * How often the page re-reads itself while a pick is outstanding, and for how
 * long. There is deliberately no failure here: the loop stops reloading, it
 * never reports that the import did not happen. The result is parked on the
 * server and is shown whenever the page is next opened, so a user who takes
 * half an hour choosing a file is not told their restore failed.
 */
const REFRESH_MS = 2000;
const REFRESH_TRIES = 60;

export default function Settings() {
    const {
        version,
        months = [],
        exportActions = [],
        importActions = [],
        pickedImport = null,
        flash = {},
        errors = {},
    } = usePage().props;

    const [exportBusy, setExportBusy] = useState(null);
    const [importBusy, setImportBusy] = useState(false);
    const [awaitingPick, setAwaitingPick] = useState(false);

    const handleExport = (mode) => {
        // A plain navigation, because the browser has to process the
        // Content-Disposition itself. The server already decided this is the
        // right transport for this build.
        if (mode === 'download') {
            window.location.href = route('export');
            return;
        }

        setExportBusy(mode);
        router.post(
            route('backup.export'),
            { mode },
            { preserveScroll: true, onFinish: () => setExportBusy(null) },
        );
    };

    const handlePickFile = () => {
        setImportBusy(true);
        setAwaitingPick(true);

        router.post(
            route('backup.import.pick'),
            {},
            {
                preserveScroll: true,
                onFinish: () => setImportBusy(false),
                // A failure here means no dialog was ever shown, so there is
                // nothing to wait for.
                onError: () => {
                    setImportBusy(false);
                    setAwaitingPick(false);
                },
            },
        );
    };

    // The pick answers in a request of its own, with no page attached, so the
    // result cannot arrive on any response this page is holding. The page
    // re-reads itself instead: the server hands the outcome over on the next
    // render if there is one, and the moment it does, the wait is over.
    //
    // The old code polled a JSON endpoint twenty times and then declared the
    // pick cancelled — so a user who opened the picker, left the app to email
    // themselves a backup and came back was told nothing had happened, right
    // before the restore succeeded.
    useEffect(() => {
        if (!awaitingPick) return undefined;

        if (pickedImport !== null) {
            setAwaitingPick(false);
            return undefined;
        }

        let attempts = 0;

        const timer = setInterval(() => {
            attempts += 1;
            router.reload({ only: ['pickedImport', 'months', 'monthIds'], preserveScroll: true });

            if (attempts >= REFRESH_TRIES) {
                // Stop asking. Report nothing: the outcome is still parked on
                // the server and will be there the next time this page opens.
                setAwaitingPick(false);
            }
        }, REFRESH_MS);

        return () => clearInterval(timer);
    }, [awaitingPick, pickedImport]);

    return (
        <AuthenticatedLayout
            header={
                <AppHeader
                    title="Configuración"
                    back={{
                        href: route('dashboard'),
                        label: 'Volver al dashboard',
                        icon: 'home',
                    }}
                    // This IS the settings screen, so the overflow menu keeps the theme
                    // row and drops the row that would navigate here.
                    showSettings={false}
                />
            }
        >
            <Head title="Configuración" />

            <div className="py-6 max-w-lg mx-auto px-4 space-y-6">
                <BackupCard
                    exportActions={exportActions}
                    importActions={importActions}
                    exportFlash={flash.backup_export}
                    importFlash={flash.backup_import}
                    pickedImport={pickedImport}
                    errors={errors}
                    exportBusy={exportBusy}
                    importBusy={importBusy}
                    onExport={handleExport}
                    onPick={handlePickFile}
                />

                <CurrencyToggle />

                <StorageCard months={months} />

                <footer className="text-center pb-8 pt-4">
                    <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                        Budget keeper - {version.replace('alpha ', '')}
                    </p>
                </footer>
            </div>
        </AuthenticatedLayout>
    );
}

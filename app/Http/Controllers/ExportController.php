<?php

namespace App\Http\Controllers;

use App\Listeners\RestorePickedBackup;
use App\Services\BackupService;
use App\Support\NativeCapabilities;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Native\Mobile\Facades\Share;
use Smronju\NativephpDocumentPicker\Facades\DocumentPicker;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class ExportController extends Controller
{
    /**
     * Browser download.
     *
     * The compiled mobile app cannot use this path at all: its WebView has no
     * download listener, so a response carrying Content-Disposition is simply
     * dropped on the floor. The mobile build calls exportNative() instead; this
     * stays for the web build and desktop browsers.
     */
    public function export(BackupService $backup): BinaryFileResponse
    {
        $file = $backup->writeBackupFile($backup->exportPayload());

        return response()->download($file['path'], $file['filename'], [
            'Content-Type' => 'application/json',
        ]);
    }

    /**
     * Hand the backup to the system, from the compiled mobile app.
     *
     * `mode=save` opens the OS's own Save-As picker (Downloads, an SD card, a
     * cloud provider's app); `mode=share` opens the share sheet. Both need the
     * file on disk first, and neither reports back: the dialog is presented
     * while this request is still open and answered long after it returned,
     * which is why the page is only told that the handoff started.
     */
    public function exportNative(Request $request, BackupService $backup)
    {
        $validated = $request->validate([
            'mode' => 'nullable|in:save,share',
        ]);

        $mode = $validated['mode'] ?? 'save';
        $capabilities = NativeCapabilities::detect();

        if ($mode === 'share' ? ! $capabilities['canShare'] : ! $capabilities['canSave']) {
            return back()->withErrors([
                'backup' => 'Esta versión de la app no puede abrir el selector de archivos del sistema.',
            ]);
        }

        $file = $backup->writeBackupFile($backup->exportPayload());

        if ($mode === 'share') {
            Share::file('BKeeper', 'Respaldo de BKeeper', $file['path']);
        } else {
            DocumentPicker::save($file['path'], $file['filename'], 'application/json');
        }

        return back()->with('backup_export', [
            'filename' => $file['filename'],
            'mode' => $mode,
            'bytes' => $file['bytes'],
        ]);
    }

    /**
     * Restore a backup the page supplied — as an uploaded file (web), or as
     * pasted text (the fallback that works even where no picker exists).
     *
     * The `mimes:json` rule the first version used is deliberately gone: a
     * backup that travelled through a cloud provider or a chat app is routinely
     * mislabelled as text/plain or application/octet-stream, and the contents
     * are parsed and validated in full below anyway.
     */
    public function import(Request $request, BackupService $backup)
    {
        $request->validate([
            'file' => 'nullable|file|max:20480',
            'json' => 'nullable|string|max:2097152',
        ]);

        $uploaded = $request->file('file');

        if ($uploaded) {
            $path = $uploaded->getRealPath();
            $json = $path === false ? '' : (string) file_get_contents($path);
        } else {
            $json = (string) $request->input('json', '');
        }

        if (trim($json) === '') {
            return back()->withErrors([
                'file' => 'Selecciona un archivo o pega el contenido del respaldo.',
            ]);
        }

        try {
            $summary = $backup->importJson($json);
        } catch (InvalidArgumentException $e) {
            return back()->withErrors(['file' => $e->getMessage()]);
        } catch (Throwable $e) {
            report($e);

            // The device has no log the user can read, so the failure has to
            // surface here or not at all.
            return back()->withErrors([
                'file' => 'No se pudo restaurar el respaldo: '.Str::limit($e->getMessage(), 160),
            ]);
        }

        return to_route('settings')->with('backup_import', $summary);
    }

    /**
     * Present the system document picker for a backup file.
     *
     * Fire-and-forget, like the picker itself: nothing comes back here, the
     * chosen file lands in the listener (see RestorePickedBackup), and the page
     * follows that by polling status().
     */
    public function pickImportFile()
    {
        if (! NativeCapabilities::detect()['canPick']) {
            return back()->withErrors([
                'file' => 'Esta versión de la app no puede abrir el explorador de archivos. Pega el contenido del respaldo.',
            ]);
        }

        // Clear the previous outcome first: the page compares timestamps, but a
        // stale entry is still what a fast first poll would read.
        Cache::forget(RestorePickedBackup::STATUS_KEY);

        // The three types a downloaded .json can legitimately arrive as — some
        // providers report a JSON file as plain text or an octet stream.
        DocumentPicker::pick(['application/json', 'text/plain', 'application/octet-stream']);

        return back();
    }

    /**
     * The outcome of the last picked import, plus what this build can do.
     *
     * The picker's event is handled in a request of its own with no page
     * attached to it, so this endpoint is how the Settings page learns what
     * happened to the file the user chose.
     */
    public function status()
    {
        return response()->json([
            'result' => Cache::get(RestorePickedBackup::STATUS_KEY),
            'capabilities' => NativeCapabilities::detect(),
        ]);
    }
}

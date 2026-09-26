<?php

namespace App\Http\Controllers;

use App\Services\BackupImportResult;
use App\Services\BackupService;
use App\Services\BackupTransports;
use App\Support\NativeBridge;
use App\Support\NativeCapabilities;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use InvalidArgumentException;
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
    public function exportNative(Request $request, BackupService $backup, NativeBridge $bridge)
    {
        $validated = $request->validate([
            'mode' => 'nullable|in:save,share',
        ]);

        $mode = $validated['mode'] ?? 'save';
        $transports = new BackupTransports();

        // Same table the page was given, so the request can no longer be refused
        // for a capability the page already knew it had. The client is not a
        // trust boundary — this request can be sent without the page — but both
        // sides now read one source of truth instead of re-deriving the rule.
        if (! $transports->supports($transports->exportActions(), $mode)) {
            return back()->withErrors([
                'backup' => $transports->reasonFor($transports->exportActions(), $mode)
                    ?? 'Este método de respaldo no está disponible en esta compilación.',
            ]);
        }

        $file = $backup->writeBackupFile($backup->exportPayload());

        $response = $mode === 'share'
            ? $bridge->call('Share.File', [
                'title' => 'BKeeper',
                'message' => 'Respaldo de BKeeper',
                'filePath' => $file['path'],
            ])
            : $bridge->call('DocumentPicker.Save', [
                'source_path' => $file['path'],
                'suggested_name' => $file['filename'],
                'mime_type' => 'application/json',
            ]);

        // Every bridge function reports failure in its own shape (see
        // NativeBridge::failed), and the vendor facades swallow a missing bridge
        // entirely — so without this the page would claim the handoff started
        // while no dialog was ever shown.
        if ($message = $bridge->errorMessage($response, 'No se pudo abrir el selector de archivos del sistema.')) {
            return back()->withErrors(['backup' => $message]);
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
    public function pickImportFile(NativeBridge $bridge, BackupImportResult $results)
    {
        $transports = new BackupTransports();

        if (! $transports->supports($transports->importActions(), 'pick')) {
            return back()->withErrors([
                'file' => $transports->reasonFor($transports->importActions(), 'pick')
                    ?? 'Esta versión de la app no puede abrir el explorador de archivos.',
            ]);
        }

        // Clear the previous outcome first: a stale entry is what a fast read
        // after this request would otherwise pick up.
        $results->forget();

        // The three types a downloaded .json can legitimately arrive as — some
        // providers report a JSON file as plain text or an octet stream.
        $response = $bridge->call('DocumentPicker.Pick', [
            'mime_types' => ['application/json', 'text/plain', 'application/octet-stream'],
        ]);

        // A build whose registry has no such function answers null, which the
        // bridge reports as a failure. Without this the page would fall into its
        // 20-second poll waiting for a dialog that was never shown.
        if ($message = $bridge->errorMessage($response, 'No se pudo abrir el explorador de archivos.')) {
            return back()->withErrors(['file' => $message]);
        }

        return back();
    }

    /**
     * The outcome of the last picked import, plus what this build can do.
     *
     * The picker's event is handled in a request of its own with no page
     * attached to it, so this endpoint is how the Settings page learns what
     * happened to the file the user chose. The result is session-scoped, so it
     * is only ever visible to the session that asked for the pick.
     */
    public function status(BackupImportResult $results)
    {
        return response()->json([
            'result' => $results->read(),
            'capabilities' => NativeCapabilities::detect(),
        ]);
    }
}

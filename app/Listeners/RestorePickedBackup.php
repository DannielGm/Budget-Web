<?php

namespace App\Listeners;

use App\Services\BackupImportResult;
use App\Services\BackupService;
use Illuminate\Support\Str;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;
use Throwable;

/**
 * Restores the backup the user just chose in the system document picker.
 *
 * The picker is fire-and-forget: `DocumentPicker::pick()` returns as soon as the
 * dialog opens, and the chosen file arrives here — in a request of its own, with
 * no page attached to it, after the response the page was waiting on has already
 * gone out. The outcome is therefore parked for the Settings page to read back
 * (see BackupImportResult) instead of being carried by a response.
 */
class RestorePickedBackup
{
    public function __construct(
        protected BackupService $backup,
        protected BackupImportResult $results,
    ) {}

    public function handle(DocumentPicked $event): void
    {
        $file = $this->safeName($event->name);

        // A null path means the user cancelled — or that the copy failed, which
        // from here is the same thing: nothing to read. Either way the page has
        // to be told, or it would keep waiting for a file that is never coming.
        if ($event->path === null || ! is_file($event->path)) {
            $this->results->record('cancelled', 'No se seleccionó ningún archivo.', $file);

            return;
        }

        try {
            $this->results->recordSuccess(
                $this->backup->importJson((string) file_get_contents($event->path)),
                $file,
            );
        } catch (Throwable $e) {
            report($e);

            // The device has no log the user can read, so the reason has to
            // reach the screen or it is lost.
            $this->results->recordFailure(
                'No se pudo restaurar el respaldo: '.$e->getMessage(),
                $file,
            );
        }
    }

    /**
     * The file's display name came from another app's content provider, so it is
     * reduced to a bare basename before it is ever echoed back.
     */
    private function safeName(?string $name): ?string
    {
        if ($name === null || trim($name) === '') {
            return null;
        }

        return Str::limit(basename(str_replace('\\', '/', $name)), 80);
    }
}

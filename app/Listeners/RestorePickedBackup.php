<?php

namespace App\Listeners;

use App\Services\BackupService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Smronju\NativephpDocumentPicker\Events\DocumentPicked;
use Throwable;

/**
 * Restores the backup the user just chose in the system document picker.
 *
 * The picker is fire-and-forget: `DocumentPicker::pick()` returns as soon as the
 * dialog opens, and the chosen file arrives here — in a request of its own, with
 * no page attached to it, after the response the page was waiting on has already
 * gone out. The outcome is therefore parked in the cache for the Settings page
 * to poll (`backup.status`) instead of being carried by a response.
 */
class RestorePickedBackup
{
    /** Cache key the outcome is parked under, polled by the Settings page. */
    public const STATUS_KEY = 'backup.import.result';

    public function __construct(protected BackupService $backup) {}

    public function handle(DocumentPicked $event): void
    {
        $file = $this->safeName($event->name);

        // A null path means the user cancelled — or that the copy failed, which
        // from here is the same thing: nothing to read. Either way the page has
        // to be told, or it would keep waiting for a file that is never coming.
        if ($event->path === null || ! is_file($event->path)) {
            $this->record('cancelled', 'No se seleccionó ningún archivo.', $file);

            return;
        }

        try {
            $summary = $this->backup->importJson((string) file_get_contents($event->path));

            $this->record('ok', sprintf(
                'Respaldo restaurado: %d %s y %d registros.',
                $summary['months'],
                $summary['months'] === 1 ? 'mes' : 'meses',
                $summary['rows'],
            ), $file, $summary);
        } catch (Throwable $e) {
            report($e);

            // The device has no log the user can read, so the reason has to
            // reach the screen or it is lost.
            $this->record(
                'error',
                'No se pudo restaurar el respaldo: '.Str::limit($e->getMessage(), 160),
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

    /**
     * @param  array<string, mixed>  $summary
     */
    private function record(string $status, string $message, ?string $file, array $summary = []): void
    {
        Cache::put(self::STATUS_KEY, [
            'status' => $status,
            'message' => $message,
            'file' => $file,
            'at' => now()->toIso8601String(),
        ] + $summary, now()->addMinutes(30));
    }
}

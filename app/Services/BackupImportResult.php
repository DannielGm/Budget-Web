<?php

namespace App\Services;

use Illuminate\Support\Str;

/**
 * Parks the outcome of a picked backup where the Settings page can read it.
 *
 * The picker is fire-and-forget: `DocumentPicker::pick()` returns the moment
 * the dialog opens, and the chosen file arrives later in a request of its own,
 * with no page attached and no way to answer the response the page was already
 * given. So the result has to be left somewhere the page can ask.
 *
 * It is kept in the session, not in the cache under a computed key. The budget
 * screens are public (routes/web.php), so a single global key let the last
 * person's import result — month names, row counts, and the name of the file
 * they restored — sit in the cache where the next person on a shared device
 * could read it. The session is the only boundary this app actually has, and
 * storing the value there rather than the cache is what makes it obey that
 * boundary: a session gets its own lifetime, so the outcome disappears with the
 * session instead of outliving it.
 */
class BackupImportResult
{
    /** Where the outcome lives inside the session. */
    private const KEY = 'backup.import.result';

    /**
     * The outcome of the last pick for this session, or null if there is none.
     *
     * @return array<string, mixed>|null
     */
    public function read(): ?array
    {
        $result = session()->get(self::KEY);

        return is_array($result) ? $result : null;
    }

    /**
     * @param  array<string, mixed>  $summary
     */
    public function record(string $status, string $message, ?string $file = null, array $summary = []): void
    {
        session()->put(self::KEY, [
            'status' => $status,
            'message' => $message,
            'file' => $file,
            'at' => now()->toIso8601String(),
        ] + $summary);
    }

    /**
     * A successful restore, described in words the page can show as-is.
     *
     * @param  array<string, mixed>  $summary
     */
    public function recordSuccess(array $summary, ?string $file): void
    {
        $months = (int) ($summary['months'] ?? 0);

        $this->record('ok', sprintf(
            'Respaldo restaurado: %d %s y %d registros.',
            $months,
            $months === 1 ? 'mes' : 'meses',
            (int) ($summary['rows'] ?? 0),
        ), $file, $summary);
    }

    /**
     * A failure the device cannot otherwise report anywhere the user can see.
     */
    public function recordFailure(string $message, ?string $file = null): void
    {
        $this->record('error', Str::limit($message, 160), $file);
    }

    /**
     * Forget the last outcome, so a fresh pick cannot read a stale one.
     */
    public function forget(): void
    {
        session()->forget(self::KEY);
    }

    /**
     * The outcome, formatted for the message the page shows, or null.
     *
     * @return array{status: string, message: string}|null
     */
    public function toNotice(): ?array
    {
        $result = $this->read();

        if ($result === null) {
            return null;
        }

        return [
            'status' => (string) ($result['status'] ?? 'error'),
            'message' => (string) ($result['message'] ?? ''),
        ];
    }
}

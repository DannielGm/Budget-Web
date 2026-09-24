<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

/**
 * Builds and restores the JSON backup file.
 *
 * The payload is a flat dump of every table the budget screens own, keyed by
 * table name: a restore is a wipe-and-reinsert, not a merge, because the device
 * is the only writer. Keeping the ids and timestamps from the file is what makes
 * a restore exact — every derived figure (available balance, savings pools, debt
 * history) is recomputed from these rows, so anything dropped here silently
 * changes the numbers the user sees afterwards.
 */
class BackupService
{
    public const FORMAT = 'bkeeper-backup';

    public const FORMAT_VERSION = 2;

    /**
     * Tables in insert order; a restore inserts in this order and deletes in the
     * reverse. Every foreign key points back at `budgets`, except
     * `categories.debt_id` -> `debts.id`, which is why `debts` has to be written
     * before `categories` even though the budgets relation reads the other way.
     *
     * @var list<string>
     */
    public const TABLES = [
        'budgets',
        'debts',
        'categories',
        'debt_payments',
        'expenses',
        'savings_transactions',
        'transfers',
    ];

    /**
     * Columns a table cannot be restored without. A row missing any of these is
     * dropped instead of being inserted half-formed — and since a hand-edited
     * file is the only way to get here, dropping beats guessing.
     *
     * @var array<string, list<string>>
     */
    private const REQUIRED = [
        'budgets' => ['month_id', 'month_label', 'income_bs', 'income_rate', 'opening_balance_bs'],
        'debts' => ['month_id', 'label', 'opening_bs', 'payment_bs', 'position'],
        'categories' => ['month_id', 'name', 'cash_expense', 'position'],
        'debt_payments' => ['id', 'debt_id', 'amount_bs', 'timestamp'],
        'expenses' => ['id', 'month_id', 'category_name', 'label', 'amount_bs', 'rate', 'timestamp', 'position'],
        'savings_transactions' => ['id', 'month_id', 'type', 'category', 'amount_usd', 'exchange_rate', 'amount_bs', 'timestamp'],
        'transfers' => ['id', 'month_id', 'source_type', 'destination_type', 'amount_bs', 'timestamp'],
    ];

    /**
     * Boolean columns, which JSON round-trips as 0/1 ints. Cast explicitly so a
     * `true` written by hand in the file never reaches SQLite as a string.
     *
     * @var list<string>
     */
    private const BOOLEANS = [
        'is_custom_rate',
        'cash_expense',
        'is_presupuesto',
    ];

    /** How many generated backup files to keep on the device. */
    private const KEEP_FILES = 5;

    /**
     * Dump every owned table into the versioned envelope the app reads back.
     *
     * @return array<string, mixed>
     */
    public function exportPayload(): array
    {
        $data = [];

        foreach (self::TABLES as $table) {
            $data[$table] = DB::table($table)
                ->get()
                ->map(fn ($row) => (array) $row)
                ->all();
        }

        return [
            'format' => self::FORMAT,
            'format_version' => self::FORMAT_VERSION,
            'app_version' => config('budget.version'),
            'exported_at' => now()->toIso8601String(),
            'totals' => array_map('count', $data),
            'data' => $data,
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public function toJson(array $payload): string
    {
        return json_encode(
            $payload,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
        ) ?: '{}';
    }

    /**
     * `bkeeper_backup_<version>_<date>_<time>.json`, with the version flattened
     * to something safe in a filename and in a Save-As dialog.
     */
    public function backupFilename(): string
    {
        $version = trim(preg_replace('/[^A-Za-z0-9.]+/', '-', (string) config('budget.version', '')) ?? '', '-');

        return sprintf(
            'bkeeper_backup_%s_%s.json',
            $version === '' ? 'bk' : $version,
            now()->format('Y-m-d_His')
        );
    }

    /**
     * Write the payload into the app's own storage and return where it landed.
     *
     * The path is what the native side needs: both the share sheet and the
     * document picker are handed a real file path, not the contents. The
     * directory is created on demand because a freshly installed bundle has no
     * `storage/app`.
     *
     * @param  array<string, mixed>  $payload
     * @return array{path: string, filename: string, bytes: int}
     */
    public function writeBackupFile(array $payload): array
    {
        $directory = storage_path('app/backups');

        if (! is_dir($directory) && ! mkdir($directory, 0755, true) && ! is_dir($directory)) {
            throw new RuntimeException('No se pudo crear la carpeta de respaldos en el dispositivo.');
        }

        $filename = $this->backupFilename();
        $path = $directory.DIRECTORY_SEPARATOR.$filename;
        $json = $this->toJson($payload);

        if (@file_put_contents($path, $json) === false) {
            throw new RuntimeException('No se pudo escribir el archivo de respaldo en el dispositivo.');
        }

        $this->pruneBackups($directory, $path);

        return ['path' => $path, 'filename' => $filename, 'bytes' => strlen($json)];
    }

    /**
     * Keep the newest few backups and delete the rest: every export writes a new
     * file and nothing else ever cleans them up.
     */
    private function pruneBackups(string $directory, string $written): void
    {
        try {
            $files = glob($directory.DIRECTORY_SEPARATOR.'bkeeper_backup_*.json') ?: [];

            if (count($files) <= self::KEEP_FILES) {
                return;
            }

            usort($files, fn (string $a, string $b) => filemtime($b) <=> filemtime($a));

            foreach (array_slice($files, self::KEEP_FILES) as $file) {
                if ($file !== $written) {
                    @unlink($file);
                }
            }
        } catch (Throwable) {
            // Housekeeping only — never fail an export over it.
        }
    }

    /**
     * Parse and restore a backup straight from its JSON text.
     *
     * @return array{months: int, rows: int, tables: array<string, int>}
     */
    public function importJson(string $json): array
    {
        $decoded = json_decode($json, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new InvalidArgumentException('El archivo no es un JSON válido ('.json_last_error_msg().').');
        }

        return $this->importPayload($decoded);
    }

    /**
     * Replace everything the app owns with the contents of the backup.
     *
     * One transaction, children deleted before parents and parents written
     * before children, so a file that turns out to be unusable leaves the device
     * exactly as it was rather than half-restored.
     *
     * @return array{months: int, rows: int, tables: array<string, int>}
     */
    public function importPayload(mixed $payload): array
    {
        $data = $this->normalize($payload);

        return DB::transaction(function () use ($data) {
            foreach (array_reverse(self::TABLES) as $table) {
                DB::table($table)->delete();
            }

            $restored = [];

            foreach (self::TABLES as $table) {
                $rows = $this->rowsFor($table, $data[$table] ?? []);

                // Chunked: SQLite caps how many bound parameters one statement
                // may carry, and a busy month is already past the default.
                foreach (array_chunk($rows, 200) as $chunk) {
                    DB::table($table)->insert($chunk);
                }

                $restored[$table] = count($rows);
            }

            return [
                'months' => $restored['budgets'],
                'rows' => array_sum($restored),
                'tables' => $restored,
            ];
        });
    }

    /**
     * Accept both shapes this app has ever written: the versioned envelope
     * (`format_version` 2, one key per table under `data`) and the bare array of
     * budgets the first release exported, which nested its children instead.
     *
     * The envelope is only trusted when it names itself — an unrelated JSON file
     * that happens to carry a `data` key must never be allowed to wipe the
     * device on its way to restoring nothing.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    private function normalize(mixed $payload): array
    {
        if (! is_array($payload)) {
            throw new InvalidArgumentException('El respaldo no contiene datos legibles.');
        }

        if (isset($payload['data']) && is_array($payload['data'])) {
            if (($payload['format'] ?? null) !== self::FORMAT) {
                throw new InvalidArgumentException('El archivo no es un respaldo de BKeeper.');
            }

            if ((int) ($payload['format_version'] ?? self::FORMAT_VERSION) > self::FORMAT_VERSION) {
                throw new InvalidArgumentException(
                    'El respaldo fue creado por una versión más reciente de la app. Actualiza BKeeper antes de restaurarlo.'
                );
            }

            return $this->fromTables($payload['data']);
        }

        return $this->fromLegacy($payload);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, list<array<string, mixed>>>
     */
    private function fromTables(array $data): array
    {
        $tables = [];

        foreach (self::TABLES as $table) {
            $rows = is_array($data[$table] ?? null) ? $data[$table] : [];
            $tables[$table] = array_values(array_filter($rows, 'is_array'));
        }

        return $tables;
    }

    /**
     * The pre-2.0 export: budgets with their children nested, and none of the
     * tables that did not exist yet. Anything left out keeps its schema default.
     *
     * @param  array<mixed>  $budgets
     * @return array<string, list<array<string, mixed>>>
     */
    private function fromLegacy(array $budgets): array
    {
        $tables = array_fill_keys(self::TABLES, []);

        foreach ($budgets as $budget) {
            if (! is_array($budget) || empty($budget['month_id'])) {
                continue;
            }

            $monthId = (string) $budget['month_id'];

            $tables['budgets'][] = Arr::only($budget, [
                'month_id', 'month_label', 'income_bs', 'income_rate', 'opening_balance_bs',
                'is_custom_rate', 'created_at', 'updated_at',
            ]);

            foreach ($budget['debts'] ?? [] as $debt) {
                if (is_array($debt) && isset($debt['label'])) {
                    $tables['debts'][] = Arr::only($debt, [
                        'month_id', 'label', 'opening_bs', 'payment_bs', 'position',
                        'created_at', 'updated_at',
                    ]) + ['month_id' => $monthId];
                }
            }

            foreach ($budget['categories'] ?? [] as $category) {
                if (is_array($category) && isset($category['name'])) {
                    $tables['categories'][] = Arr::only($category, [
                        'month_id', 'name', 'cash_expense', 'is_presupuesto', 'position', 'debt_id',
                        'created_at', 'updated_at',
                    ]) + ['month_id' => $monthId];
                }
            }

            foreach ($budget['expenses'] ?? [] as $expense) {
                if (is_array($expense) && isset($expense['id'])) {
                    $tables['expenses'][] = Arr::only($expense, [
                        'id', 'month_id', 'category_name', 'label', 'amount_bs', 'rate',
                        'timestamp', 'position', 'created_at', 'updated_at',
                    ]) + ['month_id' => $monthId];
                }
            }
        }

        if ($tables['budgets'] === []) {
            throw new InvalidArgumentException('El respaldo no contiene ningún mes.');
        }

        return $tables;
    }

    /**
     * Trim a raw row down to the table's real columns, cast its booleans, and
     * drop it if anything required is missing: an unknown key would fail the
     * whole insert statement, and one bad row should not cost the user the other
     * nine hundred.
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function rowsFor(string $table, array $rows): array
    {
        $columns = Schema::getColumnListing($table);
        $required = self::REQUIRED[$table];
        $prepared = [];

        foreach ($rows as $row) {
            $filtered = Arr::only($row, $columns);

            foreach (self::BOOLEANS as $boolean) {
                if (array_key_exists($boolean, $filtered)) {
                    $filtered[$boolean] = (int) filter_var($filtered[$boolean], FILTER_VALIDATE_BOOLEAN);
                }
            }

            if (array_diff($required, array_keys($filtered)) === []) {
                $prepared[] = $filtered;
            }
        }

        return $prepared;
    }
}

<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\ExchangeRate;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * BCV exchange-rate synchronisation, ported from the Kotlin app's
 * ExchangeRateRepository (dolarapi.com as the source of truth).
 *
 * Rules:
 *  - Today's rate is fetched at most once per day unless forced.
 *  - The first successful sync backfills every stored month's boundary day
 *    from the public history endpoint (retry capped at one attempt / 5 min).
 *  - Stored income_rate values self-heal towards the real BCV rate, but a
 *    zero target is never written: an offline first run must not wipe rates.
 *  - Every method fails soft: the app stays usable offline and simply flags
 *    the rate as stale.
 */
class ExchangeRateService
{
    private const OFFICIAL_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';

    private const HISTORY_URL = 'https://ve.dolarapi.com/v1/historicos/dolares/oficial';

    private const BACKFILL_RETRY_AFTER_SECONDS = 300;

    private const FETCH_RETRY_AFTER_SECONDS = 600;

    /**
     * Ensure today's rate exists, then run maintenance. Returns a snapshot
     * for the balance card; never throws.
     *
     * @return array{rate: string, date_iso: string, updated_today: bool, stale: bool, error: ?string}
     */
        public function ensureFresh(bool $force = false): array
    {
        $today = CarbonImmutable::today()->toDateString();
        $error = null;

        // Memoize the snapshot per-request so we don't query the latest row repeatedly
        return once(function () use ($today, $force, &$error) {
            try {
                $needsFetch = $force || ! ExchangeRate::whereKey($today)->exists();

                // Backoff: never let a failing/slow network stall every page load.
                if ($needsFetch && ! $force && $this->fetchAttemptedRecently()) {
                    $needsFetch = false;
                }

                if ($needsFetch) {
                    Cache::put('exchange_rate:last_fetch_attempt_at', CarbonImmutable::now()->getTimestamp(), 3600);
                    $this->fetchOfficial($today);
                    // Backfill the public history only when we fetched official
                    // data: this populates each month's boundary day so
                    // monthRateFor() can resolve historical months, and it is the
                    // only network touchpoint on a fresh install. When today is
                    // already cached we must NOT call out again (offline-safe).
                    $this->backfillIfNeeded();
                }

                $this->refreshMonthRates();
            } catch (Throwable $e) {
                $error = $e->getMessage();
                Log::warning('exchange-rate: '.$e->getMessage());
            }

            $latest = ExchangeRate::orderBy('date_iso', 'desc')->first();

            return [
                'rate' => $latest?->rate_bs_per_usd ?? '0',
                'date_iso' => $latest?->date_iso ?? $today,
                'updated_today' => $latest !== null && $latest->date_iso === $today,
                'stale' => $latest === null || $latest->date_iso !== $today,
                'error' => $error,
            ];
        });
    }

    /**
     * The rate that applies to a whole month:
     *  - current month: first entry on/after the 1st, else the last entry
     *    before it (pre-devaluation months keep the older, higher rate).
     *  - finished months: the last entry on or before the month's last day.
     */
    public function monthRateFor(string $monthId): ?ExchangeRate
    {
        $first = $monthId.'-01';
        $last = CarbonImmutable::createFromFormat('Y-m', $monthId)->endOfMonth()->toDateString();
        $today = CarbonImmutable::today()->toDateString();

        if ($today < $first) {
            return null; // Future months have no rate yet.
        }

        if ($today <= $last) {
            return ExchangeRate::where('date_iso', '>=', $first)
                ->orderBy('date_iso')
                ->first()
                ?? ExchangeRate::where('date_iso', '<', $first)
                    ->orderBy('date_iso', 'desc')
                    ->first();
        }

        return ExchangeRate::where('date_iso', '<=', $last)
            ->orderBy('date_iso', 'desc')
            ->first();
    }

    /**
     * The rate that applies to a specific day: latest entry on or before
     * that day, falling back to the month rate.
     */
    public function dayRate(string $dateIso, ?ExchangeRate $fallback = null): ?ExchangeRate
    {
        return ExchangeRate::where('date_iso', '<=', $dateIso)
            ->orderBy('date_iso', 'desc')
            ->first()
            ?? $fallback;
    }

    /**
     * Rewrite each budget's income_rate so it tracks the real BCV series.
     * Zero targets are skipped so an offline first run cannot wipe a saved
     * rate (intentional deviation from the Kotlin behaviour).
     */
    public function refreshMonthRates(): void
    {
        // Get the absolute latest available BCV rate globally, not constrained by the month.
        $latestRate = ExchangeRate::orderBy('date_iso', 'desc')->first();

        if ($latestRate === null || bccomp($latestRate->rate_bs_per_usd, '0', 2) === 0) {
            return;
        }

        foreach (Budget::where('is_custom_rate', false)->get() as $budget) {
            if (bccomp($budget->income_rate, $latestRate->rate_bs_per_usd, 2) !== 0) {
                $budget->update(['income_rate' => $latestRate->rate_bs_per_usd]);
            }
        }
    }

    /**
     * Backfill boundary days for stored months using the history endpoint.
     * Triggered when the table is empty or a month lacks a boundary entry
     * on/after the oldest month's first day; otherwise retried at most
     * every 5 minutes.
     */
    private function backfillIfNeeded(): void
    {
        $firstMonth = Budget::query()->orderBy('month_id')->value('month_id');

        if ($firstMonth === null) {
            return; // Nothing to backfill.
        }

        $firstDay = $firstMonth.'-01';

        // A boundary entry for the oldest stored month is required; today's
        // freshly fetched rate does not count as the month's boundary.
        $needsBackfill = ! ExchangeRate::where('date_iso', $firstDay)->exists();

        if (! $needsBackfill) {
            return;
        }

        $attemptedAt = Cache::get('exchange_rate:last_backfill_attempt');
        if ($attemptedAt !== null
            && CarbonImmutable::createFromTimestamp((int) $attemptedAt)
                ->isAfter(CarbonImmutable::now()->subSeconds(self::BACKFILL_RETRY_AFTER_SECONDS))) {
            return;
        }

        Cache::put('exchange_rate:last_backfill_attempt', CarbonImmutable::now()->getTimestamp(), 3600);

        $this->fetchHistory($firstDay);
    }

    private function fetchAttemptedRecently(): bool
    {
        $last = Cache::get('exchange_rate:last_fetch_attempt_at');

        return $last !== null && CarbonImmutable::createFromTimestamp((int) $last)
            ->isAfter(CarbonImmutable::now()->subSeconds(self::FETCH_RETRY_AFTER_SECONDS));
    }

    /**
     * Daily rate series from $from..$to (inclusive) for the rates dashboard.
     * Days without their own BCV publication inherit the closest earlier
     * observation (backward carry); days before the first known rate are
     * omitted. Points: ['date' => 'Y-m-d', 'rate' => string, 'exact' => bool].
     */
    public function rateSeries(string $from, string $to): array
    {
        if ($from > $to) {
            return [];
        }

        $observations = ExchangeRate::whereBetween('date_iso', [$from, $to])
            ->orderBy('date_iso')
            ->get()
            ->keyBy('date_iso');

        // Seed the carry with the closest observation BEFORE the window so a
        // window starting inside a gap still shows the last real rate.
        $carry = ExchangeRate::where('date_iso', '<', $from)
            ->orderBy('date_iso', 'desc')
            ->first();

        $series = [];
        $day = CarbonImmutable::parse($from);
        $last = CarbonImmutable::parse($to);

        while ($day->lte($last)) {
            $iso = $day->toDateString();

            if (isset($observations[$iso])) {
                $carry = $observations[$iso];
                $exact = true;
            } else {
                $exact = false;
            }

            if ($carry !== null) {
                $series[] = [
                    'date' => $iso,
                    'rate' => $carry->rate_bs_per_usd,
                    'exact' => $exact,
                ];
            }

            $day = $day->addDay();
        }

        return $series;
    }

    /**
     * The closest observation on or before the given day — the same
     * backward-carry rule as rateSeries(), for single-day consumers
     * (the budget calendar's day picker).
     */
    public function latestOnOrBefore(string $date): ?ExchangeRate
    {
        return ExchangeRate::where('date_iso', '<=', $date)
            ->orderBy('date_iso', 'desc')
            ->first();
    }

    /**
     * Fetch the full public BCV archive once (guarded so the rates dashboard's
     * "Todo" range can ask for it on every visit without hammering the API).
     * Fails soft: on error the existing rows are served as-is.
     */
    public function ensureFullArchive(): void
    {
        $last = Cache::get('exchange_rate:full_archive_attempted_at');
        if ($last !== null && CarbonImmutable::createFromTimestamp((int) $last)
            ->isAfter(CarbonImmutable::now()->subSeconds(21600))) {
            return;
        }

        Cache::put('exchange_rate:full_archive_attempted_at', CarbonImmutable::now()->getTimestamp(), 86400);

        try {
            // '1990-01-01' accepts every entry the public history endpoint has.
            $this->fetchHistory('1990-01-01');
        } catch (Throwable $e) {
            Log::warning('exchange-rate: full archive fetch failed: '.$e->getMessage());
        }
    }

    private function fetchOfficial(string $today): void
    {
        $payload = $this->getJson(self::OFFICIAL_URL);

        $rate = (string) ($payload['promedio'] ?? '');
        $date = substr((string) ($payload['fechaActualizacion'] ?? ''), 0, 10);

        if ($rate === '' || ! is_numeric($rate)) {
            throw new RuntimeException('BCV response missing promedio.');
        }

        ExchangeRate::updateOrCreate(
            ['date_iso' => $date ?: $today],
            ['rate_bs_per_usd' => $rate, 'fetched_at' => time()],
        );
    }

    private function fetchHistory(string $fromDate): void
    {
        $entries = $this->getJson(self::HISTORY_URL);

        if (! is_array($entries)) {
            throw new RuntimeException('BCV history response is not a list.');
        }

        foreach ($entries as $entry) {
            $date = substr((string) ($entry['fecha'] ?? ''), 0, 10);
            $rate = (string) ($entry['promedio'] ?? '');

            if ($date === '' || $rate === '' || ! is_numeric($rate) || $date < $fromDate) {
                continue;
            }

            ExchangeRate::updateOrCreate(
                ['date_iso' => $date],
                ['rate_bs_per_usd' => $rate, 'fetched_at' => time()],
            );
        }
    }

    private function getJson(string $url): array
    {
        $response = Http::timeout(2)->connectTimeout(2)
            ->acceptJson()
            ->get($url);

        if ($response->failed()) {
            throw new RuntimeException("BCV request failed ({$response->status()}).");
        }

        return $response->json() ?? [];
    }
}

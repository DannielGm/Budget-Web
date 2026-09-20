<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\ExchangeRate;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
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

                if ($needsFetch) {
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
        foreach (Budget::query()->orderBy('month_id')->get() as $budget) {
            $rate = $this->monthRateFor($budget->month_id);

            if ($rate === null || bccomp($rate->rate_bs_per_usd, '0', 2) === 0) {
                continue;
            }

            if (bccomp($budget->income_rate, $rate->rate_bs_per_usd, 2) !== 0) {
                $budget->update(['income_rate' => $rate->rate_bs_per_usd]);
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
        $response = Http::timeout(3)->connectTimeout(3)
            ->acceptJson()
            ->get($url);

        if ($response->failed()) {
            throw new RuntimeException("BCV request failed ({$response->status()}).");
        }

        return $response->json() ?? [];
    }
}

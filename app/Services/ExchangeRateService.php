<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\ExchangeRate;
use App\Support\DisplayCurrency;
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
    /**
     * Both series come from the same host and the same paths; only the currency
     * segment differs. Holding them as one template is what keeps a future
     * currency from needing its own copy of the fetch, cache and backfill code,
     * which is where a second implementation would drift from the first.
     */
    private const OFFICIAL_URL = 'https://ve.dolarapi.com/v1/%s/oficial';

    private const HISTORY_URL = 'https://ve.dolarapi.com/v1/historicos/%s/oficial';

    /** The API segment for each currency this app can display. */
    private const CURRENCY_SEGMENT = [
        ExchangeRate::USD => 'dolares',
        ExchangeRate::EUR => 'euros',
    ];

    /** Expand a URL template for one currency, or null when unsupported. */
    private function urlFor(string $template, string $currency): string
    {
        $segment = self::CURRENCY_SEGMENT[$currency] ?? null;

        if ($segment === null) {
            throw new RuntimeException("Unsupported currency: {$currency}");
        }

        return sprintf($template, $segment);
    }

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
                $needsFetch = $force || ! ExchangeRate::where('date_iso', $today)->exists();

                // Backoff: never let a failing/slow network stall every page load.
                if ($needsFetch && ! $force && $this->fetchAttemptedRecently()) {
                    $needsFetch = false;
                }

                $fetched = false;
                if ($needsFetch) {
                    Cache::put('exchange_rate:last_fetch_attempt_at', CarbonImmutable::now()->getTimestamp(), 3600);
                    foreach ([ExchangeRate::USD, ExchangeRate::EUR] as $currency) {
                        try {
                            $this->fetchOfficial($today, $currency);
                            $fetched = true;
                        } catch (Throwable $e) {
                            // A series that will not refresh must not block the
                            // other, but the failure is still reported so the
                            // dashboard can flag a stale rate as before.
                            $error = $e->getMessage();
                            Log::warning("exchange-rate: {$currency} fetch failed: ".$e->getMessage());
                        }
                    }
                    // Backfill the public history only when we fetched official
                    // data: this populates each month's boundary day so
                    // monthRateFor() can resolve historical months, and it is the
                    // only network touchpoint on a fresh install. When today is
                    // already cached we must NOT call out again (offline-safe).
                    // Only when the network actually answered. Backfilling is a
                    // bulk history download, and running it after a failed fetch
                    // meant a cold start with no internet sat through the daily
                    // timeout AND the history timeout before the app appeared.
                    if ($fetched) {
                        $this->backfillIfNeeded();
                    }
                }

                $this->refreshMonthRates();
            } catch (Throwable $e) {
                $error = $e->getMessage();
                Log::warning('exchange-rate: '.$e->getMessage());
            }

            // The snapshot is the dollar series: income_rate and every stored
            // Bs/USD figure are dollar rates.
            $latest = ExchangeRate::currency(ExchangeRate::USD)->orderBy('date_iso', 'desc')->first();

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
    public function monthRateFor(string $monthId, string $currency = ExchangeRate::USD): ?ExchangeRate
    {
        $series = fn () => ExchangeRate::currency($currency);
        $first = $monthId.'-01';
        $last = CarbonImmutable::createFromFormat('Y-m', $monthId)->endOfMonth()->toDateString();
        $today = CarbonImmutable::today()->toDateString();

        if ($today < $first) {
            return null; // Future months have no rate yet.
        }

        if ($today <= $last) {
            return $series()->where('date_iso', '>=', $first)
                ->orderBy('date_iso')
                ->first()
                ?? $series()->where('date_iso', '<', $first)
                    ->orderBy('date_iso', 'desc')
                    ->first();
        }

        return $series()->where('date_iso', '<=', $last)
            ->orderBy('date_iso', 'desc')
            ->first();
    }

    /**
     * The rate that applies to a specific day: latest entry on or before
     * that day, falling back to the month rate.
     */
    public function dayRate(string $dateIso, ?ExchangeRate $fallback = null, string $currency = ExchangeRate::USD): ?ExchangeRate
    {
        return ExchangeRate::currency($currency)->where('date_iso', '<=', $dateIso)
            ->orderBy('date_iso', 'desc')
            ->first()
            ?? $fallback;
    }

    /**
     * Rewrite each budget's income_rate so it tracks the real BCV series.
     * Zero targets are skipped so an offline first run cannot wipe a saved
     * rate (intentional deviation from the Kotlin behaviour).
     *
     * income_rate is a single column, so it only ever holds the rate for ONE
     * series: whichever the user was displaying when it was written. It is
     * re-derived from the active series on every load for exactly that reason,
     * so a budget left in dollar mode is not showing a euro figure after a
     * toggle, and vice versa. A budget the user typed their own rate for is
     * never touched -- that number is theirs, not the BCV's, whichever series
     * happens to be on screen.
     */
    public function refreshMonthRates(?string $currency = null): void
    {
        $currency ??= DisplayCurrency::current();

        // The absolute latest available BCV rate globally, not constrained by
        // the month, and only ever read from the active series.
        $latestRate = ExchangeRate::currency($currency)->orderBy('date_iso', 'desc')->first();

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
        // freshly fetched rate does not count as the month's boundary. Each
        // series is judged on its own, so switching display currency does not
        // depend on which one happened to sync first.
        $missing = array_values(array_filter(
            [ExchangeRate::USD, ExchangeRate::EUR],
            fn (string $currency) => ! ExchangeRate::currency($currency)->where('date_iso', $firstDay)->exists(),
        ));

        if ($missing === []) {
            return;
        }

        $attemptedAt = Cache::get('exchange_rate:last_backfill_attempt');
        if ($attemptedAt !== null
            && CarbonImmutable::createFromTimestamp((int) $attemptedAt)
                ->isAfter(CarbonImmutable::now()->subSeconds(self::BACKFILL_RETRY_AFTER_SECONDS))) {
            return;
        }

        Cache::put('exchange_rate:last_backfill_attempt', CarbonImmutable::now()->getTimestamp(), 3600);

        // One failing series must not stop the other, so each is isolated.
        foreach ($missing as $currency) {
            try {
                $this->fetchHistory($firstDay, $currency);
            } catch (Throwable $e) {
                Log::warning("exchange-rate: {$currency} backfill failed: ".$e->getMessage());
            }
        }
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
    public function rateSeries(string $from, string $to, string $currency = ExchangeRate::USD): array
    {
        if ($from > $to) {
            return [];
        }

        $observations = ExchangeRate::currency($currency)->whereBetween('date_iso', [$from, $to])
            ->orderBy('date_iso')
            ->get()
            ->keyBy('date_iso');

        // Seed the carry with the closest observation BEFORE the window so a
        // window starting inside a gap still shows the last real rate.
        $carry = ExchangeRate::currency($currency)->where('date_iso', '<', $from)
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
    public function latestOnOrBefore(string $date, string $currency = ExchangeRate::USD): ?ExchangeRate
    {
        return ExchangeRate::currency($currency)->where('date_iso', '<=', $date)
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
            ->isAfter(CarbonImmutable::now()->subSeconds(self::ARCHIVE_RETRY_AFTER_SECONDS))) {
            return;
        }

        // Marked for as long as the guard waits. The two used to disagree -- a 6h
        // guard behind a 24h marker -- so one failure suppressed the retry for a
        // whole day, and the archive that makes the long ranges meaningful was
        // precisely the thing that never came back.
        Cache::put('exchange_rate:full_archive_attempted_at', CarbonImmutable::now()->getTimestamp(), self::ARCHIVE_RETRY_AFTER_SECONDS + 60);

        try {
            // '1990-01-01' accepts every entry the public history endpoint has.
            $this->fetchHistory('1990-01-01', ExchangeRate::USD);
            $this->fetchHistory('1990-01-01', ExchangeRate::EUR);
        } catch (Throwable $e) {
            Log::warning('exchange-rate: full archive fetch failed: '.$e->getMessage());
        }
    }

    private function fetchOfficial(string $today, string $currency): void
    {
        $payload = $this->getJson($this->urlFor(self::OFFICIAL_URL, $currency));

        $rate = (string) ($payload['promedio'] ?? '');
        $date = substr((string) ($payload['fechaActualizacion'] ?? ''), 0, 10);

        if ($rate === '' || ! is_numeric($rate)) {
            throw new RuntimeException('BCV response missing promedio.');
        }

        ExchangeRate::updateOrCreate(
            ['date_iso' => $date ?: $today, 'currency' => $currency],
            ['rate_bs_per_usd' => $rate, 'fetched_at' => time()],
        );
    }

    private function fetchHistory(string $fromDate, string $currency): void
    {
        $entries = $this->getJson($this->urlFor(self::HISTORY_URL, $currency), self::TIMEOUT_BULK);

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
                ['date_iso' => $date, 'currency' => $currency],
                ['rate_bs_per_usd' => $rate, 'fetched_at' => time()],
            );
        }
    }

    /**
     * Seconds allowed for a BCV call.
     *
     * The daily rate is one small object, so it keeps a short leash: it runs on
     * page load and a slow network must not hold the dashboard. The history and
     * archive calls are bulk downloads of thousands of entries, and the two
     * seconds that suit the first one is not enough for those on a phone -- which
     * is why the euro series could end up holding five months of history and
     * make both the 1A and "Todo" ranges show the same truncated window.
     */
    private const TIMEOUT_DAILY = 2;

    private const TIMEOUT_BULK = 20;

    /** How long a failed archive download waits before being retried. */
    private const ARCHIVE_RETRY_AFTER_SECONDS = 21600;

    private function getJson(string $url, int $timeout = self::TIMEOUT_DAILY): array
    {
        $response = Http::timeout($timeout)->connectTimeout(2)
            ->acceptJson()
            ->get($url);

        if ($response->failed()) {
            throw new RuntimeException("BCV request failed ({$response->status()}).");
        }

        return $response->json() ?? [];
    }
}

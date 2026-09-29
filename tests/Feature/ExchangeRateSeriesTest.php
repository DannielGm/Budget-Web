<?php

namespace Tests\Feature;

use App\Models\ExchangeRate;
use App\Services\ExchangeRateService;
use App\Support\DisplayCurrency;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ExchangeRateSeriesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // range=all would otherwise ask the public API for the full archive;
        // set the same guard production uses so every test stays offline.
        Cache::put('exchange_rate:full_archive_attempted_at', time(), 3600);
    }

    private function seedRate(string $date, string $rate): void
    {
        ExchangeRate::create([
            'date_iso' => $date,
            'rate_bs_per_usd' => $rate,
            'fetched_at' => time(),
        ]);
    }

    private function seriesFor(string $range = 'all'): array
    {
        return $this->getJson('/exchange-rate/series?range='.$range)
            ->assertOk()
            ->json('series');
    }

    public function test_gap_days_carry_the_closest_earlier_rate(): void
    {
        $observed = CarbonImmutable::today()->subDays(5)->toDateString();
        $gapDay = CarbonImmutable::today()->subDays(4)->toDateString();

        $this->seedRate($observed, '800.00');

        $series = collect($this->seriesFor());

        $first = $series->firstWhere('date', $observed);
        $this->assertSame('800.00', $first['rate']);
        $this->assertTrue($first['exact']);

        $carried = $series->firstWhere('date', $gapDay);
        $this->assertSame('800.00', $carried['rate']);
        $this->assertFalse($carried['exact']);
    }

    public function test_window_starting_mid_gap_inherits_from_before_the_window(): void
    {
        $this->seedRate(CarbonImmutable::today()->subDays(10)->toDateString(), '700.00');

        $series = app(ExchangeRateService::class)->rateSeries(
            CarbonImmutable::today()->subDays(8)->toDateString(),
            CarbonImmutable::today()->subDays(7)->toDateString(),
        );

        $this->assertCount(2, $series);
        $this->assertSame('700.00', $series[0]['rate']);
        $this->assertFalse($series[0]['exact']);
        $this->assertFalse($series[1]['exact']);
    }

    public function test_days_before_the_first_known_rate_are_omitted(): void
    {
        $firstKnown = CarbonImmutable::today()->subDays(2)->toDateString();
        $this->seedRate($firstKnown, '750.00');

        $series = app(ExchangeRateService::class)->rateSeries(
            CarbonImmutable::today()->subDays(4)->toDateString(),
            CarbonImmutable::today()->toDateString(),
        );

        // The two days before the first observation are omitted entirely.
        $this->assertCount(3, $series);
        $this->assertSame($firstKnown, $series[0]['date']);
        $this->assertSame('750.00', $series[0]['rate']);
        $this->assertTrue($series[0]['exact']);
        $this->assertFalse($series[1]['exact']);
    }

    public function test_series_endpoint_shape_and_range_validation(): void
    {
        $this->seedRate(CarbonImmutable::today()->subDays(1)->toDateString(), '700.00');

        $this->getJson('/exchange-rate/series')
            ->assertOk()
            ->assertJsonStructure(['from', 'to', 'series', 'first_date']);

        $this->getJson('/exchange-rate/series?range=30')->assertOk();
        $this->getJson('/exchange-rate/series?range=999')->assertStatus(422);
    }

    public function test_range_all_spans_from_the_first_stored_day(): void
    {
        $first = CarbonImmutable::today()->subDays(20)->toDateString();
        $this->seedRate($first, '700.00');

        $response = $this->getJson('/exchange-rate/series?range=all')->assertOk();

        $this->assertSame($first, $response->json('from'));
        $this->assertSame($first, $response->json('first_date'));
    }

    public function test_calendar_day_rate_carries_backward_on_gap_days(): void
    {
        $this->seedRate(CarbonImmutable::today()->subDays(3)->toDateString(), '812.34');

        // Any later day without its own publication inherits that rate now
        // (previously this returned '0' and the calendar showed an error).
        $this->getJson('/exchange-rate/history?date='.CarbonImmutable::today()->toDateString())
            ->assertOk()
            ->assertJson(['rate' => '812.34']);
    }

    public function test_calendar_day_rate_is_zero_before_any_observation(): void
    {
        $this->getJson('/exchange-rate/history?date=2019-01-01')
            ->assertOk()
            ->assertJson(['rate' => '0']);
    }

    /** Seed one day in both series so a query that mixes them is visible. */
    private function seedBoth(string $date, string $usd, string $eur): void
    {
        ExchangeRate::create(['date_iso' => $date, 'currency' => ExchangeRate::USD, 'rate_bs_per_usd' => $usd, 'fetched_at' => time()]);
        ExchangeRate::create(['date_iso' => $date, 'currency' => ExchangeRate::EUR, 'rate_bs_per_usd' => $eur, 'fetched_at' => time()]);
    }

    public function test_calendar_day_rate_answers_for_the_requested_series(): void
    {
        $date = CarbonImmutable::today()->toDateString();
        $this->seedBoth($date, '812.34', '976.90');

        // The picker stores whatever comes back into income_rate, so asking for
        // the wrong series here would persist a real but wrong rate.
        $this->getJson("/exchange-rate/history?date={$date}&currency=USD")
            ->assertOk()
            ->assertJson(['rate' => '812.34', 'currency' => 'USD']);

        $this->getJson("/exchange-rate/history?date={$date}&currency=EUR")
            ->assertOk()
            ->assertJson(['rate' => '976.90', 'currency' => 'EUR']);
    }

    public function test_calendar_day_rate_falls_back_to_the_currency_cookie(): void
    {
        $date = CarbonImmutable::today()->toDateString();
        $this->seedBoth($date, '812.34', '976.90');

        // No currency in the query: the cookie is the user's answer, so an
        // omitted param must follow it rather than defaulting to dollars. The
        // cookie is sent raw the way the browser sends it, because the toggle
        // writes it with document.cookie and EncryptCookies is told to leave it
        // alone. withCredentials() is required because a JSON test request drops
        // cookies otherwise, which would hide the behaviour being tested.
        $this->withCredentials()
            ->withUnencryptedCookie(DisplayCurrency::COOKIE, ExchangeRate::EUR)
            ->getJson("/exchange-rate/history?date={$date}")
            ->assertOk()
            ->assertJson(['rate' => '976.90', 'currency' => 'EUR']);
    }

    public function test_calendar_day_rate_defaults_to_dollars_without_a_cookie(): void
    {
        $date = CarbonImmutable::today()->toDateString();
        $this->seedBoth($date, '812.34', '976.90');

        $this->getJson("/exchange-rate/history?date={$date}")
            ->assertOk()
            ->assertJson(['rate' => '812.34', 'currency' => 'USD']);
    }

    public function test_calendar_day_rate_rejects_an_unsupported_currency(): void
    {
        $date = CarbonImmutable::today()->toDateString();
        $this->getJson("/exchange-rate/history?date={$date}&currency=GBP")->assertStatus(422);
    }

    public function test_series_endpoint_answers_for_the_requested_currency(): void
    {
        foreach (['2026-09-01', '2026-09-02'] as $date) {
            ExchangeRate::create(['date_iso' => $date, 'currency' => ExchangeRate::USD, 'rate_bs_per_usd' => '812.34', 'fetched_at' => time()]);
            ExchangeRate::create(['date_iso' => $date, 'currency' => ExchangeRate::EUR, 'rate_bs_per_usd' => '976.90', 'fetched_at' => time()]);
        }

        // Euro in: the euro series is the figure the page is about, and the
        // dollar one travels beside it as the comparison. Neither may be
        // derived from the other, so a mix-up here would be invisible.
        $euro = $this->getJson('/exchange-rate/series?range=30&currency=EUR')->assertOk();

        $this->assertSame('EUR', $euro->json('currency'));
        $this->assertSame('USD', $euro->json('comparison_currency'));
        $this->assertSame('976.90', $euro->json('series.0.rate'));
        $this->assertSame('812.34', $euro->json('comparison.0.rate'));

        // And the mirror image, from the same stored rows.
        $usd = $this->getJson('/exchange-rate/series?range=30&currency=USD')->assertOk();

        $this->assertSame('USD', $usd->json('currency'));
        $this->assertSame('EUR', $usd->json('comparison_currency'));
        $this->assertSame('812.34', $usd->json('series.0.rate'));
        $this->assertSame('976.90', $usd->json('comparison.0.rate'));
    }

    public function test_series_endpoint_rejects_an_unsupported_currency(): void
    {
        $this->getJson('/exchange-rate/series?range=30&currency=GBP')->assertStatus(422);
    }

    public function test_series_endpoint_caches_the_two_currencies_separately(): void
    {
        foreach (['2026-09-01', '2026-09-02'] as $date) {
            ExchangeRate::create(['date_iso' => $date, 'currency' => ExchangeRate::USD, 'rate_bs_per_usd' => '812.34', 'fetched_at' => time()]);
            ExchangeRate::create(['date_iso' => $date, 'currency' => ExchangeRate::EUR, 'rate_bs_per_usd' => '976.90', 'fetched_at' => time()]);
        }

        $this->getJson('/exchange-rate/series?range=30&currency=EUR')->assertOk();

        // With one shared cache key the second request would be served the
        // first one's answer, so the euro page would silently show dollars.
        // Rewriting the rows makes a stale read visible.
        ExchangeRate::where('currency', ExchangeRate::USD)->update(['rate_bs_per_usd' => '1.00']);

        $usd = $this->getJson('/exchange-rate/series?range=30&currency=USD')->assertOk();
        $this->assertSame('1.00', $usd->json('series.0.rate'));
    }
}
<?php

namespace Tests\Feature;

use App\Models\ExchangeRate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The rates dashboard's long ranges, and starting up with no connection.
 *
 * "1A" and "Todo" looked broken because the archive that fills them was being
 * downloaded with the same two-second budget as the daily rate, which a bulk
 * history never fits inside, and because that download ran on the very request
 * that had to draw the chart. These hold both rules.
 */
class RateSeriesTest extends TestCase
{
    use RefreshDatabase;

    /** A history payload of the kind the archive endpoint actually returns. */
    private function fakeBcv(): void
    {
        $entries = [];
        $start = now()->subDays(1200);
        for ($i = 0; $i < 1200; $i++) {
            $entries[] = [
                'fecha' => $start->copy()->addDays($i)->toDateString().'T10:00:00.000Z',
                'promedio' => 36.5,
            ];
        }
        Http::fake([
            've.dolarapi.com/v1/historicos/*' => Http::response($entries),
            've.dolarapi.com/v1/*/oficial' => Http::response([
                'promedio' => '36.50',
                'fechaActualizacion' => now()->toDateString().'T10:00:00.000Z',
            ]),
        ]);
    }

    /** Store a handful of observations, as a device that has run for a while. */
    private function storeRecentDays(int $days, string $currency = ExchangeRate::USD): void
    {
        for ($i = $days; $i >= 0; $i--) {
            ExchangeRate::create([
                'date_iso' => now()->subDays($i)->toDateString(),
                'currency' => $currency,
                'rate_bs_per_usd' => '36.50',
                'fetched_at' => time(),
            ]);
        }
    }

    public function test_drawing_a_range_never_downloads_the_archive(): void
    {
        $this->fakeBcv();
        $this->storeRecentDays(10);

        $this->getJson('/exchange-rate/series?range=all&currency=USD')->assertOk();

        // The request that renders the chart must not wait on a bulk download:
        // that is what made the "Todo" button look broken, worst of all offline.
        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'historicos'));
    }

    public function test_a_year_range_answers_with_the_history_the_device_actually_holds(): void
    {
        $this->fakeBcv();
        $this->storeRecentDays(40);

        $response = $this->getJson('/exchange-rate/series?range=365&currency=USD')->assertOk();

        // Eleven months stored, a year asked for: the answer is the shorter truth,
        // and the chart states the span rather than implying a full year.
        // The window runs to the lookahead days BCV publishes ahead, so the count
        // is the stored span plus those, not a round number: what matters is that
        // it is the shorter truth and not a fabricated year.
        $points = $response->json('series');
        $this->assertGreaterThanOrEqual(41, count($points));
        $this->assertLessThan(366, count($points));
        $this->assertSame('36.50', $points[0]['rate']);
        $this->assertSame(ExchangeRate::USD, $response->json('currency'));
    }

    public function test_every_range_answers_rather_than_failing_on_a_sparse_history(): void
    {
        $this->fakeBcv();
        $this->storeRecentDays(5);
        ExchangeRate::create([
            'date_iso' => now()->subDays(2)->toDateString(),
            'currency' => ExchangeRate::EUR,
            'rate_bs_per_usd' => '43.80',
            'fetched_at' => time(),
        ]);

        foreach (['30', '90', '180', '365', 'all'] as $range) {
            $this->getJson("/exchange-rate/series?range={$range}&currency=EUR")
                ->assertOk()
                ->assertJsonStructure(['from', 'to', 'series', 'comparison']);
        }
    }

    public function test_the_day_rate_endpoint_serves_the_rate_in_effect_that_day(): void
    {
        $this->fakeBcv();
        ExchangeRate::create([
            'date_iso' => now()->subDays(10)->toDateString(),
            'currency' => ExchangeRate::USD,
            'rate_bs_per_usd' => '40.00',
            'fetched_at' => time(),
        ]);
        ExchangeRate::create([
            'date_iso' => now()->subDays(2)->toDateString(),
            'currency' => ExchangeRate::USD,
            'rate_bs_per_usd' => '36.50',
            'fetched_at' => time(),
        ]);

        // The expense form asks for this when the user dates an expense to a day
        // in the past: the rate in effect then, carried forward over the weekend.
        $response = $this->getJson('/exchange-rate/history?date='.now()->subDays(5)->toDateString())
            ->assertOk();

        $this->assertSame('40.00', $response->json('rate'));
    }

    public function test_an_offline_start_never_reaches_for_history(): void
    {
        // Every call fails, as on a cold start with no connection.
        Http::fake(['*' => Http::response('offline', 503)]);
        ExchangeRate::create([
            'date_iso' => now()->toDateString(),
            'currency' => ExchangeRate::USD,
            'rate_bs_per_usd' => '36.50',
            'fetched_at' => time(),
        ]);

        $budget = \App\Models\Budget::create([
            'month_id' => now()->format('Y-m'),
            'month_label' => now()->format('F Y'),
            'income_bs' => 1000,
            'opening_balance_bs' => 500,
            'income_rate' => '36.50',
        ]);

        // The dashboard must still render, and must not have tried the bulk
        // history download after the daily fetch failed.
        $this->actingAs(\App\Models\User::factory()->create())
            ->get('/')
            ->assertOk();

        Http::assertNotSent(fn ($request) => str_contains($request->url(), 'historicos'));
        $this->assertSame('36.50', $budget->fresh()->income_rate);
    }
}
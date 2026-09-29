<?php

namespace Tests\Feature;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Expense;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The "Análisis" screen.
 *
 * It is a second view over the dashboard payload rather than its own endpoint,
 * so these tests pin the contract that matters: the route exists, it renders the
 * Insights page, and it receives the same figures the dashboard does. If the two
 * screens ever disagree about a number, one of these fails.
 */
class InsightsRouteTest extends TestCase
{
    use RefreshDatabase;

    private const MONTH = '2026-09';

    private function seedMonth(): Budget
    {
        $budget = Budget::create([
            'month_id' => self::MONTH,
            'month_label' => self::MONTH,
            'income_bs' => 1000,
            'income_rate' => '36.5',
            'opening_balance_bs' => 500,
            'is_custom_rate' => true,
        ]);

        Category::create([
            'month_id' => self::MONTH,
            'name' => 'Comida',
            'cash_expense' => true,
            'is_presupuesto' => false,
            'position' => 0,
        ]);

        Expense::create([
            'id' => (string) Str::uuid(),
            'month_id' => self::MONTH,
            'category_name' => 'Comida',
            'label' => 'Almuerzo',
            'amount_bs' => 100,
            'amount_usd' => 2.7,
            'rate' => 36.5,
            'position' => 0,
            // Milliseconds, matching how the app stamps movements.
            'timestamp' => (int) (mktime(12, 0, 0, 9, 15, 2026) * 1000),
        ]);

        return $budget;
    }

    public function test_it_renders_the_insights_view(): void
    {
        $this->seedMonth();

        $this->get(route('insights', ['month' => self::MONTH]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Insights'));
    }

    public function test_it_receives_the_same_budget_payload_as_the_dashboard(): void
    {
        $this->seedMonth();

        $insights = $this->get(route('insights', ['month' => self::MONTH]));
        $dashboard = $this->get(route('dashboard', ['month' => self::MONTH]));

        $insights->assertOk();
        $dashboard->assertOk();

        $a = $insights->viewData('page')['props'];
        $b = $dashboard->viewData('page')['props'];

        $this->assertSame(
            array_keys($b['budget']),
            array_keys($a['budget']),
            'Insights and Dashboard must expose the same budget fields.'
        );

        $dashboard->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('budget.month_id', self::MONTH)
            ->where('budget.income_bs', '1000')
            ->where('budget.opening_balance_bs', '500')
        );

        $insights->assertInertia(fn ($page) => $page
            ->component('Insights')
            ->where('budget.month_id', self::MONTH)
            ->where('budget.income_bs', '1000')
            ->where('budget.opening_balance_bs', '500')
        );
    }

    public function test_it_honours_the_month_query_parameter(): void
    {
        $this->seedMonth();

        $this->get(route('insights', ['month' => '2026-08']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Insights')
                ->where('budget.month_id', '2026-08'),
            );
    }

    public function test_it_passes_through_the_day_filter(): void
    {
        $this->seedMonth();

        $this->get(route('insights', ['month' => self::MONTH, 'day' => '2026-09-15']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Insights')
                ->where('dateFilter', '2026-09-15'),
            );
    }

    /**
     * Money moved into a savings pool is a transfer, not a deposit row. If the
     * insights screen only looked at `type === 'deposit'` it would report a 0%
     * savings rate for a user who funds savings that way, which is the exact
     * bug this test pins.
     */
    public function test_it_surfaces_transfers_into_savings_in_the_ledger(): void
    {
        $budget = $this->seedMonth();

        $budget->transfers()->create([
            'id' => (string) Str::uuid(),
            'source_type' => 'cash',
            'source_id' => null,
            'destination_type' => 'saving',
            'destination_id' => 'Bank',
            'amount_usd' => 25,
            'amount_bs' => 912.5,
            'rate' => '36.5',
            'note' => 'Ahorro del mes',
            // Milliseconds, matching how the app stamps movements.
            'timestamp' => (int) (mktime(9, 30, 0, 9, 20, 2026) * 1000),
        ]);

        $this->get(route('insights', ['month' => self::MONTH]))
            ->assertOk()
            ->assertInertia(function ($page) {
                $page->component('Insights');

                $ledger = $page->toArray()['props']['savingsLedger'];

                $transfers = array_values(array_filter($ledger, fn ($e) => $e['kind'] === 'transfer'));

                $this->assertCount(1, $transfers, 'The transfer must reach the insights payload.');
                $this->assertSame('saving', $transfers[0]['destination_type']);
                $this->assertEquals(25, (float) $transfers[0]['amount_usd']);
            });
    }

    public function test_it_carries_the_effective_rate_and_both_series(): void
    {
        $this->seedMonth();

        $this->get(route('insights', ['month' => self::MONTH]))
            ->assertOk()
            ->assertInertia(function ($page) {
                $props = $page->toArray()['props'];

                $this->assertArrayHasKey('effective', $props['rates']);
                $this->assertArrayHasKey('latest', $props['rates']['usd']);
                $this->assertArrayHasKey('day', $props['rates']['usd']);
                $this->assertArrayHasKey('latest', $props['rates']['eur']);
                $this->assertArrayHasKey('day', $props['rates']['eur']);
                $this->assertArrayHasKey('isCustomRate', $props);

                // `effective` is the budget form's value and is what every
                // figure converts at, so it must be the stored income_rate
                // rather than a BCV-derived number. The budget arrives
                // serialised here, so it is read as an array.
                $this->assertSame(
                    (string) $props['budget']['income_rate'],
                    (string) $props['rates']['effective'],
                );
            });
    }

    public function test_a_custom_rate_reaches_the_payload_unchanged(): void
    {
        $this->seedMonth();

        $budget = Budget::where('month_id', self::MONTH)->firstOrFail();
        $budget->update(['income_rate' => '36.50', 'is_custom_rate' => true]);

        $this->get(route('insights', ['month' => self::MONTH]))
            ->assertOk()
            ->assertInertia(function ($page) {
                $props = $page->toArray()['props'];

                // The regression: the custom value used to be saved and then
                // never displayed, because the payload offered a BCV-derived
                // `month` and the frontend preferred it.
                $this->assertSame('36.50', (string) $props['rates']['effective']);
                $this->assertTrue($props['isCustomRate']);
            });
    }
}

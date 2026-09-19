<?php

namespace Tests\Feature;

use App\Models\Budget;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BudgetDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake(); // Dashboard tests must not hit the BCV API.
    }

    public function test_shows_the_dashboard_as_a_guest_with_a_seeded_month(): void
    {
        Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'Septiembre 2026',
            'income_bs' => '200000',
            'income_rate' => '250.00',
            'opening_balance_bs' => '50000',
        ]);

        $response = $this->get('/?month=2026-09');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Dashboard')
            ->where('budget.month_id', '2026-09')
            ->etc());
    }

    public function test_loads_an_existing_month_and_creates_missing_ones_on_request(): void
    {
        $response = $this->get('/?month=2026-08');

        $response->assertOk();
        $budget = Budget::find('2026-08');
        $this->assertNotNull($budget);
        $this->assertStringContainsString('Agosto', $budget->month_label);
    }

    public function test_falls_back_to_the_current_month_for_malformed_or_future_months(): void
    {
        $currentMonth = today()->format('Y-m');

        $this->get('/?month=garbage')->assertOk();
        $this->assertNotNull(Budget::find($currentMonth));

        $future = today()->addMonth()->format('Y-m');
        $this->get("/?month={$future}")->assertOk();
        $this->assertNull(Budget::find($future));
    }

    public function test_ignores_day_filters_outside_the_requested_month_or_in_the_future(): void
    {
        $currentMonth = today()->format('Y-m');

        $this->get("/?month={$currentMonth}&day=".today()->addDay()->toDateString())
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('dateFilter', null));

        Budget::firstOrCreate([
            'month_id' => '2026-09',
        ], [
            'month_label' => 'Septiembre 2026',
            'income_bs' => '0',
            'income_rate' => '250.00',
            'opening_balance_bs' => '0',
        ]);

        $this->get('/?month=2026-09&day=2026-09-15')
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('dateFilter', '2026-09-15'));
    }

    public function test_exposes_rate_and_navigation_props(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->has('rate')
                ->has('contextRate')
                ->has('today')
                ->has('currentMonthId')
                ->has('monthIds'));
    }
}

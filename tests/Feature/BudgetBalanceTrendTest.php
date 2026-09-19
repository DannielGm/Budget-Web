<?php

namespace Tests\Feature;

use App\Models\Budget;
use App\Services\BudgetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BudgetBalanceTrendTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::fake(); // Seeder and balance math never need the BCV API.
    }

    private function seed(): void
    {
        $this->artisan('db:seed');
    }

    public function test_demo_seeds_four_months_in_order(): void
    {
        $this->seed();

        $this->assertEquals(
            ['2026-06', '2026-07', '2026-08', '2026-09'],
            Budget::orderBy('month_id')->pluck('month_id')->all()
        );
    }

    public function test_carry_forward_chains_each_months_opening_to_the_previous_closing(): void
    {
        $this->seed();
        $service = app(BudgetService::class);

                // June is the root: its opening is the explicit seed value.
        $june = Budget::find('2026-06');
        $this->assertSame('45000', (string) $june->opening_balance_bs);

        // Every later month opens where the prior month closed.
        $expected = [
            '2026-06' => '45000',
            '2026-07' => $service->calculateBalance(Budget::find('2026-06')->fresh(['expenses', 'categories'])),
            '2026-08' => $service->calculateBalance(Budget::find('2026-07')->fresh(['expenses', 'categories'])),
            '2026-09' => $service->calculateBalance(Budget::find('2026-08')->fresh(['expenses', 'categories'])),
        ];

        foreach ($expected as $monthId => $opening) {
            $this->assertSame($opening, (string) Budget::find($monthId)->opening_balance_bs, $monthId);
        }
    }

    public function test_closing_balances_match_the_declared_trend(): void
    {
        $this->seed();
        $service = app(BudgetService::class);

        $expected = [
            '2026-06' => '11500',
            '2026-07' => '26500',
            '2026-08' => '44500',
            '2026-09' => '66500',
        ];

        foreach ($expected as $monthId => $closing) {
            $budget = Budget::find($monthId)->fresh(['expenses', 'categories']);
            $this->assertSame($closing, $service->calculateBalance($budget), $monthId);
        }
    }

    public function test_trend_is_declining_then_climbing(): void
    {
        $this->seed();

        $closings = Budget::orderBy('month_id')->get()->map(
            fn (Budget $b) => app(BudgetService::class)->calculateBalance(
                $b->fresh(['expenses', 'categories'])
            )
        );

        $this->assertSame('11500', $closings['2026-06']);
        $this->assertGreaterThan($closings['2026-06'], $closings['2026-07']);
        $this->assertGreaterThan($closings['2026-07'], $closings['2026-08']);
        $this->assertGreaterThan($closings['2026-08'], $closings['2026-09']);
    }

    public function test_credit_purchases_carry_forward_as_a_september_debt(): void
    {
        $this->seed();

        $september = Budget::find('2026-09');
        $this->assertDatabaseHas('debts', [
            'month_id' => '2026-09',
            'label' => 'Compras a crédito Agosto',
            'opening_bs' => '12000',
        ]);
        $this->assertGreaterThan(0, $september->debts->count());
    }
}

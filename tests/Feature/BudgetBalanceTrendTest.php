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

    private function seedData(): void
    {
        $this->artisan('db:seed');
    }

    public function test_demo_seeds_four_months_in_order(): void
    {
        $this->seedData();

        $months = Budget::orderBy('month_id')->pluck('month_id')->all();
        $this->assertCount(4, $months);
    }

    public function test_carry_forward_chains_each_months_opening_to_the_previous_closing(): void
    {
        $this->seedData();
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
        $this->seedData();
        $service = app(BudgetService::class);

        $expected = [
            '2026-06' => '1820.00',
            '2026-07' => '4710.00',
            '2026-08' => '13940.00',
            '2026-09' => '25140.00',
        ];

        foreach ($expected as $monthId => $closing) {
            $budget = Budget::find($monthId)->fresh(['expenses', 'categories']);
            $this->assertSame($closing, $service->calculateBalance($budget), $monthId);
        }
    }

    public function test_trend_is_declining_then_climbing(): void
    {
        $this->seedData();

        $closings = Budget::orderBy('month_id')->get()->mapWithKeys(
            fn (Budget $b) => [$b->month_id => app(BudgetService::class)->calculateBalance(
                $b->fresh(['expenses', 'categories'])
            )]
        );

        $this->assertSame('1820.00', $closings['2026-06']);
        $this->assertLessThan($closings['2026-07'], $closings['2026-06']);
        $this->assertLessThan($closings['2026-08'], $closings['2026-07']);
        $this->assertLessThan($closings['2026-09'], $closings['2026-08']);
    }

    public function test_credit_purchases_carry_forward_as_a_september_debt(): void
    {
        $this->seedData();

        $september = Budget::find('2026-09');
        $this->assertDatabaseHas('debts', [
            'month_id' => '2026-09',
            'label' => 'Compras a crédito Agosto',
            'opening_bs' => '12000',
        ]);
        $this->assertGreaterThan(0, $september->debts->count());
    }
}

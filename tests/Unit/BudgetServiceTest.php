<?php

namespace Tests\Unit;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Expense;
use App\Services\BudgetService;
use App\Services\ExchangeRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BudgetServiceTest extends TestCase
{
    use RefreshDatabase;

    protected BudgetService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(BudgetService::class);
    }

    public function test_it_calculates_balance_correctly(): void
    {
        $budget = Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'September 2026',
            'income_bs' => '1000',
            'income_rate' => '36',
            'opening_balance_bs' => '100',
        ]);

        Category::create([
            'month_id' => '2026-09',
            'name' => 'Comida',
            'cash_expense' => true,
            'position' => 1,
        ]);

        Expense::create([
            'id' => '1',
            'month_id' => '2026-09',
            'category_name' => 'Comida',
            'label' => 'Almuerzo',
            'amount_bs' => '200',
            'rate' => '36',
            'timestamp' => time() * 1000,
            'position' => 1,
        ]);

        // 100 (opening) + 1000 (income) - 200 (expense) = 900
        $this->assertEquals('900.00', $this->service->calculateBalance($budget->fresh()));
    }

    public function test_it_carries_forward_opening_balance(): void
    {
        $august = Budget::create([
            'month_id' => '2026-08',
            'month_label' => 'August 2026',
            'income_bs' => '1000',
            'income_rate' => '35',
            'opening_balance_bs' => '0',
        ]);

        Category::create([
            'month_id' => '2026-08',
            'name' => 'Comida',
            'cash_expense' => true,
            'position' => 1,
        ]);

        Expense::create([
            'id' => '1',
            'month_id' => '2026-08',
            'category_name' => 'Comida',
            'label' => 'Gasto',
            'amount_bs' => '200',
            'rate' => '35',
            'timestamp' => time() * 1000,
            'position' => 1,
        ]);

        // August closing balance: 800
        $september = $this->service->loadOrCreate('2026-09');

        $this->assertEquals('800.00', (string)$september->opening_balance_bs);
    }
}

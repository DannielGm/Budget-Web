<?php

namespace Tests\Feature;

use App\Models\Budget;
use App\Models\Category;
use App\Models\User;
use App\Models\Expense;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BudgetTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_budget_settings(): void
    {
        $user = User::factory()->create();
        $budget = Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'September 2026',
            'income_bs' => '1000',
            'income_rate' => '36',
            'opening_balance_bs' => '100',
        ]);

        $response = $this->actingAs($user)->patch(route('budgets.update', $budget->month_id), [
            'income_bs' => '2000',
            'income_rate' => '40',
            'opening_balance_bs' => '200',
        ]);

        $response->assertRedirect();
        $budget->refresh();
        $this->assertEquals('2000', (string)$budget->income_bs);
        $this->assertEquals('40', (string)$budget->income_rate);
        $this->assertEquals('200', (string)$budget->opening_balance_bs);
    }

    public function test_user_can_create_expense(): void
    {
        $user = User::factory()->create();
        Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'September 2026',
            'income_bs' => '1000',
            'income_rate' => '36',
            'opening_balance_bs' => '0',
        ]);
        Category::create([
            'month_id' => '2026-09',
            'name' => 'Comida',
            'cash_expense' => true,
            'position' => 1,
        ]);

        $response = $this->actingAs($user)->post(route('expenses.store'), [
            'month_id' => '2026-09',
            'category_name' => 'Comida',
            'label' => 'Almuerzo',
            'amount_bs' => '500',
            'rate' => '36',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('expenses', [
            'label' => 'Almuerzo',
            'amount_bs' => '500',
            'category_name' => 'Comida',
        ]);
    }

    public function test_user_can_delete_expense(): void
    {
        $user = User::factory()->create();
        Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'September 2026',
            'income_bs' => '1000',
            'income_rate' => '36',
            'opening_balance_bs' => '0',
        ]);
        $expense = Expense::create([
            'id' => 'test-uuid',
            'month_id' => '2026-09',
            'category_name' => 'Comida',
            'label' => 'Almuerzo',
            'amount_bs' => '500',
            'rate' => '36',
            'timestamp' => time(),
            'position' => 1,
        ]);

        $response = $this->actingAs($user)->delete(route('expenses.destroy', $expense->id));

        $response->assertRedirect();
        $this->assertDatabaseMissing('expenses', ['id' => 'test-uuid']);
    }
}

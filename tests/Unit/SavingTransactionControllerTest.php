<?php

namespace Tests\Unit;

use App\Models\Budget;
use App\Models\SavingTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SavingTransactionControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_creates_a_saving_transaction(): void
    {
        $user = User::factory()->create();
        Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'September 2026',
            'income_bs' => '1000',
            'income_rate' => '40',
            'opening_balance_bs' => '100',
        ]);

        $response = $this->actingAs($user)->post(route('savings.store'), [
            'month_id' => '2026-09',
            'type' => 'deposit',
            'category' => 'Binance',
            'amount_usd' => '50',
            'exchange_rate' => '40',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('savings_transactions', [
            'month_id' => '2026-09',
            'type' => 'deposit',
            'category' => 'Binance',
            'amount_usd' => '50.00',
            'exchange_rate' => '40.00',
            'amount_bs' => '2000.00',
        ]);

        $budget = Budget::first();
        // Opening(100) + Income(1000) - Savings(2000) = -900
        $this->assertEquals('-900.00', $budget->available_balance_bs);

        // True Budget = Available(-900) + Savings Value in Bs(50 * 40 = 2000) = 1100
        $this->assertEquals('1100.00', $budget->true_budget_bs);
    }

    public function test_it_updates_a_saving_transaction(): void
    {
        $user = User::factory()->create();
        Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'September 2026',
            'income_bs' => '1000',
            'income_rate' => '40',
            'opening_balance_bs' => '100',
        ]);

        $transaction = SavingTransaction::create([
            'id' => 'test-uuid',
            'month_id' => '2026-09',
            'type' => 'deposit',
            'category' => 'Binance',
            'amount_usd' => '50',
            'exchange_rate' => '40',
            'amount_bs' => '2000',
            'timestamp' => time() * 1000,
        ]);

        $response = $this->actingAs($user)->patch(route('savings.update', $transaction->id), [
            'type' => 'withdrawal',
            'category' => 'Bank',
            'amount_usd' => '20',
            'exchange_rate' => '45',
            'timestamp' => time() * 1000,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('savings_transactions', [
            'id' => 'test-uuid',
            'type' => 'withdrawal',
            'category' => 'Bank',
            'amount_usd' => '20.00',
            'exchange_rate' => '45.00',
            'amount_bs' => '900.00',
        ]);

        $budget = Budget::first();
        // Opening(100) + Income(1000) - Savings(-900) = 2000
        $this->assertEquals('2000.00', $budget->available_balance_bs);

        // True Budget = Available(2000) + Savings Value in Bs(-20 * 40 = -800) = 1200
        $this->assertEquals('1200.00', $budget->true_budget_bs);
    }
}

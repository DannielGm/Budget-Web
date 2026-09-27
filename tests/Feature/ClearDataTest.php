<?php

namespace Tests\Feature;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\ExchangeRate;
use App\Models\Expense;
use App\Models\SavingTransaction;
use App\Models\Transfer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The settings menu's three destructive actions.
 *
 * The contract every one of them owes the user: delete the movements in their
 * range, and never touch the global exchange-rate table, which the whole app
 * depends on and which carries no month_id.
 */
class ClearDataTest extends TestCase
{
    use RefreshDatabase;

    private const MONTH_A = '2026-09';
    private const MONTH_B = '2026-08';

    private function seedRates(int $count = 3): void
    {
        foreach (range(1, $count) as $i) {
            ExchangeRate::create([
                'date_iso' => sprintf('2026-09-%02d', $i),
                'rate_bs_per_usd' => (string) (36 + $i),
                'fetched_at' => time(),
            ]);
        }
    }

    /** Two fully populated months, so leakage between them is detectable. */
    private function seedMonths(): void
    {
        foreach ([self::MONTH_A, self::MONTH_B] as $monthId) {
            $budget = Budget::create([
                'month_id' => $monthId,
                'month_label' => $monthId,
                'income_bs' => 1000,
                'income_rate' => '36.5',
                'opening_balance_bs' => 500,
                'is_custom_rate' => true,
            ]);

            $budget->expenses()->create([
                'id' => (string) Str::uuid(),
                'category_name' => 'Comida',
                'label' => 'Almuerzo',
                'amount_bs' => 100,
                'amount_usd' => 2.7,
                'rate' => '36.5',
                'timestamp' => 1788278400000, // 2026-09-01
                'position' => 1,
            ]);

            $budget->savingsTransactions()->create([
                'id' => (string) Str::uuid(),
                'type' => 'deposit',
                'category' => 'Digital',
                'amount_usd' => 10,
                'amount_bs' => 365,
                'exchange_rate' => '36.5',
                'timestamp' => 1788278400000,
            ]);

            $budget->transfers()->create([
                'id' => (string) Str::uuid(),
                'source_type' => 'cash',
                'source_id' => null,
                'destination_type' => 'saving',
                'destination_id' => 'Digital',
                'amount_bs' => 200,
                'amount_usd' => 5.5,
                'rate' => '36.5',
                'timestamp' => 1788278400000,
                'note' => 'Transferencia',
            ]);

            $debt = $budget->debts()->create([
                'label' => 'Prestamo',
                'opening_bs' => 800,
                'payment_bs' => 300,
                'credit_expenses_bs' => 0,
                'position' => 1,
            ]);

            $debt->payments()->create([
                'id' => 'dp-'.$monthId,
                'amount_bs' => 300,
                'method' => 'Transferencia',
                'timestamp' => 1788278400000,
            ]);

            $budget->categories()->create([
                'name' => 'Comida',
                'cash_expense' => true,
                'is_presupuesto' => false,
                'position' => 1,
            ]);
        }
    }

    public function test_clearing_a_day_removes_only_that_day_and_spares_rates(): void
    {
        $this->seedRates();
        $this->seedMonths();
        $rateCount = ExchangeRate::count();

        $this->post(route('settings.clear-day', self::MONTH_A), [
            'month_id' => self::MONTH_A,
            'date' => '2026-09-01',
        ])->assertRedirect(route('dashboard'));

        $this->assertSame(0, Expense::where('month_id', self::MONTH_A)->count());
        $this->assertSame(0, SavingTransaction::where('month_id', self::MONTH_A)->count());
        $this->assertSame(0, Transfer::where('month_id', self::MONTH_A)->count());
        $this->assertSame(0, DebtPayment::where('debt_id', Debt::where('month_id', self::MONTH_A)->pluck('id'))->count());

        // The other month is untouched.
        $this->assertSame(1, Expense::where('month_id', self::MONTH_B)->count());
        $this->assertSame(1, Transfer::where('month_id', self::MONTH_B)->count());

        // Structure and the global rate table survive.
        $this->assertSame(1, Category::where('month_id', self::MONTH_A)->count());
        $this->assertSame($rateCount, ExchangeRate::count());
    }

    public function test_clearing_a_month_keeps_its_categories_and_zeroes_the_budget(): void
    {
        $this->seedRates();
        $this->seedMonths();
        $rateCount = ExchangeRate::count();

        $this->post(route('settings.clear-month', self::MONTH_A), [
            'month_id' => self::MONTH_A,
        ])->assertRedirect(route('settings'));

        $this->assertSame(0, Expense::where('month_id', self::MONTH_A)->count());
        $this->assertSame(0, SavingTransaction::where('month_id', self::MONTH_A)->count());
        $this->assertSame(0, Transfer::where('month_id', self::MONTH_A)->count());
        $this->assertSame(0, DebtPayment::whereIn('debt_id', Debt::where('month_id', self::MONTH_A)->pluck('id'))->count());
        $this->assertSame(1, Debt::where('month_id', self::MONTH_B)->count(), 'the other month keeps its debts');

        $budget = Budget::find(self::MONTH_A);
        $this->assertNotNull($budget, 'the month must keep its place in the list');
        $this->assertSame(1, Category::where('month_id', self::MONTH_A)->count());
        $this->assertEquals(0, $budget->income_bs);
        $this->assertEquals(0, $budget->opening_balance_bs);
        $this->assertFalse((bool) $budget->is_custom_rate);

        // Other month and the rate table are untouched.
        $this->assertSame(1, Expense::where('month_id', self::MONTH_B)->count());
        $this->assertSame($rateCount, ExchangeRate::count());
    }

    public function test_clearing_everything_empties_all_data_but_keeps_rates(): void
    {
        $this->seedRates(5);
        $this->seedMonths();
        $rateCount = ExchangeRate::count();

        $this->post(route('settings.clear'))->assertRedirect(route('dashboard'));

        $this->assertSame(0, Expense::count());
        $this->assertSame(0, SavingTransaction::count());
        $this->assertSame(0, Transfer::count());
        $this->assertSame(0, DebtPayment::whereIn('debt_id', Debt::where('month_id', self::MONTH_A)->pluck('id'))->count());
        $this->assertSame(0, Debt::count());
        $this->assertSame(0, Category::count());
        $this->assertSame(0, Budget::count());

        // The one thing that must never go.
        $this->assertSame($rateCount, ExchangeRate::count());
    }

    public function test_a_day_outside_the_month_is_rejected(): void
    {
        $this->seedMonths();

        $this->post(route('settings.clear-day', self::MONTH_A), [
            'month_id' => self::MONTH_A,
            'date' => '2026-08-01',
        ])->assertRedirect();

        $this->assertSame(1, Expense::where('month_id', self::MONTH_A)->count());
    }
}

<?php

namespace Tests\Feature;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Expense;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The savings summary.
 *
 * The same arrangement as the "Analisis" screen: the pool strip opens a route
 * that renders the dashboard payload under its own view name, so the two screens
 * cannot disagree about a figure. These tests pin the contract that matters --
 * the route exists, it renders the Savings page, it receives the dashboard
 * payload, and every source the patrimony is built from actually arrives.
 */
class SavingsRouteTest extends TestCase
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
            'timestamp' => (int) (mktime(12, 0, 0, 9, 15, 2026) * 1000),
        ]);

        return $budget;
    }

    public function test_it_renders_the_savings_view(): void
    {
        $this->seedMonth();

        $this->get(route('savings.dashboard', ['month' => self::MONTH]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Savings'));
    }

    public function test_it_receives_the_same_budget_payload_as_the_dashboard(): void
    {
        $this->seedMonth();

        $savings = $this->get(route('savings.dashboard', ['month' => self::MONTH]));
        $dashboard = $this->get(route('dashboard', ['month' => self::MONTH]));

        $savings->assertOk();
        $dashboard->assertOk();

        $a = $savings->viewData('page')['props'];
        $b = $dashboard->viewData('page')['props'];

        $this->assertSame(
            array_keys($b['budget']),
            array_keys($a['budget']),
            'The savings summary and the dashboard must expose the same budget fields.'
        );
    }

    /**
     * Every source the patrimony adds up has to be in the payload: cash, the
     * pools, and the two liabilities the debt total is made of.
     */
    public function test_it_carries_the_sources_the_patrimony_is_built_from(): void
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
            'timestamp' => (int) (mktime(9, 30, 0, 9, 20, 2026) * 1000),
        ]);

        $this->get(route('savings.dashboard', ['month' => self::MONTH]))
            ->assertOk()
            ->assertInertia(function ($page) {
                $payload = $page->toArray()['props'];
                $budget = $payload['budget'];

                foreach (['savings_pools', 'total_savings_usd', 'available_balance_bs', 'debt_bs', 'credit_purchases_bs'] as $key) {
                    $this->assertArrayHasKey($key, $budget, "The savings summary needs {$key}.");
                }

                // The strip reads the pools, so a deposit has to reach them.
                $balances = collect($budget['savings_pools'])->keyBy('name');
                $this->assertSame('25.00', (string) $balances['Bank']['balance_usd']);

                // Both series travel with the payload: the summary crosses from
                // the dollar savings into whichever currency is on screen.
                $this->assertArrayHasKey('latest', $payload['rates']['usd']);
                $this->assertArrayHasKey('latest', $payload['rates']['eur']);
            });
    }

    /**
     * A deposit is saved in one currency and a pool keeps its dollars and its
     * euros apart, so the two must never land in the same pot.
     */
    public function test_a_euro_deposit_lands_in_the_euro_pot(): void
    {
        $budget = $this->seedMonth();

        $this->post(route('savings.store'), [
            'month_id' => self::MONTH,
            'type' => 'deposit',
            'category' => 'Digital',
            'currency' => 'EUR',
            'amount_usd' => 10,
            'exchange_rate' => 43.8,
        ])->assertSessionHasNoErrors();

        $budget = $budget->fresh();
        $pools = collect($budget->savings_pools)->keyBy('name');

        $this->assertSame('10.00', $pools['Digital']['balance_eur']);
        // A pot nothing has ever been saved into is the bare seed, not "0.00":
        // it is a balance that was never computed, and the frontend reads both
        // as zero.
        $this->assertSame('0', $pools['Digital']['balance_usd']);
        $this->assertSame('10.00', $budget->total_savings_eur);
        $this->assertSame('0.00', $budget->total_savings_usd);
    }

    /**
     * A client that does not send the field is not "unknown": every savings row
     * this app ever wrote was in dollars.
     */
    public function test_a_deposit_with_no_currency_is_dollars(): void
    {
        $budget = $this->seedMonth();

        $this->post(route('savings.store'), [
            'month_id' => self::MONTH,
            'type' => 'deposit',
            'category' => 'Bank',
            'amount_usd' => 10,
            'exchange_rate' => 36.5,
        ])->assertSessionHasNoErrors();

        $pools = collect($budget->fresh()->savings_pools)->keyBy('name');

        $this->assertSame('10.00', $pools['Bank']['balance_usd']);
        $this->assertSame('0', $pools['Bank']['balance_eur']);
    }

    public function test_it_rejects_a_currency_it_does_not_hold(): void
    {
        $this->seedMonth();

        $this->post(route('savings.store'), [
            'month_id' => self::MONTH,
            'type' => 'deposit',
            'category' => 'Digital',
            'currency' => 'BTC',
            'amount_usd' => 10,
            'exchange_rate' => 36.5,
        ])->assertSessionHasErrors('currency');
    }

    /**
     * The view the user was on travels in the URL, so coming back from this
     * screen lands on the savings view rather than the balance card.
     */
    public function test_it_carries_the_view_the_user_was_on(): void
    {
        $this->seedMonth();

        $this->get(route('savings.dashboard', ['month' => self::MONTH, 'view' => 'savings']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('view', 'savings'));

        // A hand-typed query cannot ask the dashboard for a view it does not have.
        $this->get(route('savings.dashboard', ['month' => self::MONTH, 'view' => 'nope']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('view', null));
    }

    /**
     * The marking travels with the movement, so a screen can filter on it
     * instead of guessing what a stored amount is.
     */
    public function test_the_ledger_says_which_pot_each_movement_belongs_to(): void
    {
        $this->seedMonth();

        foreach ([['EUR', 'Digital', 10, 43.8], ['USD', 'Bank', 25, 36.5]] as [$currency, $pool, $amount, $rate]) {
            $this->post(route('savings.store'), [
                'month_id' => self::MONTH,
                'type' => 'deposit',
                'category' => $pool,
                'currency' => $currency,
                'amount_usd' => $amount,
                'exchange_rate' => $rate,
            ])->assertSessionHasNoErrors();
        }

        $this->get(route('savings.dashboard', ['month' => self::MONTH]))
            ->assertOk()
            ->assertInertia(function ($page) {
                $currencies = array_map(
                    fn ($entry) => $entry['currency'],
                    $page->toArray()['props']['savingsLedger'],
                );
                sort($currencies);

                $this->assertSame(['EUR', 'USD'], $currencies);
            });
    }
}
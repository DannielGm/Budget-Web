<?php

namespace Tests\Feature;

use App\Models\Budget;
use App\Models\SavingTransaction;
use App\Models\Transfer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A savings POOL IS A RUNNING BALANCE, and this is the test that says so.
 *
 * The bug: getSavingsPoolsAttribute() read the month-scoped relations, so every
 * pool opened a new month at 0.00. Savings you had already banked stopped
 * existing the moment the calendar turned over -- while debts, which
 * loadOrCreate() clones forward as an opening balance, carried on correctly.
 * The two behaved differently for no reason the user could see, which is the
 * worst kind of difference: the same concept, two answers.
 *
 * The fix sums every month up to and including the one on screen. These tests
 * pin that, and pin the things that could break it: a withdrawal must still
 * subtract, the two pots must stay independent, a month with no history must
 * report zero rather than borrowing the previous month's figure by accident,
 * and clearing a month must stop counting (those movements are gone).
 */
class SavingsCarryOverTest extends TestCase
{
    use RefreshDatabase;

    private function budget(string $monthId): Budget
    {
        return Budget::create([
            'month_id' => $monthId,
            'month_label' => $monthId,
            'income_bs' => '0',
            'income_rate' => '36.5',
            'opening_balance_bs' => '0',
            'is_custom_rate' => true,
        ]);
    }

    /** A manual savings movement in a given month. */
    private function movement(string $monthId, string $pool, string $type, string $amount, string $currency = 'USD', ?int $at = null): SavingTransaction
    {
        return SavingTransaction::create([
            'id' => (string) Str::uuid(),
            'month_id' => $monthId,
            'type' => $type,
            'category' => $pool,
            'currency' => $currency,
            'amount_usd' => $amount,
            'exchange_rate' => '36.5',
            'amount_bs' => bcmul($amount, '36.5', 2),
            'timestamp' => $at ?? (int) (mktime(12, 0, 0, 9, 15, 2026) * 1000),
        ]);
    }

    /** A transfer leg into or out of a pool. */
    private function transfer(string $monthId, string $type, string $id, string $amount, string $currency = 'USD'): Transfer
    {
        return Transfer::create([
            'id' => (string) Str::uuid(),
            'month_id' => $monthId,
            'source_type' => $type === 'destination' ? 'cash' : 'saving',
            'source_id' => $type === 'destination' ? null : $id,
            'destination_type' => $type === 'destination' ? 'saving' : 'cash',
            'destination_id' => $type === 'destination' ? $id : null,
            'currency' => $currency,
            'amount_usd' => $amount,
            'amount_bs' => bcmul($amount, '36.5', 2),
            'rate' => '36.5',
            'timestamp' => (int) (mktime(12, 0, 0, 9, 15, 2026) * 1000),
        ]);
    }

    /** The balance of one named pool, as the payload would carry it. */
    private function pool(Budget $budget, string $name, string $pot = 'usd'): string
    {
        $found = collect($budget->fresh()->savings_pools)->firstWhere('name', $name);

        return (string) ($found['balance_'.$pot]);
    }

    public function test_a_pool_keeps_its_balance_into_the_next_month(): void
    {
        $september = $this->budget('2026-09');
        $this->movement('2026-09', 'Digital', 'deposit', '100.00');

        $october = $this->budget('2026-10');

        // The whole point: October opens with September's savings intact.
        $this->assertSame('100.00', $this->pool($october, 'Digital'));
        $this->assertSame('100.00', $this->pool($september, 'Digital'), 'the earlier month is unchanged');
    }

    public function test_savings_accumulate_across_three_months(): void
    {
        $this->budget('2026-08');
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        $this->movement('2026-08', 'Digital', 'deposit', '10.00');
        $this->movement('2026-09', 'Digital', 'deposit', '25.50');
        $this->movement('2026-10', 'Digital', 'deposit', '4.25');

        $this->assertSame('39.75', $this->pool($october, 'Digital'));
    }

    public function test_a_withdrawal_still_subtracts_across_the_boundary(): void
    {
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        $this->movement('2026-09', 'Bank', 'deposit', '200.00');
        $this->movement('2026-10', 'Bank', 'withdrawal', '50.00');

        // A withdrawal in the new month counts against what was carried, rather
        // than being ignored because the deposit lived somewhere else.
        $this->assertSame('150.00', $this->pool($october, 'Bank'));
    }

    public function test_transfer_legs_carry_and_still_offset_each_other(): void
    {
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        // Cash into Digital last month, and part of it back out this month.
        $this->transfer('2026-09', 'destination', 'Digital', '80.00');
        $this->transfer('2026-10', 'source', 'Digital', '30.00');

        $this->assertSame('50.00', $this->pool($october, 'Digital'));
    }

    public function test_a_pool_to_pool_move_does_not_invent_money(): void
    {
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        $this->movement('2026-09', 'Digital', 'deposit', '100.00');
        // Out of Digital and into Bank in the same month: both legs, one row each.
        $this->transfer('2026-09', 'source', 'Digital', '40.00');
        $this->transfer('2026-09', 'destination', 'Bank', '40.00');

        $this->assertSame('60.00', $this->pool($october, 'Digital'));
        $this->assertSame('40.00', $this->pool($october, 'Bank'));
    }

    public function test_the_two_pots_carry_independently(): void
    {
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        $this->movement('2026-09', 'Digital', 'deposit', '100.00', 'USD');
        $this->movement('2026-09', 'Digital', 'deposit', '75.00', 'EUR');

        // A pot is not converted into the other one on the way over: dollars stay
        // dollars and euros stay euros, which is the whole reason they are kept
        // in separate columns.
        $this->assertSame('100.00', $this->pool($october, 'Digital', 'usd'));
        $this->assertSame('75.00', $this->pool($october, 'Digital', 'eur'));
    }

    public function test_a_month_with_no_movements_still_shows_the_running_balance(): void
    {
        $this->budget('2026-09');
        $this->movement('2026-09', 'Digital', 'deposit', '60.00');

        // October has no movements of its own, and its pool is NOT zero. This is
        // the feature stated in its plainest form: an untouched month reports
        // what you have, not what you did this month.
        $october = $this->budget('2026-10');

        $this->assertSame('60.00', $this->pool($october, 'Digital'));
        $this->assertSame('60.00', $october->fresh()->total_savings_usd);
    }

    public function test_a_pool_that_was_never_used_stays_zero(): void
    {
        $this->budget('2026-09');
        $this->movement('2026-09', 'Bank', 'deposit', '30.00');
        $october = $this->budget('2026-10');

        $this->assertSame('0', $this->pool($october, 'Physical'));
    }

    public function test_clearing_a_month_removes_its_contribution(): void
    {
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        $this->movement('2026-09', 'Digital', 'deposit', '100.00');
        $this->assertSame('100.00', $this->pool($october, 'Digital'));

        // Deleting September's movements really does delete that money: those
        // rows are the only record of it, which is the trade this approach makes
        // in exchange for never seeding duplicate opening rows.
        SavingTransaction::where('month_id', '2026-09')->delete();

        $this->assertSame('0', $this->pool($october->fresh(), 'Digital'));
    }

    public function test_the_totals_sum_the_pools_across_months(): void
    {
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        $this->movement('2026-09', 'Digital', 'deposit', '100.00');
        $this->movement('2026-09', 'Bank', 'deposit', '50.00');
        $this->movement('2026-10', 'Physical', 'deposit', '25.00');

        $october = $october->fresh();

        $this->assertSame('175.00', $october->total_savings_usd);
    }

    public function test_the_month_ledger_still_only_shows_that_month(): void
    {
        // The counterpart to everything above, and the reason the relations were
        // left alone: a running balance and a month's activity are different
        // questions, and changing the first must not quietly change the second.
        $this->budget('2026-09');
        $october = $this->budget('2026-10');

        $this->movement('2026-09', 'Digital', 'deposit', '100.00');
        $this->movement('2026-10', 'Digital', 'deposit', '20.00');

        $this->assertCount(1, $october->savingsTransactions, 'October lists only October');
        $this->assertCount(1, Budget::find('2026-09')->savingsTransactions);
        $this->assertSame('120.00', $this->pool($october, 'Digital'));
    }
}

<?php

namespace Tests\Unit;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Expense;
use App\Models\SavingTransaction;
use App\Models\Transfer;
use App\Services\BackupService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Tests\TestCase;
use Throwable;

class BackupServiceTest extends TestCase
{
    use RefreshDatabase;

    protected BackupService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(BackupService::class);
    }

    public function test_it_round_trips_every_table(): void
    {
        $this->seedMonth();

        $payload = $this->service->exportPayload();
        $this->deleteEverything();

        $summary = $this->service->importPayload($payload);

        $this->assertSame(1, $summary['months']);

        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09', 'is_custom_rate' => 1]);
        $this->assertDatabaseHas('categories', ['month_id' => '2026-09', 'name' => 'Comida', 'cash_expense' => 1]);
        $this->assertDatabaseHas('categories', ['month_id' => '2026-09', 'name' => 'Ahorro', 'is_presupuesto' => 1]);
        $this->assertDatabaseHas('expenses', ['id' => 'exp-1', 'amount_bs' => '120']);
        $this->assertDatabaseHas('debts', ['month_id' => '2026-09', 'label' => 'Tarjeta']);
        $this->assertDatabaseHas('debt_payments', ['id' => 'pay-1', 'amount_bs' => '50.00']);
        $this->assertDatabaseHas('savings_transactions', ['id' => 'sav-1', 'category' => 'Digital']);
        $this->assertDatabaseHas('transfers', ['id' => 'tra-1', 'destination_type' => 'saving']);
    }

    public function test_the_derived_figures_survive_a_restore(): void
    {
        $this->seedMonth();

        $before = Budget::findOrFail('2026-09');
        $payload = $this->service->exportPayload();
        $this->deleteEverything();

        $this->service->importPayload($payload);

        // The whole point of the exercise: savings movements, debt payments and
        // transfers all feed these numbers, so a restore that dropped any of them
        // would silently change what the user sees.
        $after = Budget::findOrFail('2026-09');
        $after->load(['categories', 'expenses', 'debts', 'debts.payments', 'savingsTransactions', 'transfers']);

        $this->assertSame('450.00', (string) $before->available_balance_bs);
        $this->assertSame((string) $before->available_balance_bs, (string) $after->available_balance_bs);
        $this->assertSame((string) $before->total_savings_usd, (string) $after->total_savings_usd);
        $this->assertSame((string) $before->true_budget_bs, (string) $after->true_budget_bs);
        $this->assertSame((string) $before->debt_bs, (string) $after->debt_bs);
    }

    public function test_it_imports_a_legacy_bare_array_export(): void
    {
        // The shape the first release wrote: budgets with their children nested,
        // and none of the tables that did not exist yet.
        $legacy = [[
            'month_id' => '2026-08',
            'month_label' => 'Agosto 2026',
            'income_bs' => '500',
            'income_rate' => '36',
            'opening_balance_bs' => '0',
            'categories' => [
                ['month_id' => '2026-08', 'name' => 'Comida', 'cash_expense' => 1, 'position' => 1],
            ],
            'expenses' => [
                [
                    'id' => 'old-1', 'month_id' => '2026-08', 'category_name' => 'Comida',
                    'label' => 'Pan', 'amount_bs' => '10', 'rate' => '36', 'timestamp' => 1757000000, 'position' => 1,
                ],
            ],
            'debts' => [
                ['month_id' => '2026-08', 'label' => 'Vieja', 'opening_bs' => '50', 'payment_bs' => '0', 'position' => 1],
            ],
        ]];

        $summary = $this->service->importPayload($legacy);

        $this->assertSame(1, $summary['months']);
        $this->assertDatabaseHas('budgets', ['month_id' => '2026-08']);
        $this->assertDatabaseHas('categories', ['month_id' => '2026-08', 'name' => 'Comida', 'is_presupuesto' => 0]);
        $this->assertDatabaseHas('expenses', ['id' => 'old-1']);
        $this->assertDatabaseHas('debts', ['month_id' => '2026-08', 'label' => 'Vieja']);
        $this->assertSame(0, DB::table('savings_transactions')->count());
    }

    public function test_a_file_that_is_not_a_backup_leaves_the_data_alone(): void
    {
        $this->seedMonth();

        // An unrelated JSON document that happens to carry a `data` key must not
        // be allowed to wipe the device on its way to restoring nothing.
        try {
            $this->service->importPayload(['format' => 'some-other-app', 'data' => ['budgets' => []]]);
            $this->fail('Expected the import to be refused.');
        } catch (InvalidArgumentException $e) {
            $this->assertStringContainsString('no es un respaldo', $e->getMessage());
        }

        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
        $this->assertDatabaseHas('savings_transactions', ['id' => 'sav-1']);
    }

    public function test_a_backup_from_a_newer_release_is_refused(): void
    {
        $this->seedMonth();

        $payload = $this->service->exportPayload();
        $payload['format_version'] = BackupService::FORMAT_VERSION + 1;

        $this->expectException(InvalidArgumentException::class);

        $this->service->importPayload($payload);
    }

    public function test_a_failed_restore_rolls_back_completely(): void
    {
        $this->seedMonth();

        $payload = $this->service->exportPayload();

        // A debt payment whose debt is not in the file: the insert trips the
        // foreign key after the wipe has already run, so the transaction is the
        // only thing between the user and an empty ledger.
        $payload['data']['debts'] = [];
        $payload['data']['categories'] = [];

        try {
            $this->service->importPayload($payload);
            $this->fail('Expected the restore to fail.');
        } catch (Throwable) {
            // expected — the assertions below are the point
        }

        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09']);
        $this->assertDatabaseHas('debts', ['month_id' => '2026-09', 'label' => 'Tarjeta']);
        $this->assertDatabaseHas('categories', ['month_id' => '2026-09', 'name' => 'Ahorro']);
        $this->assertDatabaseHas('debt_payments', ['id' => 'pay-1']);
        $this->assertDatabaseHas('transfers', ['id' => 'tra-1']);
    }

    public function test_a_row_missing_what_its_table_requires_is_skipped_not_fatal(): void
    {
        $this->seedMonth();

        $payload = $this->service->exportPayload();

        // A hand-edited file with one unusable row in it: the rest still lands.
        $payload['data']['budgets'][] = ['month_label' => 'Sin mes'];

        $summary = $this->service->importPayload($payload);

        $this->assertSame(1, $summary['months']);
        $this->assertDatabaseHas('budgets', ['month_id' => '2026-09', 'month_label' => 'Septiembre 2026']);
    }

    /** One month that touches every table the backup covers. */
    private function seedMonth(): void
    {
        Budget::create([
            'month_id' => '2026-09',
            'month_label' => 'Septiembre 2026',
            'income_bs' => '1000',
            'income_rate' => '40',
            'opening_balance_bs' => '100',
            'is_custom_rate' => true,
        ]);

        $debt = Debt::create([
            'month_id' => '2026-09',
            'label' => 'Tarjeta',
            'opening_bs' => '200',
            'payment_bs' => '50',
            'position' => 1,
        ]);

        Category::create([
            'month_id' => '2026-09',
            'name' => 'Comida',
            'cash_expense' => true,
            'position' => 1,
        ]);

        // Linked to the debt, so a restore has to write debts before categories.
        Category::create([
            'month_id' => '2026-09',
            'name' => 'Ahorro',
            'cash_expense' => false,
            'is_presupuesto' => true,
            'position' => 2,
            'debt_id' => $debt->id,
        ]);

        Expense::create([
            'id' => 'exp-1',
            'month_id' => '2026-09',
            'category_name' => 'Comida',
            'label' => 'Mercado',
            'amount_bs' => '120',
            'rate' => '40',
            'timestamp' => 1758000000,
            'position' => 1,
        ]);

        DebtPayment::create([
            'id' => 'pay-1',
            'debt_id' => $debt->id,
            'amount_bs' => '50',
            'method' => 'Transferencia',
            'timestamp' => 1758000000,
        ]);

        SavingTransaction::create([
            'id' => 'sav-1',
            'month_id' => '2026-09',
            'type' => 'deposit',
            'category' => 'Digital',
            'amount_usd' => '10',
            'exchange_rate' => '40',
            'amount_bs' => '400',
            'timestamp' => 1758000000,
        ]);

        Transfer::create([
            'id' => 'tra-1',
            'month_id' => '2026-09',
            'source_type' => 'cash',
            'destination_type' => 'saving',
            'destination_id' => 'Bank',
            'amount_bs' => '80',
            'amount_usd' => '2',
            'rate' => '40',
            'timestamp' => 1758000000,
        ]);
    }

    /** Leave the tables as empty as a fresh install. */
    private function deleteEverything(): void
    {
        foreach (array_reverse(BackupService::TABLES) as $table) {
            DB::table($table)->delete();
        }
    }
}

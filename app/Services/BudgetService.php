<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use Illuminate\Support\Facades\DB;

class BudgetService
{
    public function getBudget(string $monthId): ?Budget
    {
        $budget = Budget::with(['categories', 'expenses', 'debts', 'debts.payments', 'transfers'])->find($monthId);
        if ($budget) {
            // We append the new credit_expenses_bs attribute directly to the debts so the UI can read it
            $budget->debts->each->append('credit_expenses_bs');

            // Append dynamic attributes for JSON serialization
            $budget->append([
                'cash_bs',
                'credit_purchases_bs',
                'debt_payments_bs',
                'total_deposits_bs',
                'total_withdrawals_bs',
                'available_balance_bs',
                'true_budget_bs',
                'balance_bs',
                'debt_bs',
                'savings_pools',
                'total_savings_usd',
            ]);
        }
        return $budget;
    }

    private const MONTH_NAMES = [
        1 => 'Enero', 2 => 'Febrero', 3 => 'Marzo', 4 => 'Abril',
        5 => 'Mayo', 6 => 'Junio', 7 => 'Julio', 8 => 'Agosto',
        9 => 'Septiembre', 10 => 'Octubre', 11 => 'Noviembre', 12 => 'Diciembre',
    ];

    public function loadOrCreate(string $monthId, ?string $templateMonthId = null): Budget
    {
        $existing = Budget::find($monthId);
        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($monthId, $templateMonthId) {
            $predecessor = Budget::where('month_id', '<', $monthId)
                ->orderBy('month_id', 'desc')
                ->first();

            $template = $templateMonthId
                ? Budget::find($templateMonthId)
                : ($predecessor ?: Budget::orderBy('month_id', 'asc')->first());

            $budget = Budget::create([
                'month_id' => $monthId,
                'month_label' => $this->getMonthLabel($monthId),
                'income_bs' => '0',
                'income_rate' => '0',
                'opening_balance_bs' => $predecessor ? $this->calculateBalance($predecessor) : '0',
                'is_custom_rate' => true, // Default to OFF for new budgets
            ]);

            // A brand-new month starts with the BCV rate that applies to it
            // (matches the Kotlin app's loadOrCreate).
            $monthRate = app(ExchangeRateService::class)->monthRateFor($monthId);
            if ($monthRate !== null) {
                $budget->update(['income_rate' => $monthRate->rate_bs_per_usd]);
            }

            if ($predecessor) {
                // We MUST create debts BEFORE categories because cloned categories need the newly cloned debt IDs.
                foreach ($predecessor->debts as $debt) {
                    $creditAdded = $debt->credit_expenses_bs; // The specific linked credit expenses added last month
                    $totalOwed = bcadd($debt->opening_bs, $creditAdded, 2);
                    $remaining = bcsub($totalOwed, $debt->payment_bs, 2);

                    if (bccomp($remaining, '0', 2) > 0) {
                        Debt::create([
                            'month_id' => $monthId,
                            'label' => $debt->label,
                            'opening_bs' => $remaining,
                            'payment_bs' => '0',
                            'position' => $debt->position,
                        ]);
                    }
                }

                $creditPurchases = $this->calculateCreditPurchases($predecessor);
                if (bccomp($creditPurchases, '0', 2) > 0) {
                    Debt::create([
                        'month_id' => $monthId,
                        'label' => 'Compras a crédito '.$this->getMonthName($predecessor->month_id),
                        'opening_bs' => $creditPurchases,
                        'payment_bs' => '0',
                        'position' => 999, // Append to end
                    ]);
                }
            }

            if ($template) {
                foreach ($template->categories as $category) {
                    // Find the equivalent debt bucket in the NEW month if it was linked
                    $newDebtId = null;
                    if ($category->debt_id) {
                        $oldDebt = Debt::find($category->debt_id);
                        if ($oldDebt) {
                            $newDebt = Debt::where('month_id', $monthId)
                                ->where('label', $oldDebt->label)
                                ->first();
                            if ($newDebt) {
                                $newDebtId = $newDebt->id;
                            }
                        }
                    }

                    Category::create([
                        'month_id' => $monthId,
                        'name' => $category->name,
                        'cash_expense' => $category->cash_expense,
                        'is_presupuesto' => $category->is_presupuesto,
                        'position' => $category->position,
                        'debt_id' => $newDebtId,
                    ]);
                }
            }

            return $budget;
        });
    }

    public function calculateBalance(Budget $budget): string
    {
        return $budget->available_balance_bs;
    }

    public function calculateCreditPurchases(Budget $budget): string
    {
        return $budget->credit_purchases_bs;
    }

    public function seedMockData(string $currentMonthId): void
    {
        $seeder = new \Database\Seeders\FakeBudgetSeeder();
        $seeder->seedBackwardsFrom($currentMonthId);
    }

    public function clearDay(string $monthId, string $dateIso): void
    {
        $budget = $this->getBudget($monthId);
        if (!$budget) return;

        $start = \Carbon\CarbonImmutable::parse($dateIso)->startOfDay()->timestamp * 1000;
        $end = \Carbon\CarbonImmutable::parse($dateIso)->endOfDay()->timestamp * 1000;

        $budget->expenses()->whereBetween('timestamp', [$start, $end])->delete();
        $budget->savingsTransactions()->whereBetween('timestamp', [$start, $end])->delete();
        $budget->transfers()->whereBetween('timestamp', [$start, $end])->delete();

        foreach ($budget->debts as $debt) {
            $debt->payments()->whereBetween('timestamp', [$start, $end])->delete();
        }
    }

    private function getMonthLabel(string $monthId): string
    {
        [$year, $month] = array_map('intval', explode('-', $monthId));

        return (self::MONTH_NAMES[$month] ?? $monthId).' '.$year;
    }

    private function getMonthName(string $monthId): string
    {
        $month = (int) substr($monthId, 5, 2);

        return self::MONTH_NAMES[$month] ?? $monthId;
    }

       /**
     * Unified savings ledger: manual transactions merged with savings-related
     * transfers, chronologically sorted (latest first).
     */
    public function savingsLedger(Budget $budget): array
    {
        $entries = [];

        foreach ($budget->savingsTransactions()->orderBy('timestamp', 'desc')->get() as $t) {
            $entries[] = [
                'id' => $t->id,
                'kind' => 'transaction',
                'type' => $t->type,
                'pool' => Budget::normalizeSavingsPool($t->category) ?? $t->category,   // line 173
                'amount_usd' => (string) $t->amount_usd,
                'amount_bs' => (string) $t->amount_bs,
                'exchange_rate' => (string) $t->exchange_rate,
                'timestamp' => (int) $t->timestamp,
            ];
        }

        foreach ($budget->transfers()->orderBy('timestamp', 'desc')->get() as $tr) {
            $involvesSavings = $tr->source_type === 'saving' || $tr->destination_type === 'saving';
            if (! $involvesSavings) {
                continue;
            }

            $entries[] = [
                'id' => $tr->id,
                'kind' => 'transfer',
                'source_type' => $tr->source_type,
                'source_id' => Budget::normalizeSavingsPool($tr->source_id),            // line 191
                'destination_type' => $tr->destination_type,
                'destination_id' => Budget::normalizeSavingsPool($tr->destination_id),
                'amount_usd' => (string) $tr->amount_usd,
                'amount_bs' => (string) $tr->amount_bs,
                'rate' => (string) $tr->rate,
                'note' => $tr->note,
                'timestamp' => (int) $tr->timestamp,
            ];
        }

        usort($entries, fn ($a, $b) => $b['timestamp'] <=> $a['timestamp']);

        return $entries;
    }
}

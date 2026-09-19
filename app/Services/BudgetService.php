<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Debt;
use App\Models\Expense;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BudgetService
{
    public function getBudget(string $monthId): ?Budget
    {
        return Budget::with(['categories', 'expenses', 'debts'])->find($monthId);
    }

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
            ]);

            if ($template) {
                foreach ($template->categories as $category) {
                    Category::create([
                        'month_id' => $monthId,
                        'name' => $category->name,
                        'cash_expense' => $category->cash_expense,
                        'position' => $category->position,
                    ]);
                }
            }

            if ($predecessor) {
                foreach ($predecessor->debts as $debt) {
                    $remaining = bcsub($debt->opening_bs, $debt->payment_bs, 2);
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
                        'label' => "Compras a crédito " . $this->getMonthName($predecessor->month_id),
                        'opening_bs' => $creditPurchases,
                        'payment_bs' => '0',
                        'position' => 999, // Append to end
                    ]);
                }
            }

            return $budget;
        });
    }

    public function calculateBalance(Budget $budget): string
    {
        $cashExpenses = $budget->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', true)
            ->sum('amount_bs');

        $balance = bcadd($budget->opening_balance_bs, $budget->income_bs, 2);
        $balance = bcsub($balance, (string)$cashExpenses, 2);

        return $balance;
    }

    public function calculateCreditPurchases(Budget $budget): string
    {
        return (string) $budget->expenses()
            ->join('categories', function($join) {
                $join->on('expenses.month_id', '=', 'categories.month_id')
                     ->on('expenses.category_name', '=', 'categories.name');
            })
            ->where('categories.cash_expense', false)
            ->sum('amount_bs');
    }

    private function getMonthLabel(string $monthId): string
    {
        // Simple implementation for now
        $date = \DateTime::createFromFormat('Y-m', $monthId);
        return $date ? $date->format('F Y') : $monthId;
    }

    private function getMonthName(string $monthId): string
    {
        $date = \DateTime::createFromFormat('Y-m', $monthId);
        return $date ? $date->format('F') : $monthId;
    }
}

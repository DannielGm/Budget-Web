<?php

namespace Database\Seeders;

use App\Models\Budget;
use App\Models\Category;
use App\Models\Expense;
use App\Models\Debt;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class BudgetSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $path = database_path('data/september.private.json');
        if (!File::exists($path)) {
            return;
        }

        $json = json_decode(File::get($path), true);
        $monthId = config('budget.seed_month', '2026-09');

        $budget = Budget::create([
            'month_id' => $monthId,
            'month_label' => $json['monthLabel'],
            'income_bs' => $json['incomeBs'],
            'income_rate' => $json['incomeRate'],
            'opening_balance_bs' => '0', // Initial seed has no opening balance
        ]);

        foreach ($json['categories'] as $index => $catData) {
            $category = Category::create([
                'month_id' => $monthId,
                'name' => $catData['name'],
                'cash_expense' => $catData['cashExpense'],
                'position' => $index,
            ]);

            foreach ($catData['rows'] as $rowIndex => $row) {
                Expense::create([
                    'id' => $row['id'],
                    'month_id' => $monthId,
                    'category_name' => $catData['name'],
                    'label' => $row['label'],
                    'amount_bs' => $row['amountBs'],
                    'rate' => $row['rate'],
                    'timestamp' => now()->timestamp * 1000, // Approximate timestamp
                    'position' => $rowIndex,
                ]);
            }
        }

        foreach ($json['debts'] as $index => $debtData) {
            Debt::create([
                'month_id' => $monthId,
                'label' => $debtData['label'],
                'opening_bs' => $debtData['openingBs'],
                'payment_bs' => $debtData['paymentBs'],
                'position' => $index,
            ]);
        }
    }
}

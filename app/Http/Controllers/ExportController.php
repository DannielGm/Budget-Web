<?php

namespace App\Http\Controllers;

use App\Models\Budget;
use Illuminate\Http\Request;

class ExportController extends Controller
{
    public function export()
    {
        $data = Budget::with(['categories', 'expenses', 'debts', 'categories.expenses'])->get();

        return response()->json($data, 200, [
            'Content-Type' => 'application/json',
            'Content-Disposition' => 'attachment; filename="bkeeper_backup_' . date('Y-m-d') . '.json"',
        ]);
    }

    public function import(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:json',
        ]);

        $content = file_get_contents($request->file('file')->getRealPath());
        $data = json_decode($content, true);

        if (!$data) {
            return back()->withErrors(['file' => 'Archivo JSON inválido.']);
        }

        // Simple implementation: wipe and replace for parity with "offline sync"
        // In a real app we might want a more surgical merge.
        \Illuminate\Support\Facades\DB::transaction(function () use ($data) {
            \App\Models\Expense::truncate();
            \App\Models\Debt::truncate();
            \App\Models\Category::truncate();
            \App\Models\Budget::truncate();

            foreach ($data as $budgetData) {
                $budget = Budget::create([
                    'month_id' => $budgetData['month_id'],
                    'month_label' => $budgetData['month_label'],
                    'income_bs' => $budgetData['income_bs'],
                    'income_rate' => $budgetData['income_rate'],
                    'opening_balance_bs' => $budgetData['opening_balance_bs'],
                ]);

                foreach ($budgetData['categories'] as $catData) {
                    \App\Models\Category::create([
                        'month_id' => $budget->month_id,
                        'name' => $catData['name'],
                        'cash_expense' => $catData['cash_expense'],
                        'planned_bs' => $catData['planned_bs'] ?? '0',
                        'position' => $catData['position'],
                    ]);
                }

                foreach ($budgetData['expenses'] as $expData) {
                    \App\Models\Expense::create([
                        'id' => $expData['id'],
                        'month_id' => $budget->month_id,
                        'category_name' => $expData['category_name'],
                        'label' => $expData['label'],
                        'amount_bs' => $expData['amount_bs'],
                        'rate' => $expData['rate'],
                        'timestamp' => $expData['timestamp'],
                        'position' => $expData['position'],
                    ]);
                }

                foreach ($budgetData['debts'] as $debtData) {
                    \App\Models\Debt::create([
                        'month_id' => $budget->month_id,
                        'label' => $debtData['label'],
                        'opening_bs' => $debtData['opening_bs'],
                        'payment_bs' => $debtData['payment_bs'],
                        'position' => $debtData['position'],
                    ]);
                }
            }
        });

        return back();
    }
}

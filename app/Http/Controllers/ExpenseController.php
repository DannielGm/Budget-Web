<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ExpenseController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'month_id' => 'required|string|exists:budgets,month_id',
            'category_name' => 'required|string',
            'label' => 'required|string',
            'amount_bs' => 'required|numeric|min:0',
            'rate' => 'required|numeric|min:0',
            'timestamp' => 'nullable|integer',
        ]);

        $validated['id'] = (string) Str::uuid();
        if (!isset($validated['timestamp'])) {
            $validated['timestamp'] = (int) (microtime(true) * 1000);
        }

        // Get max position for this month/category
        $maxPosition = Expense::where('month_id', $validated['month_id'])
            ->where('category_name', $validated['category_name'])
            ->max('position') ?: 0;

        $validated['position'] = $maxPosition + 1;

        Expense::create($validated);

        return back();
    }

    public function update(Request $request, Expense $expense)
    {
        $validated = $request->validate([
            'label' => 'required|string',
            'amount_bs' => 'required|numeric|min:0',
            'rate' => 'required|numeric|min:0',
            'timestamp' => 'required|integer',
        ]);

        $expense->update($validated);

        return back();
    }

    public function destroy(Expense $expense)
    {
        $expense->delete();

        return back();
    }
}

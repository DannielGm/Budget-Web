<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'month_id' => 'required|string|exists:budgets,month_id',
            'name' => 'required|string|max:255',
            'cash_expense' => 'required|boolean',
            'is_presupuesto' => 'required|boolean',
            'planned_bs' => 'nullable|numeric|min:0',
            'debt_id' => 'nullable|integer|exists:debts,id',
        ]);

        $maxPosition = Category::where('month_id', $validated['month_id'])->max('position') ?: 0;
        $validated['position'] = $maxPosition + 1;

        // Ensure debt_id is wiped if it's not a credit category anymore
        if ($validated['cash_expense'] || $validated['is_presupuesto']) {
            $validated['debt_id'] = null;
        }

        // Ensure planned_bs defaults to 0 if null, and wiped if not presupuesto
        if (!$validated['is_presupuesto']) {
            $validated['planned_bs'] = 0;
        } else {
            $validated['planned_bs'] = $validated['planned_bs'] ?? 0;
        }

        Category::create($validated);

        return back();
    }

    public function update(Request $request, Category $category)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cash_expense' => 'sometimes|boolean',
            'is_presupuesto' => 'sometimes|boolean',
            'planned_bs' => 'nullable|numeric|min:0',
            'debt_id' => 'nullable|integer|exists:debts,id',
        ]);

        // Ensure debt_id is wiped if it's not a credit category anymore
        $isCash = $validated['cash_expense'] ?? $category->cash_expense;
        $isPresupuesto = $validated['is_presupuesto'] ?? $category->is_presupuesto;
        if ($isCash || $isPresupuesto) {
            $validated['debt_id'] = null;
        }

        // Ensure planned_bs defaults to 0 if null, and wiped if not presupuesto
        if (!$isPresupuesto) {
            $validated['planned_bs'] = 0;
        } else {
            $validated['planned_bs'] = $validated['planned_bs'] ?? 0;
        }

        // If name changes, we need to update all associated expenses
        if ($validated['name'] !== $category->name) {
            $category->expenses()->update(['category_name' => $validated['name']]);
        }

        $category->update($validated);

        return back();
    }

    public function destroy(Category $category)
    {
        $category->expenses()->delete();
        $category->delete();
        return back();
    }
}

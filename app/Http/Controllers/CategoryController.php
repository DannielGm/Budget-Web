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
        ]);

        $maxPosition = Category::where('month_id', $validated['month_id'])->max('position') ?: 0;
        $validated['position'] = $maxPosition + 1;

        Category::create($validated);

        return back();
    }

    public function update(Request $request, Category $category)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'cash_expense' => 'sometimes|boolean',
        ]);

        // If name changes, we need to update all associated expenses
        if ($validated['name'] !== $category->name) {
            $category->expenses()->update(['category_name' => $validated['name']]);
        }

        $category->update($validated);

        return back();
    }

    public function destroy(Category $category)
    {
        $category->delete();
        return back();
    }
}

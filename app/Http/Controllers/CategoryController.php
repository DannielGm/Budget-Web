<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function update(Request $request, Category $category)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'planned_bs' => 'required|numeric|min:0',
        ]);

        // If name changes, we need to update all associated expenses
        if ($validated['name'] !== $category->name) {
            $category->expenses()->update(['category_name' => $validated['name']]);
        }

        $category->update($validated);

        return back();
    }
}

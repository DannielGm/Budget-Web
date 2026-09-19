<?php

namespace App\Http\Controllers;

use App\Services\BudgetService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    public function __construct(
        protected BudgetService $budgetService
    ) {}

    public function index(Request $request): Response
    {
        $monthId = $request->query('month', config('budget.seed_month'));
        $budget = $this->budgetService->loadOrCreate($monthId);

        return Inertia::render('Dashboard', [
            'budget' => $budget->load(['categories', 'expenses', 'debts']),
            'monthIds' => \App\Models\Budget::orderBy('month_id', 'desc')->pluck('month_id'),
            'version' => config('budget.version'),
        ]);
    }

    public function update(Request $request, \App\Models\Budget $budget)
    {
        $validated = $request->validate([
            'income_bs' => 'required|numeric|min:0',
            'income_rate' => 'required|numeric|min:0',
            'opening_balance_bs' => 'required|numeric',
        ]);

        $budget->update($validated);

        return back();
    }
}

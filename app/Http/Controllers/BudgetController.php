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
}

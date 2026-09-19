<?php

namespace App\Http\Controllers;

use App\Models\Budget;
use App\Services\BudgetService;
use App\Services\ExchangeRateService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BudgetController extends Controller
{
    public function __construct(
        protected BudgetService $budgetService,
        protected ExchangeRateService $rateService
    ) {}

    public function index(Request $request): Response
    {
        $monthId = $this->parseMonth($request->query('month'));
        $dayIso = $this->parseDay($request->query('day'), $monthId);

        // Rate maintenance runs before the month loads so a newly created
        // month already opens with the current BCV rate.
        $rateSnapshot = $this->rateService->ensureFresh();

        $budget = $this->budgetService->loadOrCreate($monthId);
        $monthRate = $this->rateService->monthRateFor($monthId);

        // When a day filter is active the balance uses the rate that was in
        // effect on that day, falling back to the month rate.
        $contextRate = $dayIso
            ? $this->rateService->dayRate($dayIso, $monthRate)
            : $monthRate;

        return Inertia::render('Dashboard', [
            'budget' => $budget->load(['categories', 'expenses', 'debts']),
            'monthIds' => Budget::orderBy('month_id', 'desc')->pluck('month_id'),
            'version' => config('budget.version'),
            'rate' => $rateSnapshot,
            'contextRate' => $contextRate?->rate_bs_per_usd ?? $budget->income_rate,
            'dateFilter' => $dayIso,
            'today' => CarbonImmutable::today()->toDateString(),
            'currentMonthId' => CarbonImmutable::today()->format('Y-m'),
            'monthIdsHaveRates' => $rateSnapshot['updated_today'],
        ]);
    }

    public function update(Request $request, Budget $budget)
    {
        $validated = $request->validate([
            'income_bs' => 'required|numeric|min:0',
            'income_rate' => 'required|numeric|min:0',
            'opening_balance_bs' => 'required|numeric',
        ]);

        $budget->update($validated);

        return back();
    }

    public function refreshRate()
    {
        $snapshot = $this->rateService->ensureFresh(true);

        return back()->with('rate_snapshot', $snapshot);
    }

    public function settings(): Response
    {
        return Inertia::render('Settings', [
            'version' => config('budget.version'),
        ]);
    }

    public function clearAll()
    {
        \Illuminate\Support\Facades\DB::transaction(function () {
            \App\Models\Expense::truncate();
            \App\Models\Debt::truncate();
            \App\Models\Category::truncate();
            \App\Models\Budget::truncate();
        });

        return to_route('dashboard');
    }

    /**
     * Accept only well-formed, non-future months (YYYY-MM); anything else
     * falls back to the current month.
     */
    private function parseMonth(?string $raw): string
    {
        $today = CarbonImmutable::today();
        $candidate = $raw && preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $raw) ? $raw : null;

        if ($candidate === null || $candidate > $today->format('Y-m')) {
            return $today->format('Y-m');
        }

        return $candidate;
    }

    /**
     * Accept only well-formed, non-future days inside the requested month.
     */
    private function parseDay(?string $raw, string $monthId): ?string
    {
        if ($raw === null || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            return null;
        }

        $today = CarbonImmutable::today()->toDateString();

        if ($raw > $today || substr($raw, 0, 7) !== $monthId) {
            return null;
        }

        return $raw;
    }
}

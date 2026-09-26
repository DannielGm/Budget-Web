<?php

namespace App\Http\Controllers;

use App\Models\Budget;
use App\Services\BackupImportResult;
use App\Services\BackupTransports;
use App\Services\BudgetService;
use App\Services\ExchangeRateService;
use Carbon\CarbonImmutable;
use App\Models\Category;
use App\Models\Debt;
use App\Models\ExchangeRate;
use App\Models\Expense;
use App\Models\SavingTransaction;
use App\Support\NativeCapabilities;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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

        $budget->load(['categories', 'expenses', 'debts', 'debts.payments', 'savingsTransactions', 'transfers']);
        $budget->debts->each->append('credit_expenses_bs');
        $budget->append([
            'cash_bs',
            'credit_purchases_bs',
            'debt_payments_bs',
            'total_deposits_bs',
            'total_withdrawals_bs',
            'available_balance_bs',
            'true_budget_bs',
            'balance_bs',
            'debt_bs',
            'savings_pools',
            'total_savings_usd',
        ]);

        return Inertia::render('Dashboard', [
            'budget' => $budget,
            'savingsLedger' => fn () => $this->budgetService->savingsLedger($budget),
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
            'is_custom_rate' => 'sometimes|boolean',
        ]);

        $budget->update($validated);

        // If they toggled back to auto-updating (false), we instantly fix the rate if needed
        if (isset($validated['is_custom_rate']) && !$validated['is_custom_rate']) {
            $this->rateService->refreshMonthRates();
        }

        return back();
    }

    public function refreshRate()
    {
        $snapshot = $this->rateService->ensureFresh(true);

        // Bust the series cache so the rates view shows the fresh figure.
        Cache::put('rate-series:generation', (int) Cache::get('rate-series:generation', 1) + 1);

        return back()->with('rate_snapshot', $snapshot);
    }

    public function historicalRate(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        // Days without their own BCV publication inherit the closest earlier
        // observation (backward carry), same rule as the rates dashboard.
        $rate = $this->rateService->latestOnOrBefore($validated['date']);

        return response()->json([
            'rate' => $rate?->rate_bs_per_usd ?? '0'
        ]);
    }

    /**
     * Daily BCV series for the rates dashboard. Days with no publication
     * carry the closest earlier rate (ExchangeRateService::rateSeries).
     * range: 30|90|180|365 days, or "all" (asks for the full public archive).
     */
    public function rateSeries(Request $request)
    {
        $validated = $request->validate([
            'range' => 'nullable|in:30,90,180,365,all',
        ]);

        $range = (string) ($validated['range'] ?? '180');
        $to = CarbonImmutable::today()->toDateString();

        if ($range === 'all') {
            // Ask the API for the complete archive (guarded to 1 attempt / 6h),
            // then serve everything we hold.
            $this->rateService->ensureFullArchive();
            $first = ExchangeRate::orderBy('date_iso')->value('date_iso');
            $from = $first ?? $to;
        } else {
            $from = CarbonImmutable::today()->subDays(min((int) $range, 1500) - 1)->toDateString();
        }

        $generation = (int) Cache::get('rate-series:generation', 1);
        $series = Cache::remember(
            'rate-series:'.$generation.':'.$from.':'.$to,
            300,
            fn () => $this->rateService->rateSeries($from, $to)
        );

        return response()->json([
            'from' => $from,
            'to' => $to,
            'series' => $series,
            'first_date' => $series[0]['date'] ?? null,
        ]);
    }

    public function settings(BackupImportResult $pickResult): Response
    {
        $budgets = Budget::orderBy('month_id', 'desc')->get();
        $months = $budgets->map(fn (Budget $b) => [
            'month_id' => $b->month_id,
            'month_label' => $b->month_label,
        ]);

        // Which backup transports this build can reach. Probed here rather
        // than shared globally: it costs a bridge round-trip on a device and
        // only this page ever asks.
        //
        // The transport lists are derived from that same probe, so the page and
        // the export route read one table instead of each re-deriving the rule
        // and disagreeing about what this build supports.
        $capabilities = NativeCapabilities::detect();
        $transports = new BackupTransports($capabilities);

        // The picked import finished in a request of its own, with no page
        // attached to it, so the outcome could not ride back on a response the
        // page was waiting for. Instead it is delivered here: whoever opens the
        // Settings page next finds the result already rendered. That replaced a
        // 20-second poll, which reported failure for a restore that was about to
        // succeed whenever the user took longer than that to choose a file.
        $pickedImport = $pickResult->toNotice();

        // Shown once. Left in place it would greet the user with the same
        // "restored 3 months" message on every visit for the next half hour.
        if ($pickedImport !== null) {
            $pickResult->forget();
        }

        return Inertia::render('Settings', [
            'months' => $months,
            'monthIds' => $months->pluck('month_id'),
            'version' => config('budget.version'),
            'native' => $capabilities,
            'exportActions' => $transports->exportActions(),
            'importActions' => $transports->importActions(),
            'pickedImport' => $pickedImport,
        ]);
    }

    public function seedMock(): RedirectResponse
    {
        $targetMonth = config('budget.seed_month', '2026-09');
        $seeder = new \Database\Seeders\FakeBudgetSeeder();
        $seeder->seedBackwardsFrom($targetMonth);

        return to_route('dashboard');
    }

    public function clearMonth(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'month_id' => 'required|string|exists:budgets,month_id',
        ]);

        $monthId = $validated['month_id'];

        DB::transaction(function () use ($monthId) {
            Expense::where('month_id', $monthId)->delete();
            SavingTransaction::where('month_id', $monthId)->delete();
            Debt::where('month_id', $monthId)->delete();
            Category::where('month_id', $monthId)->delete();
            Budget::where('month_id', $monthId)->delete();
        });

        return to_route('settings');
    }

    public function clearAll()
    {
        \Illuminate\Support\Facades\DB::transaction(function () {
            \App\Models\DebtPayment::truncate();
            \App\Models\SavingTransaction::truncate();
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

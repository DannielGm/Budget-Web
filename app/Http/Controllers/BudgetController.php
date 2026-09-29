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
use App\Models\DebtPayment;
use App\Models\SavingTransaction;
use App\Models\Transfer;
use App\Support\DisplayCurrency;
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
        [$view, $props] = $this->budgetPayload($request, 'Dashboard');

        return Inertia::render($view, $props);
    }

    /**
     * "Análisis" renders the same payload as the dashboard under a different
     * view name, so the two screens can never disagree about a figure.
     */
    public function insights(Request $request): Response
    {
        [$view, $props] = $this->budgetPayload($request, 'Insights');

        return Inertia::render($view, $props);
    }

    /**
     * The savings summary, opened from the pool strip in the savings view. Same
     * arrangement as "Analisis": the dashboard payload under another view name,
     * so the two screens can never disagree about a figure.
     */
    public function savings(Request $request): Response
    {
        [$view, $props] = $this->budgetPayload($request, 'Savings');

        return Inertia::render($view, $props);
    }

    /**
     * @return array{0: string, 1: array}
     */
    private function budgetPayload(Request $request, string $view): array
    {
        $monthId = $this->parseMonth($request->query('month'));
        $dayIso = $this->parseDay($request->query('day'), $monthId);

        // Rate maintenance runs before the month loads so a newly created
        // month already opens with the current BCV rate.
        $rateSnapshot = $this->rateService->ensureFresh();

        $budget = $this->budgetService->loadOrCreate($monthId);
        $monthRate = $this->rateService->monthRateFor($monthId);

        // Both series travel with the payload. The frontend picks between them
        // per figure, so a euro display can use a real historical euro rate for a
        // picked day while a custom rate stays the user's own number.
        $monthRateEur = $this->rateService->monthRateFor($monthId, ExchangeRate::EUR);
        $dayRateEur = $dayIso
            ? $this->rateService->dayRate($dayIso, $monthRateEur, ExchangeRate::EUR)
            : null;

        $dayRateUsd = $dayIso
            ? $this->rateService->dayRate($dayIso, $monthRate)
            : null;

        // The rate the balance card's own conversion divides at, which is what a
        // new expense must start from: the day's rate when a day filter is
        // active, and otherwise whatever the budget form holds.
        //
        // It deliberately does NOT fall back to the BCV month rate. That number
        // is the first of the month carried forward, so a budget whose form holds
        // a custom rate would hand a new expense a rate the balance card is not
        // even showing: the expense would convert at one number while the screen
        // reads in another. The form's number is the fallback, exactly as it is
        // for the card (rateFor() falls back to rates.effective), and a day with
        // no published observation falls back to it too.
        $contextRate = $dayIso
            ? $this->rateService->dayRate($dayIso)
            : null;

        // Today's published rate per series. This is what the budget form's
        // daily switch writes, and it has to be a real observation rather than
        // the month's: the switch promises a DAILY rate, and the month rate is
        // the first of the month carried forward, which by the 2nd is already
        // yesterday's number. latestOnOrBefore() carries across days BCV did
        // not publish, so an unupdated morning still shows a real figure.
        $latestUsd = $this->rateService->latestOnOrBefore(CarbonImmutable::today()->toDateString(), ExchangeRate::USD);
        $latestEur = $this->rateService->latestOnOrBefore(CarbonImmutable::today()->toDateString(), ExchangeRate::EUR);

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
            'total_savings_eur',
        ]);

        return [$view, [
            'budget' => $budget,
            'savingsLedger' => fn () => $this->budgetService->savingsLedger($budget),
            'monthIds' => Budget::orderBy('month_id', 'desc')->pluck('month_id'),
            'version' => config('budget.version'),
            'rate' => $rateSnapshot,
            'contextRate' => $contextRate?->rate_bs_per_usd ?? $budget->income_rate,
            'rates' => [
                // The rate the whole screen converts at: whatever the budget
                // form holds. It is the single source of truth for the month, so
                // a custom rate is honoured everywhere rather than being saved
                // and then ignored. refreshMonthRates() keeps it tracking BCV on
                // every load unless it is custom, so "the form wins" needs no
                // enforcement here -- the self-heal IS the enforcement.
                //
                // The BCV month rate is deliberately NOT what figures divide by.
                // It used to be, which meant a custom income_rate was stored and
                // then never displayed anywhere.
                'effective' => (string) $budget->income_rate,

                // The two real BCV series, kept for the two things that genuinely
                // need them: the daily switch writes the latest, and savings --
                // stored in dollars -- need Bs/USD to show a bolivar line
                // whichever series is on screen.
                'usd' => [
                    'latest' => $latestUsd?->rate_bs_per_usd ?? null,
                    'day' => $dayRateUsd?->rate_bs_per_usd ?? null,
                ],
                'eur' => [
                    'latest' => $latestEur?->rate_bs_per_usd ?? null,
                    'day' => $dayRateEur?->rate_bs_per_usd ?? null,
                ],
            ],
            'isCustomRate' => (bool) $budget->is_custom_rate,
            'dateFilter' => $dayIso,
            // Which dashboard view to open on. The view is client state, so it
            // has to travel in the URL: without it, a return visit from the
            // savings summary lands on the balance card instead of the savings
            // screen the user left. Sanitised here so a hand-typed query cannot
            // ask for a view that does not exist.
            'view' => in_array($request->query('view'), ['main', 'rates', 'savings'], true)
                ? $request->query('view')
                : null,
            'today' => CarbonImmutable::today()->toDateString(),
            'currentMonthId' => CarbonImmutable::today()->format('Y-m'),
            'monthIdsHaveRates' => $rateSnapshot['updated_today'],
        ]];
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

        // Refreshing is a deliberate tap, so this is where the archive belongs:
        // it is what makes the 1A and "Todo" ranges show a real year of history
        // instead of only the months this device has managed to store.
        $this->rateService->ensureFullArchive();

        // Bust the series cache so the rates view shows the fresh figure.
        Cache::put('rate-series:generation', (int) Cache::get('rate-series:generation', 1) + 1);

        return back()->with('rate_snapshot', $snapshot);
    }

    public function historicalRate(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date_format:Y-m-d',
            'currency' => 'nullable|in:USD,EUR',
        ]);

        // The series asked for is the series the user is looking at. Asking for
        // the dollar rate and storing it in a euro screen would put a real but
        // wrong number into income_rate, so this defaults to the cookie rather
        // than to dollars, and the picker sends the currency it is showing.
        $currency = $validated['currency'] ?? DisplayCurrency::current($request);

        // Days without their own BCV publication inherit the closest earlier
        // observation (backward carry), same rule as the rates dashboard.
        $rate = $this->rateService->latestOnOrBefore($validated['date'], $currency);

        return response()->json([
            'rate' => $rate?->rate_bs_per_usd ?? '0',
            'currency' => $currency,
        ]);
    }

    /**
     * Daily BCV series for the rates dashboard. Days with no publication
     * carry the closest earlier rate (ExchangeRateService::rateSeries).
     * range: 30|90|180|365 days, or "all" (asks for the full public archive).
     */
    /** Days after today the rate series is extended to, to surface forward-published BCV rates. */
    private const RATE_SERIES_LOOKAHEAD_DAYS = 1;

    public function rateSeries(Request $request)
    {
        $validated = $request->validate([
            'range' => 'nullable|in:30,90,180,365,all',
            'currency' => 'nullable|in:USD,EUR',
        ]);

        $range = (string) ($validated['range'] ?? '180');

        // The series on screen is the primary; the other one travels beside it
        // as a comparison. Both are real BCV observations of the same unit --
        // bolivares per one unit of the currency -- so they can share one axis
        // honestly. Neither is derived from the other: each is read from its
        // own rows, so a day missing from one series cannot borrow the other's.
        $currency = $validated['currency'] ?? DisplayCurrency::current($request);
        $other = DisplayCurrency::counterpart($currency);

        // BCV occasionally publishes the rate for the next day(s) ahead of
        // time. Carry the window a few days past today so those forward rates
        // reach the dashboard instead of being cut off at today's date.
        $to = CarbonImmutable::today()->addDays(self::RATE_SERIES_LOOKAHEAD_DAYS)->toDateString();

        if ($range === 'all') {
            // Serve everything already stored, and do NOT pull the archive from
            // in here: that is a bulk download, and doing it on the request that
            // draws the chart meant the "Todo" button could hang for as long as
            // the network took -- worst of all with no connection, which is
            // exactly when the user is waiting on a chart. The refresh button is
            // the deliberate place for that work, and this view reports the span
            // it really has instead of implying a history we may not hold.
            $first = ExchangeRate::currency($currency)->orderBy('date_iso')->value('date_iso');
            $from = $first ?? $to;
        } else {
            $from = CarbonImmutable::today()->subDays(min((int) $range, 1500) - 1)->toDateString();
        }

        $generation = (int) Cache::get('rate-series:generation', 1);
        $cacheKey = 'rate-series:'.$generation.':'.$currency.':'.$from.':'.$to;
        [$series, $comparison] = Cache::remember(
            $cacheKey,
            300,
            fn () => [
                $this->rateService->rateSeries($from, $to, $currency),
                $this->rateService->rateSeries($from, $to, $other),
            ]
        );

        return response()->json([
            'from' => $from,
            'to' => $to,
            'series' => $series,
            'comparison' => $comparison,
            'currency' => $currency,
            'comparison_currency' => $other,
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

        // Exchange rates are deliberately untouched: they are a global
        // reference table, not month data, and the whole app depends on them.
        DB::transaction(function () use ($monthId) {
            Expense::where('month_id', $monthId)->delete();
            SavingTransaction::where('month_id', $monthId)->delete();
            Transfer::where('month_id', $monthId)->delete();

            // Children first so nothing relies on a foreign-key cascade.
            DebtPayment::whereIn('debt_id', Debt::where('month_id', $monthId)->pluck('id'))->delete();
            Debt::where('month_id', $monthId)->delete();

            // Categories and the budget row survive, zeroed, so the month keeps
            // its place in the list with its category structure intact.
            Budget::where('month_id', $monthId)->update([
                'income_bs' => 0,
                'opening_balance_bs' => 0,
                'is_custom_rate' => false,
            ]);
        });

        return to_route('settings');
    }

    public function clearAll()
    {
        // Exchange rates are deliberately untouched: they are a global
        // reference table, not budget data, and the whole app depends on them.
        //
        // delete() rather than truncate(), which on SQLite resets AUTOINCREMENT
        // and drops foreign-key enforcement for the duration of the statement.
        // Children are removed before their parents so no cascade is relied on.
        DB::transaction(function () {
            Expense::query()->delete();
            SavingTransaction::query()->delete();
            Transfer::query()->delete();
            DebtPayment::query()->delete();
            Debt::query()->delete();
            Category::query()->delete();
            Budget::query()->delete();
        });

        return to_route('dashboard');
    }

    /**
     * Clear every movement recorded on one day, keeping the month itself,
     * its categories and the global exchange-rate table intact.
     */
    public function clearDay(Request $request): RedirectResponse
    {
        $monthId = (string) $request->input('month_id', '');
        $date = $this->parseDay($request->input('date'), $monthId);

        if ($date === null) {
            return back();
        }

        $this->budgetService->clearDay($monthId, $date);

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

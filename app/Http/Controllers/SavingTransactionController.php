<?php

namespace App\Http\Controllers;

use App\Models\Budget;
use App\Models\SavingTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SavingTransactionController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'month_id' => 'required|string|exists:budgets,month_id',
            'type' => 'required|in:deposit,withdrawal',
            'category' => 'required|string',
            // Which pot this movement belongs to. Savings is the one place where
            // dollars and euros are different money rather than one figure read
            // twice, so the movement itself says which one it was saved in.
            'currency' => 'nullable|string|in:USD,EUR',
            'amount_usd' => 'required|numeric|min:0.01',
            'exchange_rate' => 'required|numeric|min:0',
            'timestamp' => 'nullable|integer',
        ]);

        $validated['category'] = Budget::normalizeSavingsPool($validated['category']) ?? $validated['category'];
        $validated['currency'] = Budget::normalizeCurrency($validated['currency'] ?? null);


        $validated['id'] = (string) Str::uuid();
        if (!isset($validated['timestamp'])) {
            $validated['timestamp'] = (int) (microtime(true) * 1000);
        }

        $validated['amount_bs'] = bcmul($validated['amount_usd'], $validated['exchange_rate'], 2);

        SavingTransaction::create($validated);

        return back();
    }

    public function update(Request $request, SavingTransaction $transaction)
    {
        $validated = $request->validate([
            'type' => 'required|in:deposit,withdrawal',
            'category' => 'required|string',
            'currency' => 'nullable|string|in:USD,EUR',
            'amount_usd' => 'required|numeric|min:0.01',
            'exchange_rate' => 'required|numeric|min:0',
            'timestamp' => 'required|integer',
        ]);

        $validated['category'] = Budget::normalizeSavingsPool($validated['category']) ?? $validated['category'];

        // Only when it was sent: an edit that omits the currency must not move a
        // euro movement into the dollar pot.
        if (array_key_exists('currency', $validated)) {
            $validated['currency'] = Budget::normalizeCurrency($validated['currency']);
        }


        $validated['amount_bs'] = bcmul($validated['amount_usd'], $validated['exchange_rate'], 2);

        $transaction->update($validated);

        return back();
    }

    public function destroy(SavingTransaction $transaction)
    {
        $transaction->delete();

        return back();
    }
}

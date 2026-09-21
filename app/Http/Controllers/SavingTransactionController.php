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
            'amount_usd' => 'required|numeric|min:0.01',
            'exchange_rate' => 'required|numeric|min:0',
            'timestamp' => 'nullable|integer',
        ]);

        $validated['category'] = Budget::normalizeSavingsPool($validated['category']) ?? $validated['category'];


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
            'amount_usd' => 'required|numeric|min:0.01',
            'exchange_rate' => 'required|numeric|min:0',
            'timestamp' => 'required|integer',
        ]);

        $validated['category'] = Budget::normalizeSavingsPool($validated['category']) ?? $validated['category'];


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

<?php

namespace App\Http\Controllers;

use App\Models\Debt;
use Illuminate\Http\Request;

class DebtController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'month_id' => 'required|string|exists:budgets,month_id',
            'label' => 'required|string',
            'opening_bs' => 'required|numeric|min:0',
            'payment_bs' => 'required|numeric|min:0',
        ]);

        $maxPosition = Debt::where('month_id', $validated['month_id'])
            ->max('position') ?: 0;

        $validated['position'] = $maxPosition + 1;

        $debt = Debt::create($validated);

        if ($validated['payment_bs'] > 0) {
            \App\Models\DebtPayment::create([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'debt_id' => $debt->id,
                'amount_bs' => $validated['payment_bs'],
                'method' => 'Inicial',
                'timestamp' => (int) (microtime(true) * 1000),
            ]);
        }

        return back();
    }

    public function update(Request $request, Debt $debt)
    {
        $validated = $request->validate([
            'label' => 'sometimes|required|string',
            'opening_bs' => 'sometimes|required|numeric|min:0',
            'payment_bs' => 'required|numeric|min:0',
            'additive_amount' => 'nullable|numeric|min:0',
            'additive_method' => 'nullable|string',
            'additive_timestamp' => 'nullable|numeric',
        ]);

        if (!empty($validated['additive_amount'])) {
            \App\Models\DebtPayment::create([
                'id' => (string) \Illuminate\Support\Str::uuid(),
                'debt_id' => $debt->id,
                'amount_bs' => $validated['additive_amount'],
                'method' => $validated['additive_method'] ?? 'Transferencia',
                'timestamp' => $validated['additive_timestamp'] ?? (int) (microtime(true) * 1000),
            ]);

            // Add the additive payment to the total payment_bs
            $validated['payment_bs'] = bcadd($debt->payment_bs, $validated['additive_amount'], 2);
        }

        $debt->update([
            'label' => $validated['label'] ?? $debt->label,
            'opening_bs' => $validated['opening_bs'] ?? $debt->opening_bs,
            'payment_bs' => $validated['payment_bs'],
        ]);

        return back();
    }

    public function destroyPayment(\App\Models\DebtPayment $payment)
    {
        // Subtract the payment amount from the total debt payment
        $debt = $payment->debt;
        $debt->payment_bs = bcsub($debt->payment_bs, $payment->amount_bs, 2);
        if (bccomp($debt->payment_bs, '0', 2) < 0) {
            $debt->payment_bs = '0';
        }
        $debt->save();

        $payment->delete();

        return back();
    }
}

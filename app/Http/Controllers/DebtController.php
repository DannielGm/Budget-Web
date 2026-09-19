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

        Debt::create($validated);

        return back();
    }

    public function update(Request $request, Debt $debt)
    {
        $validated = $request->validate([
            'label' => 'sometimes|required|string',
            'opening_bs' => 'sometimes|required|numeric|min:0',
            'payment_bs' => 'required|numeric|min:0',
        ]);

        $debt->update($validated);

        return back();
    }

    public function destroy(Debt $debt)
    {
        $debt->delete();

        return back();
    }
}

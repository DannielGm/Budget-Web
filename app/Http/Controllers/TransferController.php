<?php

namespace App\Http\Controllers;

use App\Models\Transfer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TransferController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'month_id' => 'required|string|exists:budgets,month_id',
            'source_type' => 'required|string',
            'source_id' => 'nullable|string',
            'destination_type' => 'required|string',
            'destination_id' => 'nullable|string',
            'amount_bs' => 'required|numeric|min:0.01',
            'amount_usd' => 'nullable|numeric|min:0',
            'rate' => 'nullable|numeric|min:0',
            'timestamp' => 'required|numeric',
            'note' => 'nullable|string',
        ]);

        $validated['id'] = (string) Str::uuid();

        Transfer::create($validated);

        return back();
    }
}

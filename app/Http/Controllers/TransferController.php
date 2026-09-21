<?php

namespace App\Http\Controllers;

use App\Models\Budget;
use App\Models\Transfer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TransferController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'month_id' => 'required|string|exists:budgets,month_id',
            'source_type' => 'required|in:cash,saving,external',
            'source_id' => 'nullable|required_if:source_type,saving|string',
            'destination_type' => 'required|in:cash,saving,external',
            'destination_id' => 'nullable|required_if:destination_type,saving|string',
            'amount_bs' => 'nullable|numeric|min:0',
            'amount_usd' => 'required|numeric|min:0.01',
            'timestamp' => 'required|numeric',
            'note' => 'nullable|string',
        ]);

        if ($validated['source_type'] === 'external' && $validated['destination_type'] === 'external') {
            throw ValidationException::withMessages(['destination_id' => 'Una transferencia debe tener un origen o destino real.']);
        }
        if ($validated['source_type'] === $validated['destination_type']
            && in_array($validated['source_type'], ['cash', 'external'], true)) {
            throw ValidationException::withMessages(['destination_id' => 'El origen y el destino no pueden ser el mismo.']);
        }
        if (! is_numeric($validated['amount_bs'])) {
            $validated['amount_bs'] = 0;
        }
        $validated['id'] = (string) Str::uuid();

        // The savings pools don't follow a single official rate: derive the
        // effective rate from the two entered amounts instead of using BCV.
        $validated['rate'] = (float) $validated['amount_usd'] > 0
            ? bcdiv($validated['amount_bs'], $validated['amount_usd'], 2)
            : 0;

        // Cash legs carry no pool id.
        if ($validated['source_type'] !== 'saving') {
            $validated['source_id'] = null;
        } else {
            $validated['source_id'] = Budget::normalizeSavingsPool($validated['source_id']);
        }
        if ($validated['destination_type'] !== 'saving') {
            $validated['destination_id'] = null;
        } else {
            $validated['destination_id'] = Budget::normalizeSavingsPool($validated['destination_id']);
        }

        Transfer::create($validated);

        return back();
    }
    public function update(Request $request, Transfer $transfer)
    {
        $validated = $request->validate([
            'source_type' => 'required|in:cash,saving,external',
            'source_id' => 'nullable|required_if:source_type,saving|string',
            'destination_type' => 'required|in:cash,saving,external',
            'destination_id' => 'nullable|required_if:destination_type,saving|string',
            'amount_bs' => 'nullable|numeric|min:0',
            'amount_usd' => 'required|numeric|min:0.01',
            'timestamp' => 'required|numeric',
            'note' => 'nullable|string',
        ]);
        if ($validated['source_type'] === 'external' && $validated['destination_type'] === 'external') {
            throw ValidationException::withMessages(['destination_id' => 'Una transferencia debe tener un origen o destino real.']);
        }
        if ($validated['source_type'] === $validated['destination_type']
            && in_array($validated['source_type'], ['cash', 'external'], true)) {
            throw ValidationException::withMessages(['destination_id' => 'El origen y el destino no pueden ser el mismo.']);
        }

        if (! is_numeric($validated['amount_bs'])) {
            $validated['amount_bs'] = 0;
        }

        $validated['rate'] = (float) $validated['amount_usd'] > 0
            ? bcdiv($validated['amount_bs'], $validated['amount_usd'], 2) : 0;

        if ($validated['source_type'] !== 'saving') {
            $validated['source_id'] = null;
        } else {
            $validated['source_id'] = Budget::normalizeSavingsPool($validated['source_id']);
        }
        if ($validated['destination_type'] !== 'saving') {
            $validated['destination_id'] = null;
        } else {
            $validated['destination_id'] = Budget::normalizeSavingsPool($validated['destination_id']);
        }

        $transfer->update($validated);

        return back();
    }

    public function destroy(Transfer $transfer)
    {
        $transfer->delete();

        return back();
    }


}

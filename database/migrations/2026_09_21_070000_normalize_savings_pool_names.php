<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** Legacy/Spanish pool spellings mapped to the canonical names. */
    private const MAP = ['Banco' => 'Bank', 'Físico' => 'Physical', 'Binance' => 'Digital'];

    public function up(): void
    {
        foreach (self::MAP as $from => $to) {
            DB::table('savings_transactions')->where('category', $from)->update(['category' => $to]);

            // Only the savings leg carries a pool id.
            DB::table('transfers')->where('source_type', 'saving')->where('source_id', $from)->update(['source_id' => $to]);
            DB::table('transfers')->where('destination_type', 'saving')->where('destination_id', $from)->update(['destination_id' => $to]);
        }
    }

    public function down(): void
    {
        foreach (self::MAP as $from => $to) {
            DB::table('savings_transactions')->where('category', $to)->update(['category' => $from]);
            DB::table('transfers')->where('source_type', 'saving')->where('source_id', $to)->update(['source_id' => $from]);
            DB::table('transfers')->where('destination_type', 'saving')->where('destination_id', $to)->update(['destination_id' => $from]);
        }
    }
};

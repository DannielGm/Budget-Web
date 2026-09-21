<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('savings_transactions')->where('category', 'Binance')->update(['category' => 'Digital']);
        DB::table('transfers')->where('source_id', 'Binance')->update(['source_id' => 'Digital']);
        DB::table('transfers')->where('destination_id', 'Binance')->update(['destination_id' => 'Digital']);
    }

    public function down(): void
    {
        DB::table('savings_transactions')->where('category', 'Digital')->update(['category' => 'Binance']);
        DB::table('transfers')->where('source_id', 'Digital')->update(['source_id' => 'Binance']);
        DB::table('transfers')->where('destination_id', 'Digital')->update(['destination_id' => 'Binance']);
    }
};


<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Exchange rates become currency-scoped.
 *
 * The table was keyed by date alone, which only works while there is a single
 * series. The euro series is stored alongside the dollar one, so the key is now
 * (date_iso, currency) and every existing row is explicitly USD: they were only
 * ever dollars, and relabelling them is what keeps the archive intact without a
 * re-fetch.
 *
 * The column is kept named rate_bs_per_usd rather than being renamed, because
 * it means "bolivares per unit of this currency" for both rows and renaming it
 * would mean rewriting the model, the service and the tests for no gain.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exchange_rates', function (Blueprint $table) {
            $table->string('currency')->default('USD')->after('date_iso');
            $table->index('currency');
        });

        // Every pre-existing row is USD. Explicit, so a later EUR fetch cannot
        // collide with a dollar date by accident.
        DB::table('exchange_rates')->update(['currency' => 'USD']);

        // A fresh install gets a composite key. On SQLite the original primary
        // key is rebuilt by dropping the index that declared it.
        Schema::table('exchange_rates', function (Blueprint $table) {
            $table->dropPrimary();
            $table->primary(['date_iso', 'currency'], 'exchange_rates_date_currency_primary');
        });
    }

    public function down(): void
    {
        // The euro series cannot be represented by the old key, so going back
        // keeps the dollars and discards the euros.
        DB::table('exchange_rates')->where('currency', '!=', 'USD')->delete();

        Schema::table('exchange_rates', function (Blueprint $table) {
            $table->dropIndex('exchange_rates_date_currency_primary');
            $table->dropIndex(['currency']);
            $table->dropColumn('currency');
            $table->primary('date_iso');
        });
    }
};

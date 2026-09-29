<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Savings movements carry the currency they were made in.
     *
     * Every savings row the app has ever written was in dollars, so there was
     * nothing to record; a euro pot needs the marking to exist. The default is
     * not a guess at what old rows meant: a dollar is exactly what they were.
     *
     * The column sits beside `amount_usd`, which holds the amount IN this
     * currency and is named for history. Renaming it would be the honest
     * follow-up but not a free one: BackupService restores with
     * `Arr::only($row, Schema::getColumnListing($table))`, so every backup
     * already on a device would lose its amount and the row would be dropped.
     */
    public function up(): void
    {
        Schema::table('savings_transactions', function (Blueprint $table) {
            $table->string('currency', 3)->default('USD');
        });

        Schema::table('transfers', function (Blueprint $table) {
            // Only read on a saving leg; a transfer between two cash accounts
            // carries the default and nobody looks at it.
            $table->string('currency', 3)->default('USD');
        });
    }

    public function down(): void
    {
        Schema::table('savings_transactions', function (Blueprint $table) {
            $table->dropColumn('currency');
        });

        Schema::table('transfers', function (Blueprint $table) {
            $table->dropColumn('currency');
        });
    }
};
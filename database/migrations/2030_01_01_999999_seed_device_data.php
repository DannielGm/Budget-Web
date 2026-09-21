<?php

use Database\Seeders\FakeBudgetSeeder;
use Illuminate\Database\Migrations\Migration;

/**
 * NativePHP never runs `db:seed` on the device, so ship the demo dataset
 * as a guarded migration: it runs exactly once (when the budgets table is
 * empty) during the migration batch and is a no-op thereafter.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Don't run the seeder if we're in the middle of PHPUnit tests
        // to prevent unique constraint violations on month_id.
        if (app()->runningUnitTests()) {
            return;
        }

        if (app('db')->table('budgets')->exists()) {
            return;
        }

        // Invoke the seeder directly — avoids a nested Artisan call whose
        // output handling is unreliable inside a migration on SQLite.
        (new FakeBudgetSeeder)->run();
    }

    public function down(): void
    {
        // The budgets FK cascade cleans up dependent rows; no-op here.
    }
};

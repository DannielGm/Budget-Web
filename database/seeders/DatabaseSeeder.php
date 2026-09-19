<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            // Demo dataset (4 months of fake data) used by the mobile builds.
            // BudgetSeeder still imports the private September dataset on demand:
            // `php artisan db:seed --class=BudgetSeeder`.
            FakeBudgetSeeder::class,
        ]);
    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('savings_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('month_id');
            $table->enum('type', ['deposit', 'withdrawal']); // Equivalent to buy/sell
            $table->string('category'); // Binance, Bank, Physical
            $table->decimal('amount_usd', 20, 2);
            $table->decimal('exchange_rate', 20, 2);
            $table->decimal('amount_bs', 20, 2);
            $table->bigInteger('timestamp');
            $table->timestamps();

            $table->foreign('month_id')->references('month_id')->on('budgets')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('savings_transactions');
    }
};

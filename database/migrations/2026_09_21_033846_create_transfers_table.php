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
        Schema::create('transfers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('month_id');
            $table->foreign('month_id')->references('month_id')->on('budgets')->onDelete('cascade');

            $table->string('source_type');
            $table->string('source_id')->nullable(); // e.g. "Bank", "Cash", or a specific Saving pool ID

            $table->string('destination_type');
            $table->string('destination_id')->nullable(); // e.g. "Binance", "DebtPayment", or an Expense Category name

            $table->decimal('amount_bs', 20, 2);
            $table->decimal('amount_usd', 20, 2)->default(0);
            $table->decimal('rate', 20, 2)->default(0);

            $table->bigInteger('timestamp');
            $table->text('note')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transfers');
    }
};

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
        Schema::create('debts', function (Blueprint $table) {
            $table->id();
            $table->string('month_id');
            $table->string('label');
            $table->string('opening_bs');
            $table->string('payment_bs');
            $table->integer('position');
            $table->timestamps();

            $table->foreign('month_id')->references('month_id')->on('budgets')->onDelete('cascade');
            $table->unique(['month_id', 'label']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('debts');
    }
};

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
        Schema::create('expenses', function (Blueprint $table) {
            $table->string('id')->primary(); // UUID
            $table->string('month_id');
            $table->string('category_name');
            $table->string('label');
            $table->string('amount_bs');
            $table->string('rate');
            $table->unsignedBigInteger('timestamp');
            $table->integer('position');
            $table->timestamps();

            $table->foreign('month_id')->references('month_id')->on('budgets')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};

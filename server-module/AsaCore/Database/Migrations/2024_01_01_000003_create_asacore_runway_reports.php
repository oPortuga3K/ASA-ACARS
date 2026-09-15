<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asacore_runway_reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index();
            $table->string('pirep_id', 64)->nullable()->index();
            $table->string('airport_icao', 10);
            $table->decimal('touchdown_lat', 10, 7);
            $table->decimal('touchdown_lon', 10, 7);
            $table->float('heading_true_deg')->nullable();
            $table->integer('landing_rate_fpm')->nullable();
            $table->float('groundspeed_kt')->nullable();
            $table->string('aircraft_icao', 10)->nullable();
            $table->string('simulator', 20)->nullable();
            $table->string('client_version', 20)->nullable();
            $table->string('status', 20)->default('pending')->comment('pending|reviewed|added|rejected');
            $table->text('admin_notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asacore_runway_reports');
    }
};
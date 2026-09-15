<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asacore_pirep_extra', function (Blueprint $table) {
            $table->id();
            $table->string('pirep_id', 64)->unique()->index();
            // Landing data
            $table->integer('landing_rate_fpm')->nullable()->comment('Vertical speed at touchdown ft/min (negative=descent)');
            $table->float('g_force')->nullable();
            $table->float('g_force_max')->nullable();
            $table->float('pitch_deg')->nullable();
            $table->float('bank_deg')->nullable();
            $table->float('groundspeed_kt')->nullable();
            $table->float('indicated_airspeed_kt')->nullable();
            $table->float('sideslip_deg')->nullable();
            $table->string('crosswind_side', 10)->nullable();
            // Runway match
            $table->string('touchdown_airport_icao', 10)->nullable();
            $table->string('runway_ident', 10)->nullable();
            $table->string('runway_surface', 50)->nullable();
            $table->integer('runway_length_ft')->nullable();
            $table->float('centerline_distance_m')->nullable();
            $table->string('centerline_side', 10)->nullable();
            $table->integer('touchdown_distance_from_threshold_ft')->nullable();
            $table->float('glideslope_angle_deg')->nullable();
            $table->string('runway_navdata_source', 30)->nullable();
            // Approach / gates
            $table->string('approach_runway', 10)->nullable();
            $table->string('dep_gate', 30)->nullable();
            $table->string('arr_gate', 30)->nullable();
            // Scoring
            $table->float('score_vs')->nullable();
            $table->float('score_g')->nullable();
            $table->float('score_centerline')->nullable();
            $table->float('score_total')->nullable();
            $table->string('score_label', 20)->nullable()->comment('smooth|firm|hard|severe');
            // Flight events
            $table->unsignedTinyInteger('touch_and_go_count')->default(0);
            $table->unsignedTinyInteger('go_around_count')->default(0);
            // Divert
            $table->boolean('was_diverted')->default(false);
            $table->string('divert_reason', 30)->nullable();
            $table->string('actual_arr_icao', 10)->nullable();
            // Accident detection
            $table->boolean('accident_detected')->default(false);
            $table->string('accident_kind', 30)->nullable();
            $table->string('accident_confidence', 10)->nullable();
            // Client metadata
            $table->string('client_version', 20)->nullable();
            $table->string('simulator', 20)->nullable()->comment('Msfs2020|Msfs2024|XPlane11|XPlane12');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asacore_pirep_extra');
    }
};
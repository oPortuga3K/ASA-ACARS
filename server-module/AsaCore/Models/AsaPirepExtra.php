<?php

namespace Modules\AsaCore\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Pirep;

class AsaPirepExtra extends Model
{
    protected $table = 'asacore_pirep_extra';

    protected $fillable = [
        'pirep_id', 'landing_rate_fpm', 'g_force', 'g_force_max',
        'pitch_deg', 'bank_deg', 'groundspeed_kt', 'indicated_airspeed_kt',
        'sideslip_deg', 'crosswind_side', 'touchdown_airport_icao',
        'runway_ident', 'runway_surface', 'runway_length_ft',
        'centerline_distance_m', 'centerline_side',
        'touchdown_distance_from_threshold_ft', 'glideslope_angle_deg',
        'runway_navdata_source', 'approach_runway', 'dep_gate', 'arr_gate',
        'score_vs', 'score_g', 'score_centerline', 'score_total', 'score_label',
        'touch_and_go_count', 'go_around_count', 'was_diverted',
        'divert_reason', 'actual_arr_icao', 'accident_detected',
        'accident_kind', 'accident_confidence', 'client_version', 'simulator',
    ];

    protected $casts = [
        'landing_rate_fpm' => 'integer',
        'g_force' => 'float', 'g_force_max' => 'float',
        'pitch_deg' => 'float', 'bank_deg' => 'float',
        'groundspeed_kt' => 'float', 'indicated_airspeed_kt' => 'float',
        'sideslip_deg' => 'float', 'runway_length_ft' => 'integer',
        'centerline_distance_m' => 'float',
        'touchdown_distance_from_threshold_ft' => 'integer',
        'glideslope_angle_deg' => 'float',
        'score_vs' => 'float', 'score_g' => 'float',
        'score_centerline' => 'float', 'score_total' => 'float',
        'touch_and_go_count' => 'integer', 'go_around_count' => 'integer',
        'was_diverted' => 'boolean', 'accident_detected' => 'boolean',
    ];

    public function pirep(): BelongsTo
    {
        return $this->belongsTo(Pirep::class, 'pirep_id', 'id');
    }

    public static function labelFromScore(?float $score): ?string
    {
        if ($score === null) return null;
        if ($score >= 85) return 'smooth';
        if ($score >= 65) return 'firm';
        if ($score >= 40) return 'hard';
        return 'severe';
    }
}
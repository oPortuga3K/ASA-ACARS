<?php

namespace Modules\AsaCore\Models;

use Illuminate\Database\Eloquent\Model;

class AsaRunwayReport extends Model
{
    protected $table = 'asacore_runway_reports';

    protected $fillable = [
        'user_id', 'pirep_id', 'airport_icao', 'touchdown_lat', 'touchdown_lon',
        'heading_true_deg', 'landing_rate_fpm', 'groundspeed_kt',
        'aircraft_icao', 'simulator', 'client_version', 'status', 'admin_notes',
    ];

    protected $casts = [
        'touchdown_lat' => 'float', 'touchdown_lon' => 'float',
        'heading_true_deg' => 'float', 'landing_rate_fpm' => 'integer',
        'groundspeed_kt' => 'float',
    ];
}
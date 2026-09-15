<?php

namespace Modules\AsaCore\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Modules\AsaCore\Models\AsaRunwayReport;
use Illuminate\Http\JsonResponse;

class RunwayController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if (!config('asacore.features.runway_crowdsource', true)) {
            return response()->json(['message' => 'Runway crowdsourcing is disabled.'], 403);
        }

        $request->validate([
            'airport_icao' => 'required|string|max:10',
            'touchdown_lat' => 'required|numeric',
            'touchdown_lon' => 'required|numeric',
        ]);

        $report = AsaRunwayReport::create([
            'user_id' => Auth::id(),
            'pirep_id' => $request->input('pirep_id'),
            'airport_icao' => $request->input('airport_icao'),
            'touchdown_lat' => $request->input('touchdown_lat'),
            'touchdown_lon' => $request->input('touchdown_lon'),
            'heading_true_deg' => $request->input('heading_true_deg'),
            'landing_rate_fpm' => $request->input('landing_rate_fpm'),
            'groundspeed_kt' => $request->input('groundspeed_kt'),
            'aircraft_icao' => $request->input('aircraft_icao'),
            'simulator' => $request->input('simulator'),
            'client_version' => $request->input('client_version'),
            'status' => 'pending',
        ]);

        return response()->json(['message' => 'Runway report submitted.', 'report_id' => $report->id]);
    }
}
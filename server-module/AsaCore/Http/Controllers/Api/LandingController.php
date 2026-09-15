<?php

namespace Modules\AsaCore\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use App\Models\Pirep;
use Modules\AsaCore\Models\AsaPirepExtra;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class LandingController extends Controller
{
    public function store(Request $request, $id): JsonResponse
    {
        $pirep = Pirep::where('id', $id)
            ->where('user_id', Auth::id())
            ->first();

        if (!$pirep) {
            return response()->json(['message' => 'PIREP not found or not owned by user.'], 404);
        }

        $windowHours = config('asacore.landing_submit_window_hours', 48);
        if ($pirep->created_at->diffInHours(Carbon::now()) > $windowHours) {
            return response()->json(['message' => 'PIREP is too old to accept landing data.'], 422);
        }

        $extra = AsaPirepExtra::firstOrNew(['pirep_id' => $id]);
        $extra->fill([
            'landing_rate_fpm' => $request->input('landing_rate_fpm'),
            'g_force' => $request->input('g_force'),
            'g_force_max' => $request->input('g_force_max'),
            'pitch_deg' => $request->input('pitch_deg'),
            'bank_deg' => $request->input('bank_deg'),
            'groundspeed_kt' => $request->input('groundspeed_kt'),
            'indicated_airspeed_kt' => $request->input('indicated_airspeed_kt'),
            'sideslip_deg' => $request->input('sideslip_deg'),
            'crosswind_side' => $request->input('crosswind_side'),
            'touchdown_airport_icao' => $request->input('touchdown_airport_icao'),
            'runway_ident' => $request->input('runway_ident'),
            'runway_surface' => $request->input('runway_surface'),
            'runway_length_ft' => $request->input('runway_length_ft'),
            'centerline_distance_m' => $request->input('centerline_distance_m'),
            'centerline_side' => $request->input('centerline_side'),
            'touchdown_distance_from_threshold_ft' => $request->input('touchdown_distance_from_threshold_ft'),
            'glideslope_angle_deg' => $request->input('glideslope_angle_deg'),
            'runway_navdata_source' => $request->input('runway_navdata_source'),
            'approach_runway' => $request->input('approach_runway'),
            'dep_gate' => $request->input('dep_gate'),
            'arr_gate' => $request->input('arr_gate'),
            'score_vs' => $request->input('score_vs'),
            'score_g' => $request->input('score_g'),
            'score_centerline' => $request->input('score_centerline'),
            'score_total' => $request->input('score_total'),
            'score_label' => AsaPirepExtra::labelFromScore($request->input('score_total')),
            'touch_and_go_count' => $request->input('touch_and_go_count', 0),
            'go_around_count' => $request->input('go_around_count', 0),
            'was_diverted' => $request->input('was_diverted', false),
            'divert_reason' => $request->input('divert_reason'),
            'actual_arr_icao' => $request->input('actual_arr_icao'),
            'accident_detected' => $request->input('accident_detected', false),
            'accident_kind' => $request->input('accident_kind'),
            'accident_confidence' => $request->input('accident_confidence'),
            'client_version' => $request->input('client_version'),
            'simulator' => $request->input('simulator'),
        ]);
        $extra->save();

        return response()->json(['message' => 'Landing data saved.', 'extra' => $extra]);
    }
}
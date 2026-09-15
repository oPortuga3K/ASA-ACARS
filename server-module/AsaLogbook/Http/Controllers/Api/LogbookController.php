<?php

namespace Modules\AsaLogbook\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use App\Models\Pirep;
use App\Models\Acars;
use Modules\AsaCore\Models\AsaPirepExtra;
use Illuminate\Http\JsonResponse;

class LogbookController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $user = Auth::user();

        $distance_nm = Pirep::where('user_id', $user->id)->sum('distance');

        $avg_landing_fpm = Pirep::where('user_id', $user->id)
            ->join('asacore_pirep_extra', 'pireps.id', '=', 'asacore_pirep_extra.pirep_id')
            ->avg('asacore_pirep_extra.landing_rate_fpm');

        $flights_this_month = Pirep::where('user_id', $user->id)
            ->whereMonth('created_at', date('m'))
            ->whereYear('created_at', date('Y'))
            ->count();

        $hours_this_year = Pirep::where('user_id', $user->id)
            ->whereYear('created_at', date('Y'))
            ->sum('flight_time');

        $rank = $user->rank;

        return response()->json([
            'total_flights' => $user->flights,
            'hours_flown' => round($user->flight_time / 60, 1),
            'distance_nm' => $distance_nm,
            'avg_landing_fpm' => $avg_landing_fpm ? round($avg_landing_fpm) : null,
            'rank' => $rank ? $rank->name : '',
            'rank_image' => $rank ? $rank->image_url : '',
            'flights_this_month' => $flights_this_month,
            'hours_this_year' => round($hours_this_year / 60, 1),
        ]);
    }

    public function pireps(Request $request): JsonResponse
    {
        $limit = min((int) $request->input('limit', 25), 100);
        $offset = (int) $request->input('offset', 0);
        $user = Auth::user();

        $query = Pirep::with(['airline', 'aircraft'])
            ->leftJoin('asacore_pirep_extra', 'pireps.id', '=', 'asacore_pirep_extra.pirep_id')
            ->select(
                'pireps.*',
                'asacore_pirep_extra.landing_rate_fpm as extra_landing_rate',
                'asacore_pirep_extra.score_total',
                'asacore_pirep_extra.score_label'
            )
            ->where('pireps.user_id', $user->id)
            ->orderBy('pireps.created_at', 'desc');

        $total = $query->count();
        $pireps = $query->skip($offset)->take($limit)->get();

        $items = $pireps->map(function ($p) {
            return [
                'id' => $p->id,
                'date' => $p->created_at->toIso8601String(),
                'dep_icao' => $p->dpt_airport_id,
                'arr_icao' => $p->arr_airport_id,
                'callsign' => ($p->airline ? $p->airline->icao : '') . $p->flight_number,
                'aircraft_icao' => $p->aircraft ? $p->aircraft->icao : '',
                'aircraft_reg' => $p->aircraft ? $p->aircraft->registration : '',
                'status' => $p->state_name ?? 'ACCEPTED',
                'duration_min' => $p->flight_time,
                'distance_nm' => $p->distance,
                'landing_rate_fpm' => $p->extra_landing_rate ?? $p->landing_rate,
                'score_total' => $p->score_total,
                'score_label' => $p->score_label,
            ];
        });

        return response()->json([
            'items' => $items,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    public function pirep(Request $request, $id): JsonResponse
    {
        $user = Auth::user();

        $p = Pirep::with(['airline', 'aircraft'])
            ->leftJoin('asacore_pirep_extra', 'pireps.id', '=', 'asacore_pirep_extra.pirep_id')
            ->select('pireps.*',
                'asacore_pirep_extra.landing_rate_fpm as extra_landing_rate',
                'asacore_pirep_extra.g_force',
                'asacore_pirep_extra.g_force_max',
                'asacore_pirep_extra.pitch_deg',
                'asacore_pirep_extra.bank_deg',
                'asacore_pirep_extra.groundspeed_kt',
                'asacore_pirep_extra.sideslip_deg',
                'asacore_pirep_extra.crosswind_side',
                'asacore_pirep_extra.touchdown_airport_icao',
                'asacore_pirep_extra.runway_ident',
                'asacore_pirep_extra.runway_surface',
                'asacore_pirep_extra.runway_length_ft',
                'asacore_pirep_extra.centerline_distance_m',
                'asacore_pirep_extra.centerline_side',
                'asacore_pirep_extra.touchdown_distance_from_threshold_ft',
                'asacore_pirep_extra.glideslope_angle_deg',
                'asacore_pirep_extra.approach_runway',
                'asacore_pirep_extra.dep_gate',
                'asacore_pirep_extra.arr_gate',
                'asacore_pirep_extra.score_vs',
                'asacore_pirep_extra.score_g',
                'asacore_pirep_extra.score_centerline',
                'asacore_pirep_extra.score_total',
                'asacore_pirep_extra.score_label',
                'asacore_pirep_extra.touch_and_go_count',
                'asacore_pirep_extra.go_around_count',
                'asacore_pirep_extra.was_diverted',
                'asacore_pirep_extra.divert_reason',
                'asacore_pirep_extra.actual_arr_icao',
                'asacore_pirep_extra.accident_detected',
                'asacore_pirep_extra.accident_kind',
                'asacore_pirep_extra.accident_confidence',
                'asacore_pirep_extra.client_version',
                'asacore_pirep_extra.simulator'
            )
            ->where('pireps.user_id', $user->id)
            ->where('pireps.id', $id)
            ->firstOrFail();

        $item = [
            'id' => $p->id,
            'date' => $p->created_at->toIso8601String(),
            'dep_icao' => $p->dpt_airport_id,
            'arr_icao' => $p->arr_airport_id,
            'callsign' => ($p->airline ? $p->airline->icao : '') . $p->flight_number,
            'aircraft_icao' => $p->aircraft ? $p->aircraft->icao : '',
            'aircraft_reg' => $p->aircraft ? $p->aircraft->registration : '',
            'status' => $p->state_name ?? 'ACCEPTED',
            'duration_min' => $p->flight_time,
            'distance_nm' => $p->distance,
            'landing_rate_fpm' => $p->extra_landing_rate ?? $p->landing_rate,
            'g_force' => $p->g_force,
            'g_force_max' => $p->g_force_max,
            'pitch_deg' => $p->pitch_deg,
            'bank_deg' => $p->bank_deg,
            'groundspeed_kt' => $p->groundspeed_kt,
            'sideslip_deg' => $p->sideslip_deg,
            'crosswind_side' => $p->crosswind_side,
            'touchdown_airport_icao' => $p->touchdown_airport_icao,
            'runway_ident' => $p->runway_ident,
            'runway_surface' => $p->runway_surface,
            'runway_length_ft' => $p->runway_length_ft,
            'centerline_distance_m' => $p->centerline_distance_m,
            'centerline_side' => $p->centerline_side,
            'touchdown_distance_from_threshold_ft' => $p->touchdown_distance_from_threshold_ft,
            'glideslope_angle_deg' => $p->glideslope_angle_deg,
            'approach_runway' => $p->approach_runway,
            'dep_gate' => $p->dep_gate,
            'arr_gate' => $p->arr_gate,
            'score_vs' => $p->score_vs,
            'score_g' => $p->score_g,
            'score_centerline' => $p->score_centerline,
            'score_total' => $p->score_total,
            'score_label' => $p->score_label,
            'touch_and_go_count' => $p->touch_and_go_count,
            'go_around_count' => $p->go_around_count,
            'was_diverted' => $p->was_diverted,
            'divert_reason' => $p->divert_reason,
            'actual_arr_icao' => $p->actual_arr_icao,
            'accident_detected' => $p->accident_detected,
            'accident_kind' => $p->accident_kind,
            'accident_confidence' => $p->accident_confidence,
            'client_version' => $p->client_version,
            'simulator' => $p->simulator,
        ];

        $acars = Acars::where('pirep_id', $id)->orderBy('created_at', 'asc')->get();
        $item['route'] = $acars->map(fn($a) => [
            'lat' => $a->lat,
            'lon' => $a->lon,
            'alt_ft' => $a->alt ?? 0,
            'gs_kt' => $a->gs ?? 0,
        ]);
        $item['log'] = [];

        return response()->json($item);
    }
}
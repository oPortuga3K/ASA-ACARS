<?php

namespace Modules\AsaVATraffic\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Models\Pirep;
use App\Models\Enums\PirepState;
use Illuminate\Http\JsonResponse;

class TrafficController extends Controller
{
    public function live(Request $request): JsonResponse
    {
        $pireps = Pirep::with(['user', 'airline', 'aircraft', 'position'])
            ->where('state', PirepState::IN_PROGRESS)
            ->get();

        $traffic = $pireps->map(function ($p) {
            $pos = $p->position;
            return [
                'pirep_id' => $p->id,
                'pilot_id' => $p->user_id,
                'pilot_name' => $p->user ? $p->user->name : 'Unknown',
                'callsign' => ($p->airline ? $p->airline->icao : '') . $p->flight_number,
                'dep_icao' => $p->dpt_airport_id,
                'arr_icao' => $p->arr_airport_id,
                'aircraft_icao' => $p->aircraft ? $p->aircraft->icao : 'UNK',
                'aircraft_reg' => $p->aircraft ? $p->aircraft->registration : 'UNK',
                'lat' => $pos ? $pos->lat : 0,
                'lon' => $pos ? $pos->lon : 0,
                'alt_ft' => $pos ? $pos->alt : 0,
                'hdg' => $pos ? $pos->heading : 0,
                'gs_kt' => $pos ? $pos->gs : 0,
                'phase' => $pos ? $pos->status : 'Boarding',
                'updated_at' => $p->updated_at->toIso8601String(),
            ];
        });

        return response()->json([
            'traffic' => $traffic,
            'count' => $traffic->count(),
            'ts' => now()->toIso8601String(),
        ]);
    }

    public function pilot(Request $request, $id): JsonResponse
    {
        $pirep = Pirep::with(['user', 'airline', 'aircraft', 'position', 'dpt_airport', 'arr_airport'])
            ->where('state', PirepState::IN_PROGRESS)
            ->where('user_id', $id)
            ->first();

        if (!$pirep) {
            return response()->json(['message' => 'Pilot not active or not found'], 404);
        }

        $pos = $pirep->position;

        return response()->json([
            'pirep_id' => $pirep->id,
            'pilot_id' => $pirep->user_id,
            'pilot_name' => $pirep->user ? $pirep->user->name : 'Unknown',
            'callsign' => ($pirep->airline ? $pirep->airline->icao : '') . $pirep->flight_number,
            'dep_icao' => $pirep->dpt_airport_id,
            'dep_name' => $pirep->dpt_airport ? $pirep->dpt_airport->name : '',
            'arr_icao' => $pirep->arr_airport_id,
            'arr_name' => $pirep->arr_airport ? $pirep->arr_airport->name : '',
            'route' => $pirep->route,
            'aircraft_icao' => $pirep->aircraft ? $pirep->aircraft->icao : 'UNK',
            'aircraft_reg' => $pirep->aircraft ? $pirep->aircraft->registration : 'UNK',
            'lat' => $pos ? $pos->lat : 0,
            'lon' => $pos ? $pos->lon : 0,
            'alt_ft' => $pos ? $pos->alt : 0,
            'hdg' => $pos ? $pos->heading : 0,
            'gs_kt' => $pos ? $pos->gs : 0,
            'phase' => $pos ? $pos->status : 'Boarding',
            'planned_distance' => $pirep->planned_distance,
            'updated_at' => $pirep->updated_at->toIso8601String(),
        ]);
    }
}
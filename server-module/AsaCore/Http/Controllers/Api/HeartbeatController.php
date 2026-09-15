<?php

namespace Modules\AsaCore\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use App\Models\Pirep;
use Illuminate\Http\JsonResponse;

class HeartbeatController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate(['pirep_id' => 'required|string']);

        $pirep = Pirep::where('id', $request->input('pirep_id'))
            ->where('user_id', Auth::id())
            ->first();

        if (!$pirep) {
            return response()->json(['message' => 'PIREP not found or not owned by user.'], 404);
        }

        $pirep->touch();
        return response()->json(['message' => 'Heartbeat received.', 'ts' => now()->toIso8601String()]);
    }
}
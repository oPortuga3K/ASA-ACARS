<?php

namespace Modules\AsaCore\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\AsaCore\Models\AsaClientVersion;
use Illuminate\Http\JsonResponse;

class ConfigController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $platform = $request->query('platform', 'windows');
        $versionInfo = AsaClientVersion::where('platform', $platform)->first();

        return response()->json([
            'module_version' => config('asacore.module_version'),
            'features' => config('asacore.features'),
            'client_version' => [
                'min' => $versionInfo ? $versionInfo->min_version : config('asacore.min_client_version'),
                'recommended' => $versionInfo ? $versionInfo->recommended_version : config('asacore.min_client_version'),
                'download_url' => $versionInfo ? $versionInfo->download_url : null,
                'release_notes' => $versionInfo ? $versionInfo->release_notes : null,
            ]
        ]);
    }

    public function version(): JsonResponse
    {
        return response()->json([
            'module' => 'AsaCore',
            'version' => config('asacore.module_version'),
            'va' => 'Atlantic Star Airways',
        ]);
    }
}
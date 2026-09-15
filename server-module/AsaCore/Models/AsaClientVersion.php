<?php

namespace Modules\AsaCore\Models;

use Illuminate\Database\Eloquent\Model;

class AsaClientVersion extends Model
{
    protected $table = 'asacore_client_versions';

    protected $fillable = [
        'platform', 'min_version', 'recommended_version',
        'download_url', 'release_notes',
    ];

    public static function isOutdated(string $version, string $minimum): bool
    {
        return version_compare($version, $minimum, '<');
    }
}
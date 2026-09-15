<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asacore_client_versions', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 20)->unique()->comment('windows|macos|linux');
            $table->string('min_version', 20);
            $table->string('recommended_version', 20);
            $table->string('download_url', 512)->nullable();
            $table->text('release_notes')->nullable();
            $table->timestamps();
        });

        DB::table('asacore_client_versions')->insert([
            ['platform' => 'windows', 'min_version' => '1.7.0', 'recommended_version' => '1.7.15',
             'download_url' => 'https://atlanticstarairways.com/acars/download',
             'release_notes' => null, 'created_at' => now(), 'updated_at' => now()],
            ['platform' => 'macos',   'min_version' => '1.7.0', 'recommended_version' => '1.7.15',
             'download_url' => 'https://atlanticstarairways.com/acars/download',
             'release_notes' => null, 'created_at' => now(), 'updated_at' => now()],
            ['platform' => 'linux',   'min_version' => '1.7.0', 'recommended_version' => '1.7.15',
             'download_url' => 'https://atlanticstarairways.com/acars/download',
             'release_notes' => null, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('asacore_client_versions');
    }
};
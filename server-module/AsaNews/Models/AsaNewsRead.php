<?php

namespace Modules\AsaNews\Models;

use Illuminate\Database\Eloquent\Model;

class AsaNewsRead extends Model
{
    protected $table = 'asanews_read';
    protected $fillable = ['user_id', 'news_id'];
}
<?php

namespace Modules\AsaNews\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use App\Models\News;
use Modules\AsaNews\Models\AsaNewsRead;
use Illuminate\Http\JsonResponse;

class NewsController extends Controller
{
    public function unreadCount(Request $request): JsonResponse
    {
        $userId = Auth::id();
        $totalNews = News::count();
        $readNews = AsaNewsRead::where('user_id', $userId)->count();
        $unread = max(0, $totalNews - $readNews);
        return response()->json(['unread_count' => $unread]);
    }

    public function markRead(Request $request): JsonResponse
    {
        $request->validate(['ids' => 'required|array', 'ids.*' => 'integer']);
        $userId = Auth::id();
        foreach ($request->input('ids') as $newsId) {
            AsaNewsRead::firstOrCreate(['user_id' => $userId, 'news_id' => $newsId]);
        }
        return response()->json(['message' => 'News marked as read']);
    }

    public function list(Request $request): JsonResponse
    {
        $userId = Auth::id();
        $limit = min((int) $request->input('limit', 20), 50);
        $offset = (int) $request->input('offset', 0);

        $readIds = AsaNewsRead::where('user_id', $userId)->pluck('news_id');
        $news = News::orderBy('created_at', 'desc')->skip($offset)->take($limit)->get();

        $items = $news->map(fn($n) => [
            'id' => $n->id,
            'title' => $n->title,
            'body' => $n->body,
            'created_at' => $n->created_at->toIso8601String(),
            'read' => $readIds->contains($n->id),
        ]);

        return response()->json(['items' => $items, 'total' => News::count()]);
    }
}
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ChatService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ChatController extends Controller
{
    public function __construct(private readonly ChatService $chat)
    {
    }

    public function store(Request $request): Response
    {
        $riwayat = $request->input('riwayat', []);
        if (! is_array($riwayat)) {
            $riwayat = [];
        }

        return $this->chat->balas((string) $request->input('pesan', ''), $riwayat);
    }
}

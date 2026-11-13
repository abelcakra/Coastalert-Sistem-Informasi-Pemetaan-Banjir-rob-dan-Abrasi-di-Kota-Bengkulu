<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CoastAlert data sources
    |--------------------------------------------------------------------------
    |
    | These files are copied from the legacy project without modifying their
    | contents. The boundary is checked in WGS84 (EPSG:4326), while the GEA
    | source rasters retain their original EPSG:32748 metadata.
    |
    */

    'boundary_path' => env('BATAS_KOTA_PATH', storage_path('app/geo/batas_kota_bengkulu.geojson')),
    'gea_stats_path' => env('GEA_STATS_PATH', storage_path('app/gea/gea-stats.json')),
    'upload_dir' => public_path('uploads'),
    'max_photo_kb' => 5120,
    'max_import_kb' => 10240,

    /*
    |--------------------------------------------------------------------------
    | Admin authentication
    |--------------------------------------------------------------------------
    */

    'admin_password' => env('ADMIN_PASSWORD', ''),
    'admin_password_hash' => env('ADMIN_PASSWORD_HASH', ''),
    'admin_token_ttl_minutes' => (int) env('ADMIN_TOKEN_TTL_MINUTES', 480),

    /*
    |--------------------------------------------------------------------------
    | Ollama chatbot
    |--------------------------------------------------------------------------
    */

    'ollama_url' => rtrim(env('OLLAMA_URL', 'http://localhost:11434'), '/'),
    'ollama_model' => env('OLLAMA_MODEL', 'qwen2.5:7b'),
    'ollama_timeout' => (int) env('OLLAMA_TIMEOUT', 120),
    'ollama_status_timeout' => (int) env('OLLAMA_STATUS_TIMEOUT', 5),
    'ollama_num_ctx' => (int) env('OLLAMA_NUM_CTX', 16384),
    'ollama_num_predict' => (int) env('OLLAMA_NUM_PREDICT', 512),
    'ollama_temperature' => (float) env('OLLAMA_TEMPERATURE', 0.3),
    'chat_max_message' => 2000,
    'chat_max_history' => 8,

];

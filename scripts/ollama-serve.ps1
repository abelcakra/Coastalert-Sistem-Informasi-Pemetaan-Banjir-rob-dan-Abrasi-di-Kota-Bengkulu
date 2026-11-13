param(
    [string]$ModelsPath = $(if ($env:OLLAMA_MODELS) { $env:OLLAMA_MODELS } else { 'D:\OllamaModels' }),
    [string]$Model = $(if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { 'qwen2.5:7b' }),
    [int]$Port = 11434
)

$ErrorActionPreference = 'Stop'

function Cari-Ollama {
    if ($env:OLLAMA_EXE -and (Test-Path $env:OLLAMA_EXE)) {
        return $env:OLLAMA_EXE
    }

    $dariPath = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if ($dariPath) {
        return $dariPath.Source
    }

    $kandidat = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'),
        'D:\Ollama\ollama.exe'
    )

    foreach ($berkas in $kandidat) {
        if ($berkas -and (Test-Path $berkas)) {
            return $berkas
        }
    }

    return $null
}

function Baca-Tags {
    try {
        return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/tags" -TimeoutSec 2
    } catch {
        return $null
    }
}

$exe = Cari-Ollama
if (-not $exe) {
    throw 'ollama.exe tidak ditemukan. Pasang Ollama atau atur variabel OLLAMA_EXE.'
}

if (-not (Test-Path $ModelsPath)) {
    New-Item -ItemType Directory -Path $ModelsPath -Force | Out-Null
}

$tags = Baca-Tags
if ($tags) {
    Write-Host "Server Ollama sudah berjalan di http://127.0.0.1:$Port."
} else {
    $env:OLLAMA_MODELS = $ModelsPath
    Write-Host "Menjalankan Ollama dengan folder model: $ModelsPath"

    Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden

    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        $tags = Baca-Tags
        if ($tags) {
            break
        }
    }

    if (-not $tags) {
        throw "Server Ollama tidak merespons di http://127.0.0.1:$Port setelah 30 detik."
    }
}

$modelTerpasang = @($tags.models | ForEach-Object { $_.name })
Write-Host "Model terpasang: $($modelTerpasang -join ', ')"

$target = if ($Model -match ':') { $Model } else { "$Model:latest" }
if ($modelTerpasang -notcontains $target) {
    Write-Warning "Model '$Model' belum terpasang."
    Write-Host "Unduh model dengan: $exe pull $Model"
    exit 2
}

Write-Host "Model '$Model' siap digunakan."

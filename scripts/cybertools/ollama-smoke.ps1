param(
    [ValidateSet('local', 'cloud')]
    [string]$Target = 'cloud'
)

$ErrorActionPreference = 'Stop'

if ($Target -eq 'local') {
    $result = Invoke-RestMethod -Method Get -Uri 'http://localhost:11434/api/tags' -TimeoutSec 20
    $count = @($result.models).Count
    Write-Host "Local Ollama reachable. Models: $count"
    exit 0
}

if ([string]::IsNullOrWhiteSpace($env:OLLAMA_API_KEY)) {
    throw 'OLLAMA_API_KEY is required for Ollama Cloud smoke testing.'
}

$headers = @{ Authorization = "Bearer $($env:OLLAMA_API_KEY)" }
$result = Invoke-RestMethod -Method Get -Uri 'https://ollama.com/api/tags' -Headers $headers -TimeoutSec 20
$count = @($result.models).Count
Write-Host "Ollama Cloud reachable. Models: $count"

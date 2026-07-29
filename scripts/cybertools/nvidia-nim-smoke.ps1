param(
    [string]$BaseUrl = $env:NVIDIA_BASE_URL,
    [string]$Model = $env:NVIDIA_DEFAULT_MODEL,
    [switch]$ListModels
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = 'https://integrate.api.nvidia.com/v1'
}

if ([string]::IsNullOrWhiteSpace($env:NVIDIA_API_KEY)) {
    throw 'NVIDIA_API_KEY is required for NVIDIA NIM smoke testing.'
}

$headers = @{
    Authorization = "Bearer $($env:NVIDIA_API_KEY)"
    'Content-Type' = 'application/json'
}

$modelsUrl = "$BaseUrl/models"
$models = Invoke-RestMethod -Method Get -Uri $modelsUrl -Headers $headers -TimeoutSec 45
$modelIds = @($models.data | ForEach-Object { $_.id } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

if ($modelIds.Count -eq 0) {
    throw "NVIDIA NIM reachable at $BaseUrl, but no model ids were returned."
}

if ($ListModels) {
    Write-Host "NVIDIA NIM reachable. Models returned: $($modelIds.Count)"
    $modelIds | Select-Object -First 50
    exit 0
}

if ([string]::IsNullOrWhiteSpace($Model)) {
    $preferred = @(
        'nvidia/llama-3.1-nemotron-ultra-253b-v1',
        'meta/llama-3.1-405b-instruct',
        'meta/llama-3.1-70b-instruct'
    )
    $Model = @($preferred | Where-Object { $modelIds -contains $_ } | Select-Object -First 1)
    if ([string]::IsNullOrWhiteSpace($Model)) {
        $Model = $modelIds[0]
    }
}

$body = @{
    model = $Model
    messages = @(
        @{
            role = 'user'
            content = 'Reply with exactly: CyberTools NVIDIA NIM OK'
        }
    )
    max_tokens = 32
    temperature = 0
} | ConvertTo-Json -Depth 8

$chatUrl = "$BaseUrl/chat/completions"
$chat = Invoke-RestMethod -Method Post -Uri $chatUrl -Headers $headers -Body $body -TimeoutSec 60
$reply = $chat.choices[0].message.content

Write-Host "NVIDIA NIM reachable. Models returned: $($modelIds.Count)"
Write-Host "Test model: $Model"
Write-Host "Reply: $reply"

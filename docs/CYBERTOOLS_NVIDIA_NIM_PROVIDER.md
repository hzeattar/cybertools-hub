# CyberTools NVIDIA NIM Provider

This document defines the safe NVIDIA NIM rollout for CyberTools Web, Desktop IDE, and Mobile.

## Current State

- NVIDIA NIM is configured as an OpenAI-compatible custom endpoint in `librechat.yaml`.
- The default base URL is `https://integrate.api.nvidia.com/v1`.
- API keys must be stored only in Railway/local secrets.
- Mobile and Desktop must call CyberTools/LibreChat or ask the user for local credentials; they must not embed the NVIDIA key.

## Required Variables

Set these in Railway or local `.env` only:

```env
NVIDIA_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_DEFAULT_MODEL=meta/llama-3.1-70b-instruct
```

Do not commit values for any API key. Rotate any key that was pasted into chat, screenshots, issues, or logs.

## Smoke Test

From PowerShell:

```powershell
$env:NVIDIA_API_KEY = Read-Host 'NVIDIA API key'
$env:NVIDIA_BASE_URL='https://integrate.api.nvidia.com/v1'
$env:NVIDIA_DEFAULT_MODEL='meta/llama-3.1-70b-instruct'
.\scripts\cybertools\nvidia-nim-smoke.ps1
```

The smoke test checks `/models` and sends a tiny `/chat/completions` request.

## LibreChat Rollout

1. Set `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, and `NVIDIA_DEFAULT_MODEL` in Railway variables.
2. Deploy LibreChat from main.
3. Smoke test `/readyz`, login, chat, model selection, and file/RAG flows.
4. Keep paid providers available but move them behind explicit user choice later.

## File Upload Note

NVIDIA NIM fixes model/provider availability for chat, but LibreChat file upload still depends on LibreChat file handling, RAG API, storage, and selected endpoint capabilities. If upload fails before the model receives content, debug upload/RAG separately.

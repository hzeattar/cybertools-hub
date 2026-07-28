# CyberTools Ollama Provider

This document defines the safe Ollama rollout for CyberTools Web, Desktop IDE, and Mobile.

## Current State

- LibreChat remains the web product and account/chat/RAG backend.
- RAG API stays a separate internal Railway service.
- Desktop flagship moves to the PearAI-based `CyberTools IDE` repository.
- Mobile remains a Capacitor wrapper over the web product.
- Ollama is introduced as a server-side provider foundation, not as a client-embedded secret.

## Required Variables

Set these in Railway or local `.env` only:

```env
OLLAMA_API_KEY=
OLLAMA_BASE_URL=https://ollama.com/api
CYBERTOOLS_OPENAI_COMPAT_BASE_URL=
CYBERTOOLS_OPENAI_COMPAT_API_KEY=
CYBERTOOLS_DEFAULT_MODEL=
```

Do not commit values for any API key. Rotate any key that was pasted into chat, screenshots, issues, or logs.

## LibreChat Rollout

The `CyberTools Ollama` block in `librechat.yaml` is commented out by default. To enable it later:

1. Rotate and set `OLLAMA_API_KEY` in Railway variables.
2. Set `CYBERTOOLS_DEFAULT_MODEL` after model discovery succeeds.
3. Review and uncomment the `CyberTools Ollama` custom endpoint.
4. Deploy to staging first.
5. Smoke test login, chat, RAG, and model selection.
6. Promote to production only after staging passes.

## Mobile Rule

The APK must not contain `OLLAMA_API_KEY` or any model provider secret. Mobile calls the CyberTools web/backend only.

## Desktop Rule

CyberTools IDE can use local Ollama at `http://localhost:11434/v1` without a secret. Ollama Cloud keys must be local environment variables or OS credential storage, not files committed to the repo.

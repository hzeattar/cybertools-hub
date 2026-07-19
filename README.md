# CyberTools Hub

CyberTools Hub is a Next.js security tools platform with account-based USDT TRC20 checkout, paid digital downloads, and a defensive multi-provider Cyber AI Analyst.

## What Is Included

- Free browser-first security tools with SEO pages.
- Account registration and login with HttpOnly signed sessions.
- User-owned orders, signed downloads, and entitlement tracking.
- Admin manual approval for USDT deposits that need human review.
- Built-in support inbox surfaced inside `/admin`.
- AI Pro Pass for 30-day higher Cyber AI limits.
- Claude-style CyberTools AI Workspace with conversations, many agents, provider picker, text attachments, exports, user-approved memory, keyword RAG, and provider route telemetry.
- Cyber AI provider routing: AgentRouter, OpenRouter, Groq, Gemini, Mistral, Anthropic, OpenAI, custom OpenAI-compatible endpoints, Ollama, Pollinations Free Cloud, then local defensive fallback.
- TRONSCAN-backed USDT TRC20 payment verification.
- Postgres-ready production storage and local JSON dev storage.
- Dark professional security interface.

## Local Setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Local development works without Postgres. JSON data is stored under `.data/`, which is ignored by git. In production, set `DATABASE_URL` and `STORAGE_DRIVER=postgres`.

## Required Production Variables

Set these on Railway:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
TRON_RECEIVER_ADDRESS=TBGVxoH2Sc6MVHmMtjRsAUZitTQxGEUZUG
TRONSCAN_API_KEY=replace_with_rotated_tronscan_key
TRONSCAN_API_BASE=https://apilist.tronscanapi.com
USDT_TRC20_CONTRACT=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
DATABASE_URL=${{Postgres.DATABASE_URL}}
STORAGE_DRIVER=postgres
SESSION_SECRET=replace_with_random_32_byte_secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace_with_long_admin_password
DOWNLOAD_SECRET=replace_with_random_32_byte_secret
ORDER_HMAC_SECRET=replace_with_random_32_byte_secret
AI_PROVIDER_ORDER=agentrouter,openrouter,groq,gemini,mistral,anthropic,openai,custom,ollama,pollinations,local
AI_LOCAL_FALLBACK=enabled
AGENTROUTER_API_KEY=replace_with_agentrouter_key
AGENTROUTER_BASE_URL=https://agentrouter.org/v1
AGENTROUTER_MODEL=gpt-5
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=openrouter/free
GROQ_API_KEY=
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant
GEMINI_API_KEY=
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
GEMINI_MODEL=gemini-2.0-flash
MISTRAL_API_KEY=
MISTRAL_BASE_URL=https://api.mistral.ai/v1
MISTRAL_MODEL=mistral-small-latest
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
ANTHROPIC_MODEL=claude-3-5-haiku-latest
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
AI_CUSTOM_LABEL=
AI_CUSTOM_API_KEY=
AI_CUSTOM_BASE_URL=
AI_CUSTOM_MODEL=
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=
OLLAMA_MODEL=llama3.1
OLLAMA_API_KEY=
POLLINATIONS_ENABLED=enabled
POLLINATIONS_BASE_URL=https://text.pollinations.ai/openai
POLLINATIONS_MODEL=gpt-oss-20b
POLLINATIONS_API_KEY=
POLLINATIONS_REFERRER=
POLLINATIONS_PRIVATE=true
AI_FREE_DAILY_LIMIT=20
AI_PRO_DAILY_LIMIT=100
```

Rotate shared API keys before production. TRONSCAN and AI provider keys must remain server-side environment variables.

## Auth And Entitlements

- `/register`, `/login`, `/logout`, `/account`, and `/account/orders` manage user access.
- `POST /api/orders` requires login and attaches the order to the current user.
- Digital products create permanent product entitlements after payment.
- `AI Pro Pass - 30 Days` creates a 30-day `ai_pro` entitlement.
- `/admin` is not linked in the public navigation and requires an admin session.
- If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set, the first admin account is bootstrapped automatically.

## Payment Verification

Each order gets a 45-minute payment window and a unique expected USDT amount. The verification route checks:

- receiver wallet matches `TRON_RECEIVER_ADDRESS`
- token contract matches USDT TRC20
- amount exactly matches the order amount
- transfer timestamp is after order creation
- transaction hash has not been used before
- current user owns the order

Development-only mock verification:

```bash
POST /api/orders/{orderId}/verify?mock=paid
```

This shortcut is disabled when `NODE_ENV=production`.

Admins can manually approve a pending or expired order from `/admin` after checking the external wallet or exchange
evidence. Manual approval creates the same account entitlement as automated TRONSCAN verification.

## Cyber AI Workspace

`/assistant/cyber-ai` requires login and provides a full chat workspace with conversation history, agent selection, provider selection, text file attach, Markdown export, approved memory, and local knowledge retrieval.

- Free users: `AI_FREE_DAILY_LIMIT`, default 20 requests/day.
- AI Pro users: `AI_PRO_DAILY_LIMIT`, default 100 requests/day.
- Conversations are stored for the signed-in account. Reusable memory is only created after the user approves a memory suggestion.
- The first RAG layer uses approved memories plus built-in defensive knowledge with keyword scoring, so it does not require pgvector or embedding API costs.
- The server-side safety layer refuses malware, phishing, credential theft, persistence, harmful automation, and unauthorized exploitation requests.
- The provider chain is controlled by `AI_PROVIDER_ORDER`. Pollinations Free Cloud is enabled by default as a no-key external model fallback. Its adapter first tries Chat Completions, then the direct text endpoint, before falling back to offline local guidance. If every external provider fails or is not configured, `local` returns deterministic guidance instead of a broken 502 page.
- AgentRouter is configured as `https://agentrouter.org/v1` with model `gpt-5` by default. Override any provider model or base URL through environment variables.
- The workspace supports these built-in agents: General Assistant, Security Analyst, Code Reviewer, Software Engineer, AppSec Architect, Scope Guard, Report Writer, Threat Modeler, API Risk Mapper, Bug Bounty Coach, Cloud Hardening, Incident Responder, Privacy Reviewer, DevOps SRE, and Knowledge Curator.

Workspace APIs:

- `GET/POST /api/ai/conversations`
- `GET/POST /api/ai/conversations/{id}/messages`
- `GET /api/ai/memories`
- `POST /api/ai/memories/{id}/approve`
- `POST /api/ai/memories/{id}/delete`
- `POST /api/ai/cyber-security` remains available as a compatibility endpoint.

## Railway Notes

The repository includes `railway.json`, `nixpacks.toml`, `npm run start`, and `/api/health`. Add a Postgres database on Railway, set the variables above, and the app creates required tables automatically.

## Verification

```bash
npm run verify
npm run smoke
```

`npm run verify` runs TypeScript checks, Node tests, and a production build. `npm run smoke` runs Playwright against a local dev server.

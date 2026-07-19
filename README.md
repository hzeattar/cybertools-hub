# CyberTools Hub

CyberTools Hub is a Next.js security tools platform with account-based USDT TRC20 checkout, paid digital downloads, and a defensive Cyber AI Analyst powered by AgentRouter.

## What Is Included

- Free browser-first security tools with SEO pages.
- Account registration and login with HttpOnly signed sessions.
- User-owned orders, signed downloads, and entitlement tracking.
- AI Pro Pass for 30-day higher Cyber AI limits.
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
AGENTROUTER_API_KEY=replace_with_agentrouter_key
AGENTROUTER_BASE_URL=https://co.agentrouter.org/v1
AGENTROUTER_MODEL=gpt-5.5
AI_FREE_DAILY_LIMIT=20
AI_PRO_DAILY_LIMIT=100
```

Rotate shared API keys before production. Both TRONSCAN and AgentRouter keys must remain server-side environment variables.

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

## Cyber AI Analyst

`/assistant/cyber-ai` requires login before calling `POST /api/ai/cyber-security`.

- Free users: `AI_FREE_DAILY_LIMIT`, default 20 requests/day.
- AI Pro users: `AI_PRO_DAILY_LIMIT`, default 100 requests/day.
- Prompts are not stored by CyberTools Hub; only daily usage counters are stored.
- The server-side safety layer refuses malware, phishing, credential theft, persistence, harmful automation, and unauthorized exploitation requests.

## Railway Notes

The repository includes `railway.json`, `nixpacks.toml`, `npm run start`, and `/api/health`. Add a Postgres database on Railway, set the variables above, and the app creates required tables automatically.

## Verification

```bash
npm run verify
npm run smoke
```

`npm run verify` runs TypeScript checks, Node tests, and a production build. `npm run smoke` runs Playwright against a local dev server.

# CyberTools Hub

CyberTools Hub is a Next.js security tools platform with a small digital-product store and USDT TRC20 checkout.

## What is included

- 14 free browser-first security tools.
- SEO pages for each tool, product, and guide.
- Bug bounty report builder and scope guard.
- USDT TRC20 checkout with unique order amounts.
- TRONSCAN-backed payment verification through a server route.
- Signed download tokens for paid products.
- Local JSON storage for development and Postgres-ready storage for Railway.

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The local checkout works without a database. Orders are stored in `.data/orders.json`, which is ignored by git. Postgres is used automatically in production when `DATABASE_URL` is present, or locally when `STORAGE_DRIVER=postgres`.

## Required production variables

Set these on Railway:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example
TRON_RECEIVER_ADDRESS=TBGVxoH2Sc6MVHmMtjRsAUZitTQxGEUZUG
TRONSCAN_API_KEY=replace_with_rotated_tronscan_key
TRONSCAN_API_BASE=https://apilist.tronscanapi.com
USDT_TRC20_CONTRACT=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t
DATABASE_URL=postgresql://user:password@host:5432/db
STORAGE_DRIVER=postgres
ADMIN_PASSWORD=replace_with_long_admin_password
DOWNLOAD_SECRET=replace_with_random_32_byte_secret
ORDER_HMAC_SECRET=replace_with_random_32_byte_secret
```

Rotate the TRONSCAN API key before production because the original key was shared during planning.

## Payment verification

Each order gets a 45-minute payment window and a unique expected USDT amount. The verification route checks:

- receiver wallet matches `TRON_RECEIVER_ADDRESS`
- token contract matches USDT TRC20
- amount exactly matches the order amount
- transfer timestamp is after order creation
- transaction hash has not been used before

Development-only mock verification:

```bash
POST /api/orders/{orderId}/verify?mock=paid
```

This shortcut is disabled when `NODE_ENV=production`.

## Railway notes

The repository includes `railway.json` with `npm run start` and `/api/health`. Add a Postgres database on Railway, set `DATABASE_URL`, and the app will create the order tables automatically.

## Verification

```bash
npm run lint
npm run test
npm run build
```

The test suite uses Node's built-in test runner to avoid heavy local dependencies. It covers unique amount generation and TRONSCAN response parsing.

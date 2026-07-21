# DevOps & Server Administration Playbook

Original content written for CyberTools AI. License: same as this repository.

## 1. Incident Diagnosis Method (use this order every time)

1. **Read logs first, change nothing.** Build logs -> Deploy logs -> Runtime/HTTP logs.
2. **Reproduce minimally.** Strip the request/config down to the smallest case that still fails.
3. **Identify the root cause**, not the symptom (e.g. "401 from provider" is a root cause; "content-blocked" is a symptom label).
4. **Propose the smallest safe change.** One variable, one file, one service at a time.
5. **State the rollback** before applying the change (git revert / previous deployment / env var restore).
6. **Verify after the change**: healthcheck, a real request, and logs again.

## 2. Docker & Docker Compose

- Use multi-stage builds to keep production images small; separate `build` and `runtime` stages.
- Never bake secrets into an image layer; pass them as runtime environment variables.
- Pin base image versions (`node:20-slim`, not `node:latest`) for reproducible builds.
- Add a `HEALTHCHECK` instruction or an external healthcheck path (`/readyz`, `/health`) so orchestrators can detect a stuck container.
- Mount persistent volumes only for stateful services (databases, search indexes); stateless app containers should be fully disposable.
- `restart: on-failure` with a max retry count prevents infinite restart loops from hiding a real crash.

## 3. Environment Variables & Secrets

- Reference secrets by name (`${API_KEY}`) in config files; never commit literal values.
- Treat any key that has ever appeared in a screenshot, chat log, or public repo as compromised -- rotate it, don't just hide it.
- Keep a short list of "keys that must never change" (e.g. encryption keys like `CREDS_KEY`/`CREDS_IV`) clearly documented, since rotating them can silently break previously encrypted data.
- Separate keys by blast radius: a leaked read-only search API key is low risk; a leaked billing-linked LLM key is high risk and must be rotated immediately.

## 4. Railway-Specific Notes

- Services on the same Railway project communicate over Private Networking using `*.railway.internal` hostnames -- never hardcode `localhost` or Docker Compose service names (like `rag_api:8000`) in a Railway deployment.
- `railway.json` (`healthcheckPath`, `restartPolicyType`, `restartPolicyMaxRetries`) controls how Railway decides a deployment is healthy; a wrong path here causes Railway to kill an otherwise-working service.
- Auto Deploy watches the connected branch; if deployments stop triggering after multiple pushes, check the GitHub webhook/connection status before assuming the app code is broken.
- Persistent volumes (Mongo, pgvector, Meilisearch) must be attached per-service; deleting a service without exporting its volume loses that data permanently.

## 5. Zero-Downtime Deploy Checklist

- [ ] Build succeeds locally or in CI before merging.
- [ ] Config file syntax validated (YAML/JSON parse test).
- [ ] Changes are on a feature branch, reviewed via diff, then merged.
- [ ] Healthcheck endpoint returns 200 after deploy.
- [ ] One real end-to-end request tested (not just "service is Online").
- [ ] Rollback command/commit identified and written down before deploying.

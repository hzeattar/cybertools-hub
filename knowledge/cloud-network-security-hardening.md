# Cloud & Network Security Hardening Guide

Original content written for CyberTools AI. License: same as this repository.

## Network Segmentation

- Separate public-facing services (web/API) from internal data stores (databases, caches) using private networking; never expose a database directly to the internet.
- Use least-privilege firewall/security-group rules: allow only the specific ports and source ranges required, not broad `0.0.0.0/0` rules on internal ports.
- Prefer private-network service-to-service communication (e.g. Railway's `*.railway.internal`, AWS VPC private subnets) over public URLs for backend-to-backend calls.

## Identity & Access Management

- Use role-based access control (RBAC) mapped to job function, not per-person ad-hoc permissions.
- Rotate long-lived credentials (API keys, service-account secrets) on a schedule; prefer short-lived tokens (OIDC/STS) where the platform supports them.
- Enforce MFA on all accounts with administrative or billing access without exception.
- Audit permissions periodically; remove access for departed staff and unused service accounts immediately, not "eventually."

## Data Protection

- Encrypt data at rest (managed database encryption, encrypted volumes) and in transit (TLS everywhere, including internal service calls where feasible).
- Classify data sensitivity (public, internal, confidential, regulated) and apply controls proportional to classification -- not a single blanket policy for everything.
- Maintain tested backups with a defined retention policy; periodically test actual restoration, not just backup completion.

## API Security

- Authenticate every API endpoint; "unlisted"/undocumented endpoints are not a security control.
- Rate-limit and monitor for abuse (credential stuffing, scraping, data exfiltration via pagination abuse).
- Validate and constrain all input server-side regardless of client-side validation.
- Version APIs deliberately; do not silently change behavior on a shared endpoint that could break security assumptions in client integrations.

## Monitoring & Observability for Security

- Centralize logs from all services (application, infrastructure, network) so correlation across sources is possible during an investigation.
- Alert on security-relevant events specifically (auth failures, permission changes, new admin accounts, unusual data volume) -- not just uptime/performance metrics.
- Set a log retention period long enough to investigate incidents that are discovered weeks after the fact (breaches are often detected late).

## Secure Defaults Checklist

- [ ] Databases and internal services are not publicly reachable.
- [ ] All admin/billing accounts have MFA enabled.
- [ ] Secrets are stored in a secret manager or environment variables, never in code.
- [ ] TLS is enforced (no plaintext HTTP) for any endpoint handling credentials or personal data.
- [ ] Backups exist and have been test-restored at least once.
- [ ] A named person/team owns incident response and knows how to reach the rest of the plan.

# CyberTools Agent Memory Ledger

A dependency-free reference implementation for permission-aware agent memory and execution traces.

## Current scope

- Four memory classes: working, episodic, semantic, and procedural.
- Mandatory user and project scope on every record.
- Secret redaction before memory or run data is accepted.
- Working-memory TTL, expiry, purge, deduplication, pinning, correction, soft deletion, and hard deletion.
- Lexical retrieval with kind and tag filters.
- Immutable agent-run records with intent, agent, skills, tools, outcome, provider, model, latency, cost, retries, feedback, and errors.
- Scope export and an explainable audit trail.

## Safety boundaries

This package has no database, network listener, background worker, model call, LibreChat integration, or automatic memory write. It is deliberately outside the root npm workspaces, so Railway production builds remain unchanged.

Persistent storage adapters, vector retrieval, user review UI, and LibreChat integration require separate gates and feature flags.

## Validation

```bash
cd apps/agent-memory-ledger
npm run check
npm test
```

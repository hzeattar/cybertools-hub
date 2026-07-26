# CyberTools Model Policy Router

A dependency-free routing-policy foundation for reducing cloud-model usage without silently changing provider, price, privacy, or security behavior.

## Current scope

- Local intent and capability classification in Arabic and English.
- Explicit local, free, and premium provider tiers.
- Provider health and quota state.
- Capability, context-size, data-class, and local-file policy checks.
- Premium providers require explicit opt-in.
- Local file content cannot leave the device unless cloud file access is explicitly approved.
- Restricted data remains local unless a future policy explicitly defines another trusted destination.
- Bounded fallbacks and a trace explaining every accepted or rejected provider.
- User/project/source-state isolated result cache with expiry.

## Safety boundaries

This package does not call models, inspect environment variables, contain provider keys, change LibreChat endpoints, or perform automatic fallback. It is outside the root npm workspaces, so Railway production behavior remains unchanged.

Provider adapters, local model servers, UI controls, and production routing require separate feature-flagged gates.

## Validation

```bash
cd apps/model-policy-router
npm run check
npm test
```

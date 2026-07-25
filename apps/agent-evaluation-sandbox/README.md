# CyberTools Agent Evaluation Sandbox

A dependency-free offline evaluation foundation for improving agents, prompts, and skills without allowing uncontrolled self-modification of production.

## Current scope

- Versioned, content-addressed evaluation datasets.
- Versioned candidates with an explicit base version and creator.
- Replayable case results with quality, safety, latency, cost, violations, output, and trace references.
- Threshold-based blocking for quality, safety, latency, cost, and regression.
- Baseline/candidate comparison.
- Scope isolation by owner and project.
- Secret redaction from candidates, outputs, and metadata.
- Human approvals and manual staging-promotion plans.

## Safety boundaries

This package does not call models, train models, modify prompts or skills, change Git branches, deploy code, or promote anything automatically. A passing report only becomes eligible for human approval; it never changes Production.

The package is outside root npm workspaces, so Railway behavior remains unchanged.

## Validation

```bash
cd apps/agent-evaluation-sandbox
npm run check
npm test
```

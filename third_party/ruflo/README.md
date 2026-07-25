# Ruflo Agent Skills Import

This project imports the Agent Skills stored under `.agents/skills` in the public Ruflo repository.

- Upstream: `ruvnet/ruflo`
- Upstream path: `.agents/skills`
- Pinned commit: `26c35b59b40a0a95b286ccf5ac675a15edcc995f`
- License: MIT; see `LICENSE` in this directory.
- Import destination inside the production image: `/app/skill`
- LibreChat source type: deployment Skills (read-only)

## How it works

`Dockerfile` runs `scripts/import-ruflo-skills.mjs` before the application source is copied into the image. The importer:

1. Resolves the pinned Ruflo commit through the GitHub API.
2. Traverses only `.agents/skills` rather than cloning the complete Ruflo repository.
3. Downloads every `SKILL.md` package and its bundled files.
4. Rejects truncated trees, symbolic links, path traversal, invalid frontmatter, duplicate Skill names, oversized files, and unexpected repository growth.
5. Writes a `.ruflo-import-manifest.json` file containing the resolved commit and import counts.

The source is intentionally pinned instead of following Ruflo `main`, so an upstream change cannot silently alter the production assistant. Update `RUFLO_SKILLS_REF` in `Dockerfile` only after reviewing the upstream diff.

## Optional authenticated builds

The importer works with the public GitHub API without a token. A read-only token may be supplied as `RUFLO_GITHUB_TOKEN` if unauthenticated GitHub rate limits become a problem. Never commit that token to this repository.

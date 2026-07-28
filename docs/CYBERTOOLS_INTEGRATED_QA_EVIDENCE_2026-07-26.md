# CyberTools AI Integrated QA Evidence - 2026-07-26

## Scope

Validation branch: `qa/integrated-launch-validation`

Validated commit: `882fc030c75a33190dae0423d351f6bd649948be`

Production policy for this pass: no Railway variables changed, no production feature flags enabled.

## Production Web Smoke

Railway project: `ingenious-grace`

Environment: `production`

LibreChat service: `61d98cdd-950c-46f0-ac8e-b3ed7e071f3f`

Production URL: `https://librechat-production-bd64.up.railway.app`

Commands:

```powershell
railway status --project e07db025-5d35-4527-85e5-1e5c1eb8d3ca --environment production --json
curl.exe -I --max-time 60 https://librechat-production-bd64.up.railway.app/readyz
curl.exe -I --max-time 60 https://librechat-production-bd64.up.railway.app/
```

Result:

- LibreChat latest deployment: `efea747f-4956-4dd6-9d7a-f95738d51628`
- Deployment status: `SUCCESS`
- Instance status: `RUNNING`
- Commit deployed: `882fc030c75a33190dae0423d351f6bd649948be`
- `/readyz`: `HTTP/1.1 200 OK`
- `/`: `HTTP/1.1 200 OK`
- Rechecked on 2026-07-28: LibreChat deployment `efea747f-4956-4dd6-9d7a-f95738d51628` remained `SUCCESS/RUNNING`, `/readyz` returned `HTTP/1.1 200 OK`, and `/` returned `HTTP/1.1 200 OK`.

Not completed in this pass:

- Login/chat/RAG browser smoke requires the account owner to complete interactive login in the browser. No credentials were requested or used.

## Foundation Package Tests

### `apps/desktop-pairing-protocol`

Command:

```powershell
npm run check; npm test
```

Result: pass, 8 tests passed.

Coverage confirmed:

- Pairing verifier accepts only the original code.
- Desktop/client session key derivation.
- Client without code rejected.
- Tampering and replay rejected.
- Stale envelopes rejected.
- Capability escalation blocked.
- Non-loopback insecure web origins rejected.
- Expired pairing offers rejected.

### `apps/agent-memory-ledger`

Command:

```powershell
npm run check; npm test
```

Result: pass, 12 tests passed.

Coverage confirmed:

- Memory retrieval isolation by `userId/projectId`.
- Secret redaction across text, nested data, tool metadata, and errors.
- TTL purge.
- Deduplication.
- Correction supersession.
- Soft/hard delete.
- Export scoped to requested scope with audit trail.
- Mongo adapter redaction/isolation/export/delete.
- PGVector adapter requires approved embeddings and scoped search.
- Run ledger isolation.

### `apps/model-policy-router`

Command:

```powershell
npm run check; npm test
```

Result: pass, 9 tests passed.

Coverage confirmed:

- Simple requests prefer eligible local provider.
- Premium providers are not selected without explicit opt-in.
- Local file content cannot silently leave device.
- Restricted data remains local even when premium is enabled.
- Disabled or unknown providers are not selected.
- Routing cache is scoped and expires.

### `apps/agent-evaluation-sandbox`

Command:

```powershell
npm run check; npm test
```

Result: pass, 11 tests passed.

Coverage confirmed:

- Reproducible datasets and candidates.
- Human approval required.
- Safety, latency, cost, and regression blockers.
- Runner errors become failed reports.
- Scope isolation.
- Secret redaction.
- Offline run ledger records.
- Manual approval states never promote production automatically.

## Desktop Bridge Local Validation

Commands attempted:

```powershell
apps\desktop-bridge\validate-local.ps1
cargo check
cargo test
```

Observed:

- `validate-local.ps1` loaded Node.js 24.14.1, npm 11.11.0, Rust stable MSVC 1.97.1, and MSVC Build Tools.
- Frontend build completed during validation.
- `cargo fmt --check` completed during validation.
- Manual `cargo check` completed successfully using MSVC/Windows SDK environment.
- 2026-07-26: `cargo test` reached final link stage, then failed with `LINK : fatal error LNK1318: Unexpected PDB error; LIMIT (12)` while local disk was nearly full.
- 2026-07-28: after moving Rust caches/target output to `F:\cybertools-build-cache`, `cargo test` passed.
- 2026-07-28: `validate-local.ps1` passed using `RUSTUP_HOME=F:\cybertools-build-cache\rustup` and `CARGO_TARGET_DIR=F:\cybertools-build-cache\desktop-bridge-target`.
- 2026-07-28: `npm run tauri -- dev` built successfully and launched `cybertools-desktop-bridge.exe`.

Rust test result:

```text
running 7 tests
test tests::pairing_status_filters_expired_and_revoked_state ... ok
test tests::pairing_fingerprint_detects_tampering ... ok
test tests::rejects_pairing_capability_escalation ... ok
test tests::loopback_origin_only_blocks_public_confirmation ... ok
test tests::rejects_traversal_and_absolute_paths ... ok
test tests::resolves_files_inside_allowed_root ... ok
test tests::rejects_symlink_components_when_supported ... ok

test result: ok. 7 passed; 0 failed
```

Resolved environment blocker:

- 2026-07-26 disk space was too low: `C:` 3.62GB free, `F:` 1.12GB free.
- 2026-07-28 disk space was sufficient after cleanup: approximately `C:` 10.57GB free, `F:` 40.90GB free.
- Rust toolchain under `C:\Users\AM\.rustup` was incomplete; a working minimal stable MSVC toolchain was installed under `F:\cybertools-build-cache\rustup`.

Remaining Desktop UI limitation:

- Windows Computer Use automation failed before interaction with: `Package subpath './dist/project/cua/sky_js/src/targets/windows/internal/computer_use_client_base.js' is not defined by "exports"`.
- Because Windows UI automation was unavailable, the visible Tauri window could not be driven through the folder picker/read/search/revoke workflow in this pass.
- No `audit.jsonl` was created during the limited launch smoke because no Desktop Bridge UI action was executed.

Cleanup completed:

- Removed temporary Rust target directory: `C:\Users\AM\AppData\Local\Temp\cybertools-desktop-qa-target`.
- Removed untracked lockfiles generated by local test commands:
  - `apps/desktop-bridge/package-lock.json`
  - `apps/desktop-bridge/src-tauri/Cargo.lock`
- Stopped the Tauri dev server and `cybertools-desktop-bridge.exe` after launch smoke.

Installer status:

- `apps/desktop-bridge/src-tauri/tauri.conf.json` currently has `"bundle": { "active": false }`.
- This pass treated Desktop Bridge as dev/local only, not as a packaged installer.

## Local Web Full Feature Test

Required local flags:

```dotenv
CYBERTOOLS_DESKTOP_PAIRING_ENABLED=true
CYBERTOOLS_MEMORY_ENABLED=true
CYBERTOOLS_MEMORY_AUTO_WRITE=false
CYBERTOOLS_MODEL_ROUTER_DRY_RUN=true
CYBERTOOLS_EVALUATION_SANDBOX_ENABLED=true
```

Result: pass for build and feature-flag DOM smoke.

Commands:

```powershell
$env:npm_config_cache='F:\cybertools-build-cache\npm-cache'
npm ci --no-audit --no-fund

$env:CYBERTOOLS_DESKTOP_PAIRING_ENABLED='false'
$env:CYBERTOOLS_MEMORY_ENABLED='false'
$env:CYBERTOOLS_MEMORY_AUTO_WRITE='false'
$env:CYBERTOOLS_MODEL_ROUTER_DRY_RUN='false'
$env:CYBERTOOLS_EVALUATION_SANDBOX_ENABLED='false'
npm run frontend:ci
npm run build:client

$env:CYBERTOOLS_DESKTOP_PAIRING_ENABLED='true'
$env:CYBERTOOLS_MEMORY_ENABLED='true'
$env:CYBERTOOLS_MEMORY_AUTO_WRITE='false'
$env:CYBERTOOLS_MODEL_ROUTER_DRY_RUN='true'
$env:CYBERTOOLS_EVALUATION_SANDBOX_ENABLED='true'
npm run build:client
```

Observed:

- Initial `npm ci` attempt failed once with `ECONNRESET`; retry completed enough for builds to run.
- `npm run frontend:ci` with flags off passed.
- `npm run build:client` with flags on passed.
- `npm run build:client` with flags off passed.
- Production build emitted existing warnings about direct `eval`, large chunks, and PWA glob warnings, but exited successfully.

Feature-flag DOM smoke:

- Served `client/dist` with `npm run preview-prod -- --host 127.0.0.1 --port 4173`.
- Installed Playwright Chromium under `F:\cybertools-build-cache\ms-playwright`.
- Flags on: `Desktop pairing`, `Memory review`, and `Model router` were visible on `/login`.
- Flags off: all three panels were hidden.
- Static preview showed expected `502 Bad Gateway` console errors for backend API calls because no local LibreChat API/backend was running.

Evidence screenshots:

- `docs/qa-assets/cybertools-flags-on-preview-20260728.png`
- `docs/qa-assets/cybertools-flags-off-preview-20260728.png`

Confirmed local web constraints:

- No file upload or local file transfer was triggered.
- The model router remained dry-run UI only.
- `CYBERTOOLS_MEMORY_AUTO_WRITE=false` kept memory review manual only.
- Production flags were not changed.

## Current Release Readiness

Ready:

- Production service health smoke with flags off.
- Independent foundation package checks/tests.
- `cargo check`, `cargo test`, and `validate-local.ps1` for Desktop Bridge.
- Tauri dev launch smoke.
- Local LibreChat production builds with CyberTools flags on and off.
- Local DOM smoke confirming CyberTools panels appear only with flags on.

Not yet release-ready:

- Browser-authenticated production login/chat/RAG smoke.
- Full Desktop Bridge UI workflow through Windows controls because Computer Use automation failed.
- Desktop installer build and install/uninstall QA.

## Required Next Steps

1. Complete production login/chat/RAG smoke after the owner logs in interactively.
2. Complete manual Desktop Bridge UI smoke, or rerun it after Computer Use is fixed:

```powershell
apps\desktop-bridge\validate-local.ps1
npm run tauri -- dev
```

3. Desktop UI workflow still to execute:

- Choose allowed folder.
- List files.
- Read small UTF-8 file.
- Search by filename.
- Revoke root.
- Create pairing code.
- Confirm fingerprint.
- Revoke pairing session.
- Inspect `audit.jsonl`.

4. Prepare a separate staging Railway environment before enabling any CyberTools flags outside local development.
5. Enable Tauri bundle only after dev QA passes, then build and test Windows installer.

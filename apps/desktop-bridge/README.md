# CyberTools Desktop Bridge

A security-first local companion for CyberTools.

## Current scope

This foundation is deliberately **read-only** and has no network server. It can:

- let the user choose allowed folders through a native folder picker;
- persist the allowed-root list locally;
- list files inside an allowed root;
- read bounded UTF-8 text files;
- search filenames inside an allowed root;
- record local audit events.

It cannot write, delete, rename, execute commands, launch processes, or expose files over the network.

## Security model

- Deny by default: no folder is readable until the user selects it.
- Canonical paths: every operation canonicalizes both root and target.
- Root containment: targets must remain below the selected root.
- Symlink rejection: symlink entries are not followed.
- Bounded reads and searches: limits prevent accidental memory or disk exhaustion.
- Local audit: each allowed or rejected operation is recorded in the app data directory.

## Free local validation on Windows

GitHub Actions is optional. The project includes a zero-cost local validator that performs the same required checks directly on a Windows development computer.

Double-click:

```text
validate-local.cmd
```

The launcher runs `validate-local.ps1 -InstallMissingTools`, which:

1. checks Node.js 22+ and npm;
2. installs Node.js LTS with WinGet if it is missing;
3. installs Rustup with WinGet if it is missing;
4. configures the stable MSVC Rust toolchain and `rustfmt`;
5. verifies that Microsoft C++ Build Tools with the Desktop C++ workload is installed;
6. runs `npm install`, `npm run build`, `cargo fmt --check`, and `cargo check`;
7. writes a timestamped log under `validation-logs/`.

The script never changes Railway, GitHub secrets, databases, or Production. It only installs public development tools when explicitly launched with `-InstallMissingTools`.

Manual mode without automatic tool installation:

```powershell
PowerShell -NoProfile -ExecutionPolicy Bypass -File .\validate-local.ps1
```

## Optional GitHub validation

The default-branch `Desktop Bridge CI` workflow can perform the same frontend and Rust checks when GitHub Actions is available. Local validation remains the fallback when hosted Actions is unavailable or billing-locked.

## Development

Requirements:

- Rust toolchain compatible with Tauri 2
- Node.js and npm
- Microsoft C++ Build Tools with Desktop development with C++
- Microsoft Edge WebView2 for running the app

Commands:

```bash
cd apps/desktop-bridge
npm install
npm run tauri dev
```

Production build:

```bash
npm run tauri build
```

## Railway isolation

This directory is intentionally not included in the root npm workspaces. Railway continues to build LibreChat exactly as before.

## Next gate

Secure pairing and a loopback-only MCP/WebSocket adapter will be added in a separate PR after this read-only foundation is validated.

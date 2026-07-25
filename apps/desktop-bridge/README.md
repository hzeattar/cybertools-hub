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

## Development

Requirements:

- Rust toolchain compatible with Tauri 2
- Node.js and npm
- platform-specific Tauri prerequisites

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

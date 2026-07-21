# Defensive Security Cheat Sheet Summary

This document is a summary written for CyberTools AI, based on concepts from the
**OWASP Cheat Sheet Series**, which is licensed under
**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
Source: https://cheatsheetseries.owasp.org/ (OWASP Foundation).
This summary is a condensed, rephrased overview for internal assistant use, shared
under the same CC BY-SA 4.0 terms, with attribution to OWASP as required by the license.

## Authentication

- Enforce strong password policies (length over complexity rules); support passphrases.
- Use MFA wherever possible, especially for admin/privileged accounts.
- Store passwords with a modern adaptive hash (bcrypt, argon2, scrypt) with a per-user salt.
- Lock or throttle accounts after repeated failed attempts; avoid revealing whether a username exists.

## Session Management

- Regenerate the session ID after login to prevent session fixation.
- Set cookies with `HttpOnly`, `Secure`, and `SameSite=Lax`/`Strict`.
- Expire sessions after a reasonable idle timeout and an absolute maximum lifetime.

## Input Validation & Injection Prevention

- Validate input against an allow-list (expected format/type), not a deny-list of "bad" patterns.
- Use parameterized queries/prepared statements for all database access -- never string-concatenate SQL.
- Encode output according to context (HTML, JS, URL, SQL) to prevent injection at render time.

## Access Control

- Deny by default; grant access explicitly per role/resource.
- Enforce authorization checks server-side on every request -- never trust a hidden client-side check alone.
- Re-verify object ownership on every request that references an ID (prevents IDOR -- Insecure Direct Object Reference).

## Secrets & Cryptography

- Never hardcode secrets in source code or commit them to version control.
- Use vetted, standard cryptographic libraries; never implement custom crypto.
- Rotate credentials on a schedule and immediately after any suspected exposure.

## Logging & Monitoring

- Log authentication events, access-control failures, and input-validation failures.
- Never log sensitive data (passwords, full tokens, card numbers) in plaintext.
- Alert on abnormal patterns (repeated failed logins, unusual data export volume).

## Authorized Testing Only

All security testing described in this document assumes explicit authorization from the
system owner. This summary does not include and will not provide exploitation payloads,
malware, or evasion techniques -- it is defensive and hardening-focused only.

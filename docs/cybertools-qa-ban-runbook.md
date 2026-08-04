# CyberTools QA Ban Runbook

LibreChat can temporarily ban QA accounts when automated API tests trip violation limits. Do not leave `BAN_VIOLATIONS=false` in production.

Safe QA flow:

1. Prefer browser-based tests for login/chat/upload.
2. If API smoke testing is required, temporarily set `BAN_VIOLATIONS=false`, redeploy, run the smoke, then immediately restore `BAN_VIOLATIONS=true`.
3. If a single QA account remains blocked, wait for `BAN_DURATION` to expire or clear only that user's ban records from the Mongo `logs` collection from an environment that can reach `mongodb.railway.internal`.
4. Verify after QA:
   - `BAN_VIOLATIONS=true`
   - `/readyz` returns `200`
   - login succeeds from a normal browser session

Never disable banning as a permanent fix.

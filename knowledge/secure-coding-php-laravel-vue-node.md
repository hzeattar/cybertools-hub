# Secure Coding Guidelines: PHP/Laravel, Vue, Node.js

Original content written for CyberTools AI. License: same as this repository.

## PHP / Laravel

- Always use Eloquent/Query Builder parameter binding; never interpolate raw user input into SQL strings.
- Validate every request with Form Request classes (`php artisan make:request`), not ad-hoc checks in controllers.
- Mass assignment: define `$fillable` explicitly; never use `$guarded = []` in production models.
- Store secrets in `.env`, never in `config/*.php` literals; access via `config()`, not `env()`, outside of config files (so config caching works correctly).
- Use `Hash::make()`/`Hash::check()` for passwords; never roll your own hashing.
- CSRF protection is on by default for web routes -- do not disable it for convenience; use API tokens (Sanctum/Passport) for stateless API routes instead.
- Rate-limit sensitive routes (`throttle` middleware) especially login, password reset, and any endpoint that touches billing or trading data.

## Vue

- Never use `v-html` with user-generated or untrusted content -- it is a direct XSS vector.
- Keep secrets and API keys out of the client bundle entirely; anything shipped to the browser is public.
- Validate props with explicit types and `required`; fail fast in development if a component receives malformed data.
- Prefer the Composition API (`ref`/`reactive`) for non-trivial state so reactivity dependencies stay explicit and testable.
- Debounce/throttle expensive watchers (search-as-you-type, live validation) to avoid excessive re-renders or API calls.

## Node.js / JavaScript backend

- Never use `eval`, `new Function(...)`, or `child_process.exec` with unsanitized user input.
- Use parameterized queries for any SQL driver (`mysql2`, `pg`) -- the same injection rule as PHP applies.
- Validate and sanitize all external input at the boundary (API layer), not deep inside business logic.
- Set explicit CORS origins in production; never `Access-Control-Allow-Origin: *` on endpoints that require authentication.
- Use `helmet` (Express) or equivalent security headers middleware by default.
- Log errors with enough context to debug, but never log full request bodies containing passwords, tokens, or card data.

## Cross-cutting

- Principle of least privilege: database users, API keys, and service accounts should only have the permissions they actually need.
- Dependency hygiene: run `npm audit` / `composer audit` regularly; pin lockfiles in version control.
- Defense in depth: input validation on the client is a UX nicety, never a security control -- always re-validate server-side.

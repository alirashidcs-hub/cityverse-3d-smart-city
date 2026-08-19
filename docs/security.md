# CityVerse — Security

## Authentication & authorization

- **Auth**: Supabase Auth (email/password + SSO for enterprise pilots).
  JWT passed as `Authorization: Bearer` on every API call; Next.js middleware
  verifies it before the route handler runs.
- **Roles** (stored in a `profiles.role` column, enforced both in API route
  guards and Postgres Row-Level Security):
  - `viewer` — explore the 3D city, run read-only queries, use the AI
    assistant, run *personal* simulations (not visible to others).
  - `analyst` — everything a viewer can do, plus create/share simulations,
    trigger emergencies in a simulation context, generate reports.
  - `admin` — everything above, plus edit the city graph (`/api/admin/*`),
    import CSV/JSON/GeoJSON, manage sensors, view the audit log.
- Row-Level Security policies mirror this at the database layer so a bug in
  API-route logic can't accidentally leak cross-tenant or above-role data.

## Input validation

- Every API route validates its body/query with a Zod schema before touching
  the database; invalid input returns `400` with a field-level error list,
  never a raw stack trace.
- CSV/JSON/GeoJSON admin imports (`api-design.md`) go through a two-step
  **validate → apply** flow: uploaded files are parsed and checked (schema,
  coordinate bounds, duplicate IDs) into `import_jobs.validation_errors`
  *before* anything touches the live `buildings`/`roads` tables. Nothing is
  applied automatically.
- GeoJSON imports are checked for reasonable coordinate bounds and geometry
  validity (no self-intersecting polygons, no NaN coordinates) to prevent
  malformed data from breaking the renderer.

## API protection

- Rate limiting via Upstash Redis at the edge (limits documented in
  `api-design.md`), keyed by user id (authenticated) or IP (anonymous demo
  endpoints like the public AI assistant).
- CORS restricted to the deployed frontend origin(s); no wildcard `*` in
  production.
- Anthropic API key lives only in the Vercel server environment
  (`ANTHROPIC_API_KEY`, no `NEXT_PUBLIC_` prefix) and is only ever used
  inside `/api/ai/assistant` — never returned to or callable from the client.
- All admin mutation routes require a fresh session (re-auth if the JWT is
  older than a short threshold) for destructive actions like bulk import.

## Secrets management

- No secrets in source control; `.env.local` is git-ignored and a
  `.env.example` documents required keys without values.
- Vercel environment variables scoped per environment (preview/staging/prod)
  so a leaked preview-deployment log can't expose production credentials.
- Supabase service-role key is used only in server-side code paths that
  need to bypass RLS (e.g. the ingestion gateway); it is never sent to
  Vercel Edge Middleware or any client bundle.

## Data privacy

- All building/citizen-facing numbers (population, occupancy, energy) in
  the current prototype are **synthetic** — no real personal data. This
  should remain true in any public demo deployment.
- If a real municipal deployment later includes anything resembling
  citizen-level data (e.g. individual smart-meter readings tied to an
  address), that data must be aggregated to district/block level before
  it reaches this application's database — CityVerse is a city-operations
  dashboard, not a system of record for personal data.
- Audit log (`audit_log` table) captures who changed what in the city graph
  and when, for accountability on admin actions.

## Dependency & infra hygiene

- Automated dependency scanning (GitHub Dependabot or Snyk) on the Next.js
  app and the ingestion-gateway service.
- Supabase RLS policies and API route guards are covered by integration
  tests so a future refactor can't silently drop an authorization check.
- Ingestion gateway (the one always-on, non-serverless component) is the
  highest-value target for hardening: validate all inbound MQTT/webhook
  payloads against a strict schema, run it with least-privilege DB
  credentials (insert-only on time-series tables, no access to auth/admin
  tables).

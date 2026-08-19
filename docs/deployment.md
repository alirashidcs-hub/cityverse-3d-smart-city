# CityVerse — Deployment

## Topology

| Layer | Where | Why |
|---|---|---|
| Next.js frontend + API routes | Vercel | Edge network, preview deployments per PR, native Next.js support |
| Postgres, Auth, Storage | Supabase | Managed Postgres + row-level security + built-in auth + object storage for reports |
| Realtime (traffic/weather/emergency push) | Supabase Realtime (or Ably/Pusher if higher throughput needed) | Vercel functions are stateless/short-lived — not suited to long-lived sockets |
| IoT ingestion gateway | Small always-on service (Fly.io / Railway / a single VM), not Vercel | Needs a persistent MQTT connection |
| Background jobs (report generation, simulation cleanup, predictive model runs) | Vercel Cron → triggers a queued job; heavier jobs run on the ingestion-gateway service | Keeps serverless functions short (<10s) |
| AI calls | Vercel Function → api.anthropic.com | Keeps the API key server-side |

## Environments

- `preview` — automatic per-PR Vercel deployment, points at a scratch
  Supabase project (seeded with the demo/procedural city).
- `staging` — mirrors production config, used for QA and load testing the
  simulation engine.
- `production` — real Supabase project, real domain, sensors (if connected)
  point here.

## Environment variables (Vercel project settings, never in the client bundle)

```
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=       # server-only
NEXT_PUBLIC_SUPABASE_URL=        # public, safe for client
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # public, RLS-protected
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
MQTT_BROKER_URL=                 # used only by the ingestion gateway service
REPORTS_BUCKET=
```

`NEXT_PUBLIC_*` variables are the only ones ever exposed to the browser; the
current prototype's direct `fetch("https://api.anthropic.com/...")` call from
the client is a prototype-only shortcut (the artifact host injects the key
server-side for that specific fetch) — it becomes `/api/ai/assistant` in
production so `ANTHROPIC_API_KEY` never reaches the browser at all.

## CI/CD

```
GitHub push → GitHub Actions
   1. lint + typecheck (eslint, tsc --noEmit)
   2. unit tests (Vitest) — simulation math, road-effective-traffic calc,
      before/after computations
   3. build (next build)
   4. Vercel auto-deploys the PR as a preview
   5. on merge to main → production deploy + Supabase migration run
      (supabase db push, using version-controlled SQL migrations)
```

## Scaling notes

- Static-ish city graph (`/api/city/graph`) is cached at the edge
  (`stale-while-revalidate`) — most users never hit Postgres for it directly.
- Time-series writes from IoT ingestion go through a connection pool
  (pgbouncer, Supabase's built-in pooler) to avoid exhausting Postgres
  connections under sensor load.
- The 3D renderer's instancing/LOD choices (documented in `architecture.md`)
  mean client-side performance scales with *visible* complexity, not total
  city size — a 10x larger city graph doesn't linearly cost 10x frame time.
- Realtime channel is scoped per-district-of-interest (subscribe to what's
  currently in camera view) rather than one global firehose, once the sensor
  count is large.

## Rollback

Vercel keeps every deployment; rollback is an instant alias swap. Database
migrations are additive-first (new columns nullable, backfilled, then
constrained) so a frontend rollback doesn't require a matching DB rollback.

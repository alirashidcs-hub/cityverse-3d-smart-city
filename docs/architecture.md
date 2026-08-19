# CityVerse — System Architecture

## 1. What exists today (Phase 1–2 prototype)

The current build is a **single self-contained React artifact**:

```
CityVerse.jsx
 ├─ Landing (cinematic hero)
 └─ CityApp
     ├─ Three.js scene (imperative, one canvas, one WebGL context)
     ├─ Procedural city generator (seeded PRNG, runs client-side once)
     ├─ Simulation engine (in-memory React state)
     └─ AI assistant (direct fetch to api.anthropic.com)
```

Everything — city data, simulation state, traffic math — lives in the browser tab.
There is no database, no auth, no persistence. This is intentional: it proves out the
3D experience, the interaction model, and the AI-grounding pattern before any backend
investment. Sections 2–3 below describe how this evolves into a real platform.

## 2. Target production architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                            CLIENT (Browser)                        │
│  Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui  │
│  React Three Fiber + Drei (city renderer)  ·  Framer Motion / GSAP │
│  Zustand or Jotai (client state)  ·  TanStack Query (server cache) │
└───────────────┬───────────────────────────────────────┬────────────┘
                │ REST / tRPC over HTTPS                 │ WebSocket / SSE
┌───────────────▼───────────────────────┐   ┌────────────▼───────────┐
│  Next.js API Routes (Vercel Functions) │   │  Realtime layer         │
│  /api/city/*  /api/simulation/*        │   │  Supabase Realtime OR   │
│  /api/ai/*    /api/admin/*             │   │  Ably/Pusher channel    │
│  - Zod-validated request/response      │   │  for traffic, weather,  │
│  - Auth middleware (Supabase Auth)     │   │  emergency broadcasts   │
└───────────────┬─────────────────────────┘   └────────────┬───────────┘
                │                                            │
┌───────────────▼───────────────────────┐   ┌────────────────▼───────┐
│  Postgres (Supabase)                   │   │  Background workers     │
│  - City graph: districts, buildings,   │   │  (Supabase Edge Fns /   │
│    roads, sensors                      │   │  small Node service)    │
│  - Time-series: traffic_samples,       │   │  - simulation engine    │
│    energy_readings, air_quality        │   │  - predictive models    │
│  - simulations, emergencies, reports   │   │  - IoT ingestion        │
└─────────────────────────────────────────┘   │  - report generation    │
                                                └─────────────────────────┘
                                    │
                        ┌───────────▼────────────┐
                        │  External integrations  │
                        │  Weather API · Traffic   │
                        │  API · GIS/OSM · IoT MQTT│
                        └──────────────────────────┘
```

## 3. Migration path from prototype → production

| Prototype today | Production target | Why |
|---|---|---|
| `generateCity()` runs in the browser | City graph generated once, stored in Postgres, served via `/api/city/graph` | Consistent city across users/sessions; enables admin edits |
| Simulation state in `useState` | Simulation runs as a server-side session (`simulations` table) with periodic snapshots | Shareable, resumable, auditable simulations |
| AI assistant calls `api.anthropic.com` directly from the browser | AI calls proxied through `/api/ai/assistant`, which assembles grounding context server-side from Postgres/cache | Keeps API keys off the client, allows rate limiting, enables tool-use against live data |
| Traffic/weather are procedurally generated | `/api/traffic/current`, `/api/weather/current` read from IoT ingestion pipeline (falls back to demo generator when no sensor is connected) | Same UI works in demo and production mode |
| No persistence | Postgres + Supabase Storage for reports/exports | Reports, saved simulations, audit trail |
| No auth | Supabase Auth + RBAC (viewer / analyst / admin) | Admin data-management screens need protection |

## 4. Rendering layer notes

- Move from imperative Three.js to **React Three Fiber** once the app has a real
  build pipeline — it composes far better with React state and code-splitting.
- Keep the current optimizations (instanced meshes for buildings/cars, single
  draw call per layer, LOD-able geometry) — they carry over directly to R3F.
- City geometry becomes **data-driven**: buildings/roads are fetched once as a
  compact JSON/GeoJSON payload and cached client-side (see `api-design.md`),
  not regenerated from a seed.

## 5. Non-goals (explicitly out of scope for the prototype)

- Photorealistic building models / CAD import — the current boxy instanced style
  is intentional for performance at city scale.
- True traffic microsimulation (SUMO-style) — Phase 2 uses a parametric model
  (multipliers + rerouting heuristics) that is fast, explainable, and good enough
  for a decision-support dashboard, not a physics-accurate simulator.

See `database-schema.md`, `api-design.md`, `ai-architecture.md`,
`iot-integration.md`, `deployment.md`, and `security.md` for the details behind
each box in the diagram above.

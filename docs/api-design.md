# CityVerse — API Design

All routes live under Next.js `app/api/**` (Vercel Functions). Requests are
validated with Zod; responses are JSON unless noted. Every route requires a
Supabase session (`Authorization: Bearer <jwt>`) except `/api/ai/assistant`'s
public-demo mode, which is rate-limited instead.

## Conventions

- Pagination: `?limit=50&cursor=<id>` on list endpoints.
- Errors: `{ error: { code, message } }` with matching HTTP status.
- All mutation routes (`POST`/`PATCH`/`DELETE`) require `analyst` role or
  above; read routes require `viewer` or above. See `security.md`.

## City graph (static-ish, cached aggressively)

```
GET  /api/city/graph
     → { districts: [...], buildings: [...], roads: [...] }
     Cache-Control: public, max-age=300, stale-while-revalidate=3600

GET  /api/city/buildings/:id
     → full building record + latest energy/water reading

PATCH /api/admin/buildings/:id      (admin)
     body: { status?, floors?, ... }
     → updated building; writes audit_log entry
```

## Live conditions

```
GET  /api/traffic/current
     → { roads: [{ id, axis, position, level, avgSpeedKph, source }] }
     Falls back to the parametric demo generator if no sensor row is
     fresh within the last 5 minutes for a given road.

GET  /api/weather/current
     → { condition, tempC, windKph, precipitationMm }

GET  /api/air-quality/current?district=downtown
     → { aqi, pm25, pm10, co2Ppm, tempC, label }

GET  /api/energy/summary
     → { totalKwh, byDistrict: [{ districtId, kwh }], topConsumers: [...] }
```

## Simulation engine

```
POST /api/simulations
     body: { params: { traffic, population, energy, water, transport,
                        construction, weatherSeverity } }
     → { id, baselineScore, status: 'active' }

PATCH /api/simulations/:id
     body: { params: {...} }                     // slider changes
     → { id, currentScore, effectiveTraffic: [...] }

POST /api/simulations/:id/road-closure
     body: { roadId }
     → { before, after, affectedDistricts, estimatedDelayMin, alternative }

POST /api/simulations/:id/construction
     body: { x, z }
     → { zoneId, districtId, trafficImpactPct, weeksEstimate, popImpact }

POST /api/simulations/:id/district-impact
     body: { districtId, metric: 'traffic'|'population'|'energy'|'transport', deltaPct }
     → { before, after, affectedRoads: [...], estimatedDelayMin? }

POST /api/simulations/:id/end
     → { finalScore, baselineScore, summary }

GET  /api/simulations/:id
     → full simulation state + event log (for replay/audit)
```

## Emergencies

```
POST /api/emergencies
     body: { type, x, z, simulationId? }          // simulationId omitted = live incident
     → full emergency record (severity, radius, popAffected, infra, response
       are derived server-side from a lookup table + district density,
       mirroring the client-side EMERGENCY_IMPACT logic today)

PATCH /api/emergencies/:id/resolve
     → { status: 'resolved' }
```

## AI assistant

```
POST /api/ai/assistant
     body: { message, simulationId? }
     → { reply }

     Server-side flow:
     1. Load current city snapshot (cached, <1s old) from Postgres/Redis.
     2. If simulationId present, load that simulation's params + event log.
     3. Assemble a grounding context (same shape as today's client-side
        system prompt) — see ai-architecture.md.
     4. Call Claude with the context + user message.
     5. Return only the reply text; the grounding data itself is never
        sent to the client (keeps prompt-construction logic server-side).
```

## Reports & admin import

```
POST /api/reports/generate
     body: { kind: 'city'|'traffic'|'energy'|'environmental'|'infrastructure',
             format: 'pdf'|'csv'|'png'|'txt', simulationId? }
     → { reportId, downloadUrl }         // signed Supabase Storage URL

POST /api/admin/import                    (admin)
     multipart form: file (.csv/.json/.geojson)
     → { jobId, status: 'pending' }
     GET /api/admin/import/:jobId → { status, validationErrors? }
     POST /api/admin/import/:jobId/apply → commits validated rows
```

## Rate limiting

| Route group | Limit |
|---|---|
| `/api/ai/assistant` | 20 req/min per user, 100 req/hour per IP (anonymous demo) |
| `/api/simulations/*` mutations | 60 req/min per user |
| Everything else | 300 req/min per user |

Enforced via Upstash Redis (`@upstash/ratelimit`) at the edge middleware layer.

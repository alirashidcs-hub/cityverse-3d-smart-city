# CityVerse — AI Architecture

## Design principle

**The model never invents city data.** Every number the assistant states must
trace back to something retrieved from the city graph, live conditions, or the
active simulation. This is enforced structurally, not just by prompt wording:
the assistant is only ever given a curated context block plus the user's
question — it has no other source of "facts" to draw from.

## Today's implementation (prototype)

The client builds a system prompt directly in the browser (`sendAiMessage` in
`CityVerse.jsx`) containing:

- District list and building counts
- Top 5 energy-consuming buildings
- Busiest roads (using live `effectiveTraffic`, so closures/boosts are reflected)
- Demo air-quality labels per district
- Active emergency, if any
- Full simulation state when Simulation Mode is on: every slider value, closed
  roads, construction zones, district-specific boosts, baseline vs. current
  City Score

This is then sent with the user's message to `api.anthropic.com/v1/messages`
(model `claude-sonnet-4-6`). It already satisfies "AI must receive current
city state, simulation parameters, district data... and the response should
reference the actual simulated numbers" — the production version below moves
the same logic server-side and adds retrieval + tool-use.

## Production architecture

```
User message
    │
    ▼
POST /api/ai/assistant
    │
    ├─ 1. Context assembly service
    │     - Pull city snapshot (cached, refreshed every 30s) from Postgres
    │     - Pull active simulation (if any) incl. event log
    │     - Pull latest emergencies
    │     - Compress into a bounded context block (same shape as the
    │       current client-side prompt, capped at ~2-3k tokens)
    │
    ├─ 2. Tool-use layer (Claude function calling)
    │     Tools exposed to the model:
    │       get_district_metrics(districtId)
    │       get_road_traffic(roadId | axis+position)
    │       get_building(buildingId | name)
    │       get_simulation_state(simulationId)
    │       run_simulation_preview(paramChanges)   // read-only "what-if",
    │                                               // does not mutate state
    │     Each tool queries Postgres directly and returns structured JSON —
    │     no free-text summarization between DB and model. This lets the
    │     assistant answer very specific questions ("what's road X-30's
    │     traffic right now") without bloating every prompt with the full
    │     city graph.
    │
    ├─ 3. Model call (Claude, system prompt = grounding rules + retrieved
    │     context, streaming response)
    │
    └─ 4. Response returned to client; context data itself is not exposed
          to the browser (keeps the retrieval/assembly logic server-side
          and avoids leaking the full DB snapshot on every turn)
```

## Grounding rules (system prompt, stable across requests)

1. Only use numbers present in the provided context or tool results.
2. If a question can't be answered from available data, say so explicitly
   rather than estimating — except for clearly-labeled hypotheticals
   ("if you raised traffic to 80%, based on the current multiplier model you
   would expect roughly...").
3. Always state that figures are simulated/demo unless the deployment is
   connected to live sensors (see `iot-integration.md`), in which case the
   assistant cites `source: sensor` vs `source: simulated` per data point.
4. Keep answers to 2–5 sentences; this is a dashboard assistant, not a report
   generator (use `/api/reports/generate` for long-form output).

## `run_simulation_preview` — the "what-if" tool

This is the tool that answers "What will happen if traffic increases by 40%?"
without actually mutating the user's simulation. It runs the same parametric
model used by the client (`trafficMult = (traffic/50) * (1 - transport/300)`,
plus closure/boost rules) against the current simulation's parameters with the
proposed delta applied, and returns before/after numbers. The model then
narrates the tool's structured output — it does not compute the delta itself.

## Predictive analytics (traffic / energy / water / population / air quality)

Phase 2's predictions are **rule-based projections**, not trained models:
next-hour traffic = current level × historical hourly multiplier curve;
next-day energy = current demand × weekday/weekend factor. These are clearly
labeled `"simulated prediction"` in both the UI and any AI response.

The architecture leaves room for real forecasting later: a `predictions`
table (`metric, district_id, horizon, predicted_value, model_version,
generated_at`) populated by a scheduled worker running an actual time-series
model (e.g. Prophet or a small LSTM) once enough historical sensor data
exists. The AI assistant's tool interface doesn't change — `get_district_metrics`
would just start returning model-backed predictions instead of rule-based ones,
with `model_version` in the payload so the assistant can cite it.

## Safety & cost controls

- Max 1000 output tokens per response (matches current client config).
- Context assembly caps context to the top-N most relevant entities per
  question type, not the entire city, to control token cost at scale.
- All AI calls logged (prompt hash, tool calls, token counts) for cost
  monitoring and for auditing what data was exposed to a given response.

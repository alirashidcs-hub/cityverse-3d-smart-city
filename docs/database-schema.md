# CityVerse — Database Schema (Postgres / Supabase)

All tables use `uuid` primary keys (`default gen_random_uuid()`) and
`created_at` / `updated_at` timestamps unless noted. Time-series tables are
partitioned by day/month once volume justifies it (see note at bottom).

## Core city graph

```sql
create table districts (
  id            text primary key,        -- 'downtown', 'residential', ...
  name          text not null,
  center_x      double precision not null,
  center_z      double precision not null,
  half_width    double precision not null,
  half_depth    double precision not null,
  color_hex     text not null,
  camera_radius double precision not null
);

create table buildings (
  id            uuid primary key default gen_random_uuid(),
  district_id   text references districts(id),
  name          text not null,
  x             double precision not null,
  z             double precision not null,
  width         double precision not null,
  depth         double precision not null,
  height        double precision not null,
  floors        int not null,
  year_built    int,
  status        text check (status in ('Operational','Maintenance','Offline')),
  is_hospital   boolean default false,
  is_school     boolean default false,
  base_color    text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on buildings (district_id);
create index on buildings using gist (point(x, z));

create table roads (
  id            uuid primary key default gen_random_uuid(),
  axis          text check (axis in ('x','z')) not null,
  position      double precision not null,   -- offset along the perpendicular axis
  length        double precision not null,
  status        text check (status in ('open','closed')) default 'open'
);

create table sensors (
  id            uuid primary key default gen_random_uuid(),
  kind          text check (kind in
                 ('traffic_loop','air_quality','weather','smart_meter','water_flow')) not null,
  district_id   text references districts(id),
  x             double precision,
  z             double precision,
  external_ref  text,             -- vendor/device id, for IoT correlation
  status        text check (status in ('online','offline','degraded')) default 'offline',
  last_seen_at  timestamptz
);
```

## Time-series (readings)

```sql
create table traffic_samples (
  id            bigserial primary key,
  road_id       uuid references roads(id),
  captured_at   timestamptz not null default now(),
  level         real check (level between 0 and 1),   -- 0=empty, 1=gridlock
  avg_speed_kph real,
  source        text check (source in ('sensor','simulated')) default 'simulated'
);
create index on traffic_samples (road_id, captured_at desc);

create table energy_readings (
  id            bigserial primary key,
  building_id   uuid references buildings(id),
  captured_at   timestamptz not null default now(),
  demand_kwh    real not null,
  solar_kwh     real default 0,
  source        text check (source in ('sensor','simulated')) default 'simulated'
);
create index on energy_readings (building_id, captured_at desc);

create table water_readings (
  id            bigserial primary key,
  district_id   text references districts(id),
  captured_at   timestamptz not null default now(),
  consumption_l real not null,
  reservoir_pct real,
  leak_alert    boolean default false
);

create table air_quality_samples (
  id            bigserial primary key,
  district_id   text references districts(id),
  captured_at   timestamptz not null default now(),
  aqi           int not null,
  pm25          real, pm10 real, co2_ppm real, temp_c real
);

create table weather_samples (
  id            bigserial primary key,
  captured_at   timestamptz not null default now(),
  condition     text check (condition in ('clear','cloudy','rain','storm','fog','night')),
  temp_c        real, wind_kph real, precipitation_mm real
);
```

## Simulation & events (Phase 2)

```sql
create table simulations (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references auth.users(id),
  started_at      timestamptz default now(),
  ended_at        timestamptz,
  baseline_score  int,
  final_score     int,
  params          jsonb not null,   -- {traffic:50, population:50, energy:50, ...}
  status          text check (status in ('active','completed','discarded')) default 'active'
);

create table simulation_events (
  id              bigserial primary key,
  simulation_id   uuid references simulations(id) on delete cascade,
  kind            text check (kind in
                   ('param_change','road_closure','road_reopen',
                    'construction_add','construction_remove',
                    'district_impact','emergency')) not null,
  payload         jsonb not null,   -- e.g. {roadId, before, after, affectedDistricts}
  created_at      timestamptz default now()
);

create table construction_zones (
  id              uuid primary key default gen_random_uuid(),
  simulation_id   uuid references simulations(id),
  district_id     text references districts(id),
  x double precision, z double precision, radius double precision,
  traffic_impact_pct real,
  weeks_estimate  int,
  created_at      timestamptz default now(),
  removed_at      timestamptz
);

create table emergencies (
  id              uuid primary key default gen_random_uuid(),
  simulation_id   uuid references simulations(id),   -- null if a real/live incident
  type            text check (type in
                   ('Fire','Flood','Traffic accident','Power outage','Water leak')) not null,
  x double precision, z double precision, radius double precision,
  district_id     text references districts(id),
  severity        text check (severity in ('Low','Moderate','High','Critical')),
  population_affected int,
  infra_affected  text,
  recommended_response text,
  eta_minutes     int,
  status          text check (status in ('active','resolved')) default 'active',
  created_at      timestamptz default now(),
  resolved_at     timestamptz
);
```

## Reports & admin

```sql
create table reports (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references auth.users(id),
  kind          text check (kind in ('city','traffic','energy','environmental','infrastructure')),
  format        text check (format in ('pdf','csv','png','txt')),
  storage_path  text not null,      -- Supabase Storage object path
  created_at    timestamptz default now()
);

create table import_jobs (
  id            uuid primary key default gen_random_uuid(),
  uploaded_by   uuid references auth.users(id),
  file_type     text check (file_type in ('csv','json','geojson')),
  status        text check (status in ('pending','validated','failed','applied')) default 'pending',
  validation_errors jsonb,
  created_at    timestamptz default now()
);

create table audit_log (
  id            bigserial primary key,
  actor_id      uuid references auth.users(id),
  action        text not null,       -- 'building.update', 'road.close', 'import.apply', ...
  target        text,                -- table:id
  diff          jsonb,
  created_at    timestamptz default now()
);
```

## Partitioning & retention

Once sensors are live, `traffic_samples`, `energy_readings`, and
`air_quality_samples` grow fast (one row per sensor per interval). Partition
these by month (`pg_partman` or native declarative partitioning) and roll up
anything older than 90 days into hourly aggregates in a `*_hourly` table,
dropping raw partitions after 1 year. `simulation_events` is small by
comparison and can stay unpartitioned.

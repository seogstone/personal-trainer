create extension if not exists "pgcrypto";

create type provider_id as enum ('whoop', 'hevy', 'myfitnesspal', 'csv');
create type connection_status as enum ('connected', 'not_configured', 'reauthentication_required', 'degraded', 'syncing');

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'Europe/London',
  date_of_birth date,
  height_cm numeric(5,2),
  primary_goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider provider_id not null,
  status connection_status not null default 'not_configured',
  external_account_id text,
  last_successful_sync_at timestamptz,
  last_attempted_sync_at timestamptz,
  last_error_code text,
  last_error_message_safe text,
  reauthentication_required boolean not null default false,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table recovery_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source provider_id not null,
  external_id text not null,
  calendar_date date not null,
  recovery_score integer check (recovery_score between 0 and 100),
  resting_heart_rate integer,
  hrv_rmssd_ms numeric(8,2),
  spo2_percent numeric(5,2),
  skin_temperature_c numeric(5,2),
  raw_json_optional jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source provider_id not null,
  external_id text not null,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_seconds integer,
  routine_external_id text,
  total_volume_kg numeric(12,2),
  exercise_count integer,
  set_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table nutrition_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source provider_id not null,
  calendar_date date not null,
  calories_consumed integer,
  calories_burned_optional integer,
  protein_g numeric(8,2),
  carbohydrate_g numeric(8,2),
  fat_g numeric(8,2),
  fibre_g numeric(8,2),
  sugar_g numeric(8,2),
  sodium_mg numeric(10,2),
  water_ml integer,
  goal_calories integer,
  goal_protein_g numeric(8,2),
  goal_carbohydrate_g numeric(8,2),
  goal_fat_g numeric(8,2),
  complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, calendar_date)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  provider provider_id,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table integration_connections enable row level security;
alter table recovery_days enable row level security;
alter table workouts enable row level security;
alter table nutrition_days enable row level security;
alter table audit_events enable row level security;

create policy "own profiles" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own integration connections" on integration_connections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own recovery days" on recovery_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workouts" on workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own nutrition days" on nutrition_days for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own audit events" on audit_events for select using (auth.uid() = user_id);

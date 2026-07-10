create table if not exists sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source provider_id not null,
  external_id text not null,
  calendar_date date not null,
  start_at timestamptz,
  end_at timestamptz,
  time_in_bed_minutes integer,
  total_sleep_minutes integer,
  awake_minutes integer,
  light_sleep_minutes integer,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  sleep_need_minutes integer,
  sleep_performance_percent numeric(5,2),
  sleep_efficiency_percent numeric(5,2),
  sleep_consistency_percent numeric(5,2),
  disturbance_count integer,
  average_sleep_heart_rate integer,
  minimum_sleep_heart_rate integer,
  raw_json_optional jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

alter table sleep_sessions enable row level security;

create policy "own sleep sessions" on sleep_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

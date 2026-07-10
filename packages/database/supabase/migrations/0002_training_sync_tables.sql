create table if not exists user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  target_weight_kg numeric(8,2),
  target_body_fat_percent numeric(5,2),
  calorie_target integer,
  protein_target_g numeric(8,2),
  carbohydrate_target_g numeric(8,2),
  fat_target_g numeric(8,2),
  weekly_workout_target integer not null default 3,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider provider_id not null,
  sync_type text not null,
  status text not null,
  range_start timestamptz,
  range_end timestamptz,
  records_read integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  error_code text,
  error_message_safe text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata_json jsonb not null default '{}'
);

create table if not exists exercise_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source provider_id not null,
  external_id text not null,
  title text not null,
  primary_muscle_group text,
  secondary_muscle_groups_json jsonb not null default '[]',
  equipment text,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source provider_id not null,
  external_id text not null,
  folder_external_id text,
  title text not null,
  description text,
  position integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table if not exists routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null references routines(id) on delete cascade,
  exercise_template_id uuid references exercise_templates(id) on delete set null,
  position integer not null,
  rest_seconds integer,
  notes text,
  sets_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_template_id uuid references exercise_templates(id) on delete set null,
  external_exercise_id text,
  title_snapshot text not null,
  position integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
  external_id text not null,
  set_index integer not null,
  set_type text,
  weight_kg numeric(10,2),
  reps numeric(8,2),
  distance_m numeric(12,2),
  duration_seconds integer,
  rpe numeric(4,2),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

alter table user_goals enable row level security;
alter table sync_runs enable row level security;
alter table exercise_templates enable row level security;
alter table routines enable row level security;
alter table routine_exercises enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sets enable row level security;

create policy "own user goals" on user_goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own sync runs" on sync_runs for select using (auth.uid() = user_id);
create policy "own exercise templates" on exercise_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routines" on routines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routine exercises" on routine_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout exercises" on workout_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own workout sets" on workout_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

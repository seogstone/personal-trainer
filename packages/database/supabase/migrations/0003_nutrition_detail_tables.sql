create table if not exists nutrition_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nutrition_day_id uuid not null references nutrition_days(id) on delete cascade,
  meal_name text not null,
  position integer not null,
  calories integer,
  protein_g numeric(8,2),
  carbohydrate_g numeric(8,2),
  fat_g numeric(8,2),
  items_json jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source provider_id not null,
  external_id_optional text,
  measured_at timestamptz not null,
  weight_kg numeric(8,2),
  body_fat_percent numeric(5,2),
  lean_mass_kg numeric(8,2),
  waist_cm numeric(8,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, measured_at)
);

alter table nutrition_meals enable row level security;
alter table body_metrics enable row level security;

create policy "own nutrition meals" on nutrition_meals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own body metrics" on body_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

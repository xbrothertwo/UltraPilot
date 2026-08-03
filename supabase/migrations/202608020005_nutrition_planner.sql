-- Personal product presets, timeline provenance and deterministic bottle schedules.
create table public.nutrition_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  category text not null check (category in ('gel', 'bar', 'drink_mix', 'food', 'other')),
  serving_label text not null default '1 Portion' check (char_length(serving_label) between 1 and 80),
  carbohydrates_grams numeric(7,2) not null default 0 check (carbohydrates_grams >= 0),
  fluid_milliliters integer not null default 0 check (fluid_milliliters >= 0),
  sodium_milligrams integer not null default 0 check (sodium_milligrams >= 0),
  calories integer not null default 0 check (calories >= 0),
  barcode text,
  image_storage_path text,
  source text not null default 'manual' check (source in ('manual', 'photo', 'barcode')),
  extraction_metadata jsonb,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nutrition_bottle_plans (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  volume_milliliters integer not null check (volume_milliliters > 0),
  carbohydrates_grams numeric(7,2) not null default 0 check (carbohydrates_grams >= 0),
  sodium_milligrams integer not null default 0 check (sodium_milligrams >= 0),
  calories integer not null default 0 check (calories >= 0),
  first_drink_seconds integer not null check (first_drink_seconds >= 0),
  last_drink_seconds integer not null check (last_drink_seconds >= first_drink_seconds),
  interval_minutes smallint not null check (interval_minutes between 5 and 240),
  remaining_percent numeric(5,2) not null default 0 check (remaining_percent between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.nutrition_entries
  add column product_id uuid references public.nutrition_products(id) on delete set null,
  add column quantity numeric(6,2) not null default 1 check (quantity > 0),
  add column entry_method text not null default 'manual' check (entry_method in ('manual', 'timeline', 'bottle_schedule')),
  add column bottle_plan_id uuid references public.nutrition_bottle_plans(id) on delete cascade;

create index nutrition_products_user_idx on public.nutrition_products(user_id, category, name);
create index nutrition_bottle_plans_activity_idx on public.nutrition_bottle_plans(activity_id);
alter table public.nutrition_products enable row level security;
alter table public.nutrition_bottle_plans enable row level security;
create policy "nutrition_products_owner_all" on public.nutrition_products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "nutrition_bottle_plans_owner_all" on public.nutrition_bottle_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


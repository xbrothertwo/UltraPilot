-- Reusable bottle recipes and traceability from activity bottles to presets.
create table public.nutrition_bottle_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  volume_milliliters integer not null check (volume_milliliters > 0),
  carbohydrates_grams numeric(7,2) not null default 0 check (carbohydrates_grams >= 0),
  sodium_milligrams integer not null default 0 check (sodium_milligrams >= 0),
  calories integer not null default 0 check (calories >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nutrition_bottle_plans
  add column preset_id uuid references public.nutrition_bottle_presets(id) on delete set null;

create index nutrition_bottle_presets_user_idx on public.nutrition_bottle_presets(user_id, name);
alter table public.nutrition_bottle_presets enable row level security;
create policy "nutrition_bottle_presets_owner_all" on public.nutrition_bottle_presets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


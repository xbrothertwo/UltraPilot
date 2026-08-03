create table public.training_plan_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  summary text not null check (char_length(summary) between 1 and 2000),
  caution text check (caution is null or char_length(caution) <= 1000),
  model text,
  used_ai boolean not null default false,
  deterministic_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index training_plan_generations_user_week_idx on public.training_plan_generations(user_id, week_start, created_at desc);
alter table public.training_plan_generations enable row level security;
create policy "training_plan_generations_owner_all" on public.training_plan_generations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.planned_workouts add column source text not null default 'manual' check (source in ('manual', 'automatic'));
alter table public.planned_workouts add column generation_id uuid references public.training_plan_generations(id) on delete set null;

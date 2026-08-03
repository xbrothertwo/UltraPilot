-- Secure, revocable credentials for the personal Apple Health Shortcut bridge.
create table public.health_shortcut_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint text not null check (char_length(token_hint) = 6),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

alter table public.health_shortcut_tokens enable row level security;
create policy "health_shortcut_tokens_owner_select" on public.health_shortcut_tokens for select using (auth.uid() = user_id);
create policy "health_shortcut_tokens_owner_insert" on public.health_shortcut_tokens for insert with check (auth.uid() = user_id);
create policy "health_shortcut_tokens_owner_update" on public.health_shortcut_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "health_shortcut_tokens_owner_delete" on public.health_shortcut_tokens for delete using (auth.uid() = user_id);

alter table public.apple_health_daily_metrics
  drop constraint if exists apple_health_daily_metrics_source_check;

alter table public.apple_health_daily_metrics
  add constraint apple_health_daily_metrics_source_check
  check (source in ('apple_health_export', 'apple_health_shortcut'));

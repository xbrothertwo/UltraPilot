-- Durable, server-only account deletion jobs and stale-JWT storage hardening.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.account_deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  status text not null default 'requested'
    check (status in ('requested', 'revoking_sessions', 'deleting_storage', 'deleting_auth', 'failed', 'completed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text
    check (last_error_code is null or last_error_code in (
      'session_revoke_failed',
      'storage_list_failed',
      'storage_delete_failed',
      'storage_not_empty',
      'auth_delete_failed',
      'lease_lost',
      'internal_error'
    )),
  reauthenticated_at timestamptz not null,
  sessions_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  lease_token uuid,
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  lease_expires_at timestamptz,
  auth_delete_started_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  check ((status = 'completed') = (completed_at is not null)),
  check ((lease_token is null) = (lease_expires_at is null)),
  check (auth_delete_started_at is null or sessions_revoked_at is not null),
  check (status <> 'deleting_auth' or (sessions_revoked_at is not null and auth_delete_started_at is not null)),
  check (status not in ('deleting_storage', 'completed') or sessions_revoked_at is not null),
  check (status not in ('requested', 'revoking_sessions') or (sessions_revoked_at is null and auth_delete_started_at is null))
);

create index account_deletion_jobs_due_idx
  on public.account_deletion_jobs (status, next_attempt_at)
  where status <> 'completed';

alter table public.account_deletion_jobs enable row level security;
revoke all on table public.account_deletion_jobs from public, anon, authenticated;
grant all on table public.account_deletion_jobs to service_role;

create or replace function public.claim_account_deletion_job(
  p_job_id uuid default null,
  p_lease_seconds integer default 300
)
returns setof public.account_deletion_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_id uuid;
begin
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 600 then
    raise exception 'invalid lease duration';
  end if;

  select job.id
    into claimed_id
  from public.account_deletion_jobs as job
  where job.sessions_revoked_at is not null
    and job.next_attempt_at <= now()
    and (job.lease_expires_at is null or job.lease_expires_at <= now())
    and (
      job.status in ('deleting_storage', 'failed')
      or (
        job.status = 'deleting_auth'
        and job.auth_delete_started_at is not null
        and job.auth_delete_started_at <= now() - interval '20 minutes'
      )
    )
    and (p_job_id is null or job.id = p_job_id)
  order by job.next_attempt_at, job.created_at, job.id
  for update skip locked
  limit 1;

  if claimed_id is null then
    return;
  end if;

  return query
  update public.account_deletion_jobs as job
  set attempt_count = job.attempt_count + 1,
      lease_token = gen_random_uuid(),
      lease_generation = job.lease_generation + 1,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where job.id = claimed_id
  returning job.*;
end;
$$;

create or replace function public.transition_account_deletion_job(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_expected_status text,
  p_new_status text,
  p_error_code text default null,
  p_next_attempt_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if not (
    (p_expected_status in ('failed', 'deleting_storage', 'deleting_auth') and p_new_status = 'deleting_storage')
    or (p_expected_status = 'deleting_storage' and p_new_status = 'failed')
    or (p_expected_status = 'deleting_auth' and p_new_status in ('failed', 'completed'))
  ) then
    return false;
  end if;

  if p_new_status = 'failed' and (p_error_code is null or p_error_code not in (
    'storage_list_failed', 'storage_delete_failed', 'storage_not_empty', 'auth_delete_failed', 'internal_error'
  )) then
    return false;
  end if;

  update public.account_deletion_jobs as job
  set status = p_new_status,
      last_error_code = case when p_new_status = 'failed' then p_error_code else null end,
      next_attempt_at = coalesce(p_next_attempt_at, job.next_attempt_at),
      completed_at = case when p_new_status = 'completed' then now() else null end,
      auth_delete_started_at = case when p_new_status = 'deleting_storage' then null else job.auth_delete_started_at end,
      lease_token = case when p_new_status in ('failed', 'completed') then null else job.lease_token end,
      lease_expires_at = case when p_new_status in ('failed', 'completed') then null else job.lease_expires_at end,
      updated_at = now()
  where job.id = p_job_id
    and job.lease_token = p_lease_token
    and job.lease_generation = p_lease_generation
    and job.lease_expires_at > now()
    and job.status = p_expected_status;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create or replace function public.begin_account_auth_delete(
  p_job_id uuid,
  p_lease_token uuid,
  p_lease_generation bigint
)
returns table (
  user_id uuid,
  lease_token uuid,
  lease_generation bigint,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.account_deletion_jobs as job
  set status = 'deleting_auth',
      auth_delete_started_at = now(),
      lease_expires_at = now() + interval '15 minutes',
      updated_at = now()
  where job.id = p_job_id
    and job.lease_token = p_lease_token
    and job.lease_generation = p_lease_generation
    and job.lease_expires_at > now()
    and job.sessions_revoked_at is not null
    and job.status = 'deleting_storage'
  returning job.user_id, job.lease_token, job.lease_generation, job.lease_expires_at;
end;
$$;

revoke all on function public.claim_account_deletion_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.transition_account_deletion_job(uuid, uuid, bigint, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.begin_account_auth_delete(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.claim_account_deletion_job(uuid, integer) to service_role;
grant execute on function public.transition_account_deletion_job(uuid, uuid, bigint, text, text, text, timestamptz) to service_role;
grant execute on function public.begin_account_auth_delete(uuid, uuid, bigint) to service_role;

create or replace function private.account_allows_activity_file_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.profiles where profiles.id = auth.uid()
    )
    and not exists (
      select 1
      from public.account_deletion_jobs as job
      where job.user_id = auth.uid()
        and (
          job.status in ('requested', 'revoking_sessions', 'deleting_storage', 'deleting_auth')
          or (job.status = 'failed' and job.sessions_revoked_at is not null)
        )
    );
$$;

revoke all on function private.account_allows_activity_file_write() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.account_allows_activity_file_write() to authenticated;

drop policy if exists "activity_files_storage_insert" on storage.objects;
create policy "activity_files_storage_insert" on storage.objects for insert
with check (
  bucket_id = 'activity-files'
  and auth.uid()::text = (storage.foldername(name))[1]
  and private.account_allows_activity_file_write()
);

drop policy if exists "activity_files_storage_update" on storage.objects;
create policy "activity_files_storage_update" on storage.objects for update
using (
  bucket_id = 'activity-files'
  and owner_id = auth.uid()::text
  and auth.uid()::text = (storage.foldername(name))[1]
  and private.account_allows_activity_file_write()
)
with check (
  bucket_id = 'activity-files'
  and owner_id = auth.uid()::text
  and auth.uid()::text = (storage.foldername(name))[1]
  and private.account_allows_activity_file_write()
);

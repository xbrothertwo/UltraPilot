begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

select has_table('public', 'account_deletion_jobs', 'durable deletion job table exists');
select col_type_is('public', 'account_deletion_jobs', 'lease_generation', 'bigint', 'lease generation is bigint');
select col_not_null('public', 'account_deletion_jobs', 'lease_generation', 'lease generation is required');
select has_column('public', 'account_deletion_jobs', 'auth_delete_started_at', 'auth deletion start is recorded');
select has_pk('public', 'account_deletion_jobs', 'job table has a primary key');
select col_is_unique('public', 'account_deletion_jobs', 'user_id', 'one durable job exists per user');
select is(
  (select count(*)::integer from pg_constraint where conrelid = 'public.account_deletion_jobs'::regclass and contype = 'c'),
  10,
  'all job state and lease constraints exist'
);
select has_index('public', 'account_deletion_jobs', 'account_deletion_jobs_due_idx', 'due-job index exists');
select is((select relrowsecurity from pg_class where oid = 'public.account_deletion_jobs'::regclass), true, 'job table has RLS enabled');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'account_deletion_jobs'), 0, 'job table has no client policies');
select ok(
  not has_table_privilege('anon', 'public.account_deletion_jobs', 'SELECT')
    and not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'SELECT')
    and not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'INSERT')
    and not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.account_deletion_jobs', 'DELETE'),
  'client roles have no job-table privileges'
);
select ok(
  has_table_privilege('service_role', 'public.account_deletion_jobs', 'SELECT, INSERT, UPDATE, DELETE'),
  'service role can maintain job rows'
);
select has_function('public', 'claim_account_deletion_job', array['uuid', 'integer'], 'claim RPC exists');
select has_function('public', 'transition_account_deletion_job', array['uuid', 'uuid', 'bigint', 'text', 'text', 'text', 'timestamp with time zone'], 'fenced transition RPC exists');
select has_function('public', 'begin_account_auth_delete', array['uuid', 'uuid', 'bigint'], 'atomic auth-delete RPC exists');
select function_privs_are('public', 'claim_account_deletion_job', array['uuid', 'integer'], 'authenticated', array[]::text[], 'clients cannot claim jobs');
select function_privs_are('public', 'transition_account_deletion_job', array['uuid', 'uuid', 'bigint', 'text', 'text', 'text', 'timestamp with time zone'], 'authenticated', array[]::text[], 'clients cannot mutate claimed jobs');
select function_privs_are('public', 'begin_account_auth_delete', array['uuid', 'uuid', 'bigint'], 'authenticated', array[]::text[], 'clients cannot begin auth deletion');
select function_privs_are('public', 'claim_account_deletion_job', array['uuid', 'integer'], 'service_role', array['EXECUTE'], 'service role can claim jobs');
select has_function('private', 'account_allows_activity_file_write', array[]::text[], 'private storage write guard exists');

select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'activity_files_storage_insert' and cmd = 'INSERT'),
  1,
  'storage insert policy is installed'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'activity_files_storage_update' and cmd = 'UPDATE'),
  1,
  'storage update policy is installed'
);
select is(
  (select count(*)::integer
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where ((n.nspname = 'private' and p.proname = 'account_allows_activity_file_write')
       or (n.nspname = 'public' and p.proname in (
         'claim_account_deletion_job', 'transition_account_deletion_job', 'begin_account_auth_delete'
       )))
     and p.prosecdef and p.proconfig @> array['search_path=""']),
  4,
  'all deletion SECURITY DEFINER functions have an empty search path'
);
select is(
  (select count(*)::integer
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   cross join (values ('PUBLIC'), ('anon'), ('authenticated')) as roles(role_name)
   where n.nspname = 'public'
     and p.proname in ('claim_account_deletion_job', 'transition_account_deletion_job', 'begin_account_auth_delete')
     and has_function_privilege(roles.role_name, p.oid, 'EXECUTE')),
  0,
  'PUBLIC, anon and authenticated cannot execute destructive job RPCs'
);
select is(
  (select count(*)::integer
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('claim_account_deletion_job', 'transition_account_deletion_job', 'begin_account_auth_delete')
     and has_function_privilege('service_role', p.oid, 'EXECUTE')),
  3,
  'service role can execute every job RPC'
);

with expected(table_name) as (values
  ('profiles'), ('training_goals'), ('training_preferences'), ('schedule_code_mappings'),
  ('activities'), ('activity_files'), ('activity_metrics'), ('activity_streams'),
  ('subjective_feedback'), ('ai_analyses'), ('nutrition_entries'), ('nutrition_products'),
  ('nutrition_bottle_plans'), ('nutrition_bottle_presets'), ('calendar_events'),
  ('planned_workouts'), ('training_plan_generations'), ('missions'), ('training_blocks'),
  ('training_block_weeks'), ('apple_health_daily_metrics'), ('daily_readiness_checkins'),
  ('health_shortcut_tokens')
), cascaded as (
  select c.relname as table_name
  from pg_constraint fk
  join pg_class c on c.oid = fk.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_class parent on parent.oid = fk.confrelid
  join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
  where fk.contype = 'f' and fk.confdeltype = 'c' and n.nspname = 'public'
    and parent_ns.nspname = 'auth' and parent.relname = 'users'
)
select is((select count(*)::integer from expected left join cascaded using (table_name) where cascaded.table_name is null), 0, 'every user table cascades from auth.users');

select * from finish();
rollback;

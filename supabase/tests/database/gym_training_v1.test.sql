begin;

create extension if not exists pgtap with schema extensions;
select plan(33);

select has_table('public', 'gym_exercises', 'exercise reference table exists');
select has_table('public', 'gym_equipment', 'normalized equipment table exists');
select has_table('public', 'gym_programs', 'program table exists');
select has_table('public', 'gym_program_days', 'program day table exists');
select has_table('public', 'gym_program_exercises', 'program exercise table exists');
select has_table('public', 'gym_sessions', 'session table exists');
select has_table('public', 'gym_session_exercises', 'session snapshot table exists');
select has_table('public', 'gym_sets', 'set table exists');
select has_column('public', 'planned_workouts', 'gym_program_day_id', 'planned workout links to a program day');
select has_column('public', 'planned_workouts', 'gym_schedule_key', 'planned workout has an idempotency key');
select col_is_unique('public', 'gym_exercises', 'external_id', 'global external IDs are unique');
select col_is_unique('public', 'gym_sessions', 'planned_workout_id', 'one session exists per planned workout');
select has_index('public', 'gym_sessions', 'gym_sessions_one_active_per_user_idx', 'one active session index exists');
select col_is_unique('public', 'planned_workouts', array['user_id', 'gym_schedule_key'], 'schedule generation is duplicate safe');
select has_function('public', 'save_gym_program', array['uuid', 'jsonb'], 'atomic program save RPC exists');
select function_privs_are('public', 'save_gym_program', array['uuid', 'jsonb'], 'authenticated', array['EXECUTE'], 'authenticated users can save their own program aggregate');
select function_privs_are('public', 'save_gym_program', array['uuid', 'jsonb'], 'anon', array[]::text[], 'anonymous users cannot save gym programs');
select is((select prosecdef from pg_proc where oid = 'public.save_gym_program(uuid,jsonb)'::regprocedure), false, 'program save RPC keeps invoker RLS');
select is((select condeferrable from pg_constraint where conrelid = 'public.gym_program_days'::regclass and conname = 'gym_program_days_program_id_position_key'), true, 'program day order uniqueness supports atomic reordering');

select is((select relrowsecurity from pg_class where oid = 'public.gym_exercises'::regclass), true, 'exercise table has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.gym_programs'::regclass), true, 'program table has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.gym_sessions'::regclass), true, 'session table has RLS');
select is((select relrowsecurity from pg_class where oid = 'public.gym_sets'::regclass), true, 'set table has RLS');

select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'gym_exercises' and policyname = 'gym_exercises_visible_read'), 1, 'visible exercise read policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'gym_exercises' and policyname = 'gym_custom_exercises_update'), 1, 'custom exercise update policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'gym_programs' and policyname = 'gym_programs_owner_all'), 1, 'program owner policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'gym_sessions' and policyname = 'gym_sessions_owner_all'), 1, 'session owner policy exists');
select is((select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'gym_sets' and policyname = 'gym_sets_owner_all'), 1, 'set owner policy exists');

select ok(not has_table_privilege('anon', 'public.gym_exercises', 'SELECT'), 'anonymous users cannot read the library');
select ok(has_table_privilege('authenticated', 'public.gym_exercises', 'SELECT'), 'authenticated users can read visible exercises');
select ok(not has_table_privilege('authenticated', 'public.gym_equipment', 'UPDATE'), 'normal users cannot mutate global equipment');
select ok(has_table_privilege('authenticated', 'public.gym_sets', 'SELECT, INSERT, UPDATE, DELETE'), 'authenticated owner workflows have set privileges');
select is(
  (select count(*)::integer from pg_constraint fk
   join pg_class c on c.oid = fk.conrelid
   join pg_class parent on parent.oid = fk.confrelid
   join pg_namespace n on n.oid = c.relnamespace
   join pg_namespace pn on pn.oid = parent.relnamespace
   where fk.contype = 'f' and fk.confdeltype = 'c' and n.nspname = 'public'
     and pn.nspname = 'auth' and parent.relname = 'users'
     and c.relname in ('gym_exercises','gym_exercise_favorites','gym_programs','gym_program_days','gym_program_exercises','gym_sessions','gym_session_exercises','gym_sets')),
  8,
  'all user-owned gym tables cascade from auth users'
);

select * from finish();
rollback;

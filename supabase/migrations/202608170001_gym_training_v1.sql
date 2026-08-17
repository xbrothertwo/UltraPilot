-- Gym exercise library, programs and server-persisted workout tracking.
-- Apply this migration before deploying code that reads gym_* tables.

create table public.gym_equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table public.gym_exercises (
  id uuid primary key default gen_random_uuid(),
  external_id text unique check (external_id is null or external_id ~ '^EX-[0-9]{4}$'),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  primary_muscle text check (primary_muscle is null or char_length(primary_muscle) <= 160),
  secondary_muscles text[] not null default '{}',
  muscle_group text not null check (char_length(muscle_group) between 1 and 100),
  secondary_muscle_groups text[] not null default '{}',
  aliases text[] not null default '{}',
  variations text[] not null default '{}',
  tracking_type text not null check (tracking_type in (
    'weight_reps', 'bodyweight_reps', 'weight_or_bodyweight_reps',
    'reps_only', 'time', 'weight_time', 'distance_time',
    'weight_distance', 'time_or_reps'
  )),
  exercise_type text not null check (exercise_type in (
    'compound', 'isolation', 'core', 'carry', 'isometric',
    'plyometric', 'conditioning', 'stability'
  )),
  movement_pattern text check (movement_pattern is null or char_length(movement_pattern) <= 100),
  laterality text not null check (laterality in ('bilateral', 'unilateral', 'alternating', 'variable')),
  notes text check (notes is null or char_length(notes) <= 2000),
  source text not null default 'custom' check (source in ('ultrapilot_csv', 'custom')),
  source_equipment text[] not null default '{}',
  active boolean not null default true,
  review_status text check (review_status is null or char_length(review_status) <= 40),
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  library_hash text check (library_hash is null or library_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (owner_id is null and external_id is not null and source = 'ultrapilot_csv')
    or (owner_id is not null and external_id is null and source = 'custom')
  )
);

create table public.gym_exercise_equipment (
  exercise_id uuid not null references public.gym_exercises(id) on delete cascade,
  equipment_id uuid not null references public.gym_equipment(id) on delete restrict,
  primary key (exercise_id, equipment_id)
);

create table public.gym_exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.gym_exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create table public.gym_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  goal text not null check (goal in ('hypertrophy', 'strength', 'athletic', 'custom')),
  training_days_per_week integer not null check (training_days_per_week between 1 and 7),
  start_date date not null,
  end_date date check (end_date is null or end_date >= start_date),
  active boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not active or archived_at is null),
  unique (id, user_id)
);

create unique index gym_programs_one_active_per_user_idx
  on public.gym_programs(user_id) where active and archived_at is null;
create index gym_programs_user_updated_idx on public.gym_programs(user_id, updated_at desc);

create table public.gym_program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  position integer not null check (position between 0 and 6),
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes between 10 and 360),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, position) deferrable initially deferred,
  unique (id, user_id),
  foreign key (program_id, user_id) references public.gym_programs(id, user_id) on delete cascade
);

create index gym_program_days_user_program_idx on public.gym_program_days(user_id, program_id, position);

create table public.gym_program_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.gym_exercises(id) on delete restrict,
  position integer not null check (position between 0 and 49),
  working_sets integer not null check (working_sets between 1 and 20),
  rep_min integer check (rep_min is null or rep_min between 0 and 500),
  rep_max integer check (rep_max is null or rep_max between 0 and 500),
  target_seconds integer check (target_seconds is null or target_seconds between 1 and 86400),
  target_distance_meters numeric(9,2) check (target_distance_meters is null or target_distance_meters between 0 and 100000),
  target_rir numeric(3,1) check (target_rir is null or target_rir between 0 and 10),
  target_rpe numeric(3,1) check (target_rpe is null or target_rpe between 1 and 10),
  rest_seconds integer not null default 120 check (rest_seconds between 0 and 3600),
  start_weight_kg numeric(7,2) check (start_weight_kg is null or start_weight_kg between 0 and 1000),
  load_increment_kg numeric(6,2) check (load_increment_kg is null or load_increment_kg between 0 and 100),
  notes text check (notes is null or char_length(notes) <= 2000),
  warmup_note text check (warmup_note is null or char_length(warmup_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_day_id, position),
  unique (id, user_id),
  foreign key (program_day_id, user_id) references public.gym_program_days(id, user_id) on delete cascade,
  check (rep_min is null or rep_max is null or rep_max >= rep_min)
);

create index gym_program_exercises_user_day_idx on public.gym_program_exercises(user_id, program_day_id, position);
create index gym_program_exercises_exercise_idx on public.gym_program_exercises(exercise_id);

alter table public.planned_workouts
  add column gym_program_day_id uuid,
  add column gym_schedule_key text check (gym_schedule_key is null or char_length(gym_schedule_key) between 1 and 160);

alter table public.planned_workouts add constraint planned_workouts_gym_schedule_key_unique
  unique (user_id, gym_schedule_key);
create index planned_workouts_gym_program_day_idx
  on public.planned_workouts(gym_program_day_id)
  where gym_program_day_id is not null;

alter table public.planned_workouts add constraint planned_workouts_id_user_unique unique (id, user_id);
alter table public.planned_workouts add constraint planned_workouts_gym_program_day_owner_fk
  foreign key (gym_program_day_id, user_id) references public.gym_program_days(id, user_id)
  on delete set null (gym_program_day_id);

create table public.gym_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid,
  program_day_id uuid,
  planned_workout_id uuid unique,
  name text not null check (char_length(name) between 1 and 160),
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  notes text check (notes is null or char_length(notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'completed') = (ended_at is not null)),
  check (ended_at is null or ended_at >= started_at),
  unique (id, user_id),
  foreign key (program_id, user_id) references public.gym_programs(id, user_id) on delete set null (program_id),
  foreign key (program_day_id, user_id) references public.gym_program_days(id, user_id) on delete set null (program_day_id),
  foreign key (planned_workout_id, user_id) references public.planned_workouts(id, user_id) on delete set null (planned_workout_id)
);

create unique index gym_sessions_one_active_per_user_idx
  on public.gym_sessions(user_id) where status = 'active';
create index gym_sessions_user_started_idx on public.gym_sessions(user_id, started_at desc);
create index gym_sessions_program_idx on public.gym_sessions(user_id, program_id, started_at desc);

create table public.gym_session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references public.gym_exercises(id) on delete set null,
  program_exercise_id uuid,
  position integer not null check (position between 0 and 99),
  exercise_name_snapshot text not null check (char_length(exercise_name_snapshot) between 1 and 160),
  tracking_type_snapshot text not null check (tracking_type_snapshot in (
    'weight_reps', 'bodyweight_reps', 'weight_or_bodyweight_reps',
    'reps_only', 'time', 'weight_time', 'distance_time',
    'weight_distance', 'time_or_reps'
  )),
  target_sets integer check (target_sets is null or target_sets between 1 and 20),
  target_rep_min integer check (target_rep_min is null or target_rep_min between 0 and 500),
  target_rep_max integer check (target_rep_max is null or target_rep_max between 0 and 500),
  target_rir numeric(3,1) check (target_rir is null or target_rir between 0 and 10),
  target_rpe numeric(3,1) check (target_rpe is null or target_rpe between 1 and 10),
  rest_seconds integer not null default 120 check (rest_seconds between 0 and 3600),
  notes_snapshot text check (notes_snapshot is null or char_length(notes_snapshot) <= 2000),
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, position),
  unique (id, user_id),
  foreign key (session_id, user_id) references public.gym_sessions(id, user_id) on delete cascade,
  foreign key (program_exercise_id, user_id) references public.gym_program_exercises(id, user_id) on delete set null (program_exercise_id)
);

create index gym_session_exercises_user_session_idx on public.gym_session_exercises(user_id, session_id, position);
create index gym_session_exercises_exercise_history_idx on public.gym_session_exercises(user_id, exercise_id, created_at desc);

create table public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  client_key uuid not null default gen_random_uuid(),
  session_exercise_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  set_number integer not null check (set_number between 1 and 100),
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'amrap')),
  weight_kg numeric(7,2) check (weight_kg is null or weight_kg between 0 and 1000),
  repetitions integer check (repetitions is null or repetitions between 0 and 500),
  duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  distance_meters numeric(9,2) check (distance_meters is null or distance_meters between 0 and 100000),
  load_mode text check (load_mode is null or load_mode in ('bodyweight', 'added', 'assisted', 'external')),
  rir numeric(3,1) check (rir is null or rir between 0 and 10),
  rpe numeric(3,1) check (rpe is null or rpe between 1 and 10),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key),
  unique (session_exercise_id, set_number),
  foreign key (session_exercise_id, user_id) references public.gym_session_exercises(id, user_id) on delete cascade,
  check ((completed and completed_at is not null) or (not completed and completed_at is null)),
  check (load_mode is null or weight_kg is not null or load_mode = 'bodyweight')
);

create index gym_sets_user_session_exercise_idx on public.gym_sets(user_id, session_exercise_id, set_number);
create index gym_sets_completed_history_idx on public.gym_sets(user_id, completed_at desc) where completed;

alter table public.gym_equipment enable row level security;
alter table public.gym_exercises enable row level security;
alter table public.gym_exercise_equipment enable row level security;
alter table public.gym_exercise_favorites enable row level security;
alter table public.gym_programs enable row level security;
alter table public.gym_program_days enable row level security;
alter table public.gym_program_exercises enable row level security;
alter table public.gym_sessions enable row level security;
alter table public.gym_session_exercises enable row level security;
alter table public.gym_sets enable row level security;

create policy "gym_equipment_authenticated_read" on public.gym_equipment
  for select to authenticated using (true);
create policy "gym_exercises_visible_read" on public.gym_exercises
  for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "gym_custom_exercises_insert" on public.gym_exercises
  for insert to authenticated with check (owner_id = auth.uid() and external_id is null and source = 'custom');
create policy "gym_custom_exercises_update" on public.gym_exercises
  for update to authenticated using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and external_id is null and source = 'custom');
create policy "gym_custom_exercises_delete" on public.gym_exercises
  for delete to authenticated using (owner_id = auth.uid() and not active);

create policy "gym_exercise_equipment_visible_read" on public.gym_exercise_equipment
  for select to authenticated using (exists (
    select 1 from public.gym_exercises e
    where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
  ));
create policy "gym_custom_exercise_equipment_insert" on public.gym_exercise_equipment
  for insert to authenticated with check (exists (
    select 1 from public.gym_exercises e where e.id = exercise_id and e.owner_id = auth.uid()
  ));
create policy "gym_custom_exercise_equipment_delete" on public.gym_exercise_equipment
  for delete to authenticated using (exists (
    select 1 from public.gym_exercises e where e.id = exercise_id and e.owner_id = auth.uid()
  ));

create policy "gym_favorites_owner_all" on public.gym_exercise_favorites
  for all to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (
      select 1 from public.gym_exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
    )
  );
create policy "gym_programs_owner_all" on public.gym_programs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gym_program_days_owner_all" on public.gym_program_days
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gym_program_exercises_owner_all" on public.gym_program_exercises
  for all to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and exists (
      select 1 from public.gym_exercises e
      where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
    )
  );
create policy "gym_sessions_owner_all" on public.gym_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gym_session_exercises_owner_all" on public.gym_session_exercises
  for all to authenticated using (user_id = auth.uid()) with check (
    user_id = auth.uid() and (
      exercise_id is null or exists (
        select 1 from public.gym_exercises e
        where e.id = exercise_id and (e.owner_id is null or e.owner_id = auth.uid())
      )
    )
  );
create policy "gym_sets_owner_all" on public.gym_sets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke insert, update, delete on public.gym_equipment from anon, authenticated;
revoke insert, update, delete on public.gym_exercises from anon;
revoke insert, update, delete on public.gym_exercise_equipment from anon;

-- The importer intentionally uses service_role. Normal users cannot modify global rows.
grant select on public.gym_equipment, public.gym_exercises, public.gym_exercise_equipment to authenticated;
grant select, insert, update, delete on public.gym_exercise_favorites, public.gym_programs,
  public.gym_program_days, public.gym_program_exercises, public.gym_sessions,
  public.gym_session_exercises, public.gym_sets to authenticated;
grant insert, update, delete on public.gym_exercises, public.gym_exercise_equipment to authenticated;

-- Program, days and prescriptions are one aggregate and must never be partially saved.
-- SECURITY INVOKER keeps all normal RLS checks active while PostgreSQL provides one transaction.
create or replace function public.save_gym_program(p_program_id uuid, p_program jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_program_id uuid := p_program_id;
  v_day jsonb;
  v_exercise jsonb;
  v_day_id uuid;
  v_saved_day_ids uuid[] := '{}';
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce((p_program->>'active')::boolean, false) then
    update public.gym_programs
      set active = false, updated_at = now()
      where user_id = v_user_id and active and id is distinct from p_program_id;
  end if;

  if v_program_id is null then
    insert into public.gym_programs (
      user_id, name, description, goal, training_days_per_week,
      start_date, end_date, active
    ) values (
      v_user_id, p_program->>'name', p_program->>'description', p_program->>'goal',
      jsonb_array_length(p_program->'days'), (p_program->>'startDate')::date,
      nullif(p_program->>'endDate', '')::date, coalesce((p_program->>'active')::boolean, false)
    ) returning id into v_program_id;
  else
    update public.gym_programs set
      name = p_program->>'name',
      description = p_program->>'description',
      goal = p_program->>'goal',
      training_days_per_week = jsonb_array_length(p_program->'days'),
      start_date = (p_program->>'startDate')::date,
      end_date = nullif(p_program->>'endDate', '')::date,
      active = coalesce((p_program->>'active')::boolean, false),
      updated_at = now()
    where id = v_program_id and user_id = v_user_id;
    if not found then raise exception 'Program not found'; end if;
  end if;

  for v_day in select value from jsonb_array_elements(p_program->'days')
  loop
    v_day_id := nullif(v_day->>'id', '')::uuid;
    if v_day_id is null then
      insert into public.gym_program_days (
        program_id, user_id, name, position, estimated_duration_minutes, notes
      ) values (
        v_program_id, v_user_id, v_day->>'name', (v_day->>'position')::integer,
        nullif(v_day->>'estimatedDurationMinutes', '')::integer, v_day->>'notes'
      ) returning id into v_day_id;
    else
      update public.gym_program_days set
        name = v_day->>'name',
        position = (v_day->>'position')::integer,
        estimated_duration_minutes = nullif(v_day->>'estimatedDurationMinutes', '')::integer,
        notes = v_day->>'notes',
        updated_at = now()
      where id = v_day_id and program_id = v_program_id and user_id = v_user_id;
      if not found then raise exception 'Program day not found'; end if;
    end if;

    v_saved_day_ids := array_append(v_saved_day_ids, v_day_id);
    delete from public.gym_program_exercises
      where program_day_id = v_day_id and user_id = v_user_id;

    for v_exercise in select value from jsonb_array_elements(v_day->'exercises')
    loop
      insert into public.gym_program_exercises (
        program_day_id, user_id, exercise_id, position, working_sets,
        rep_min, rep_max, target_seconds, target_distance_meters, target_rir,
        target_rpe, rest_seconds, start_weight_kg, load_increment_kg, notes, warmup_note
      ) values (
        v_day_id, v_user_id, (v_exercise->>'exerciseId')::uuid,
        (v_exercise->>'position')::integer, (v_exercise->>'workingSets')::integer,
        nullif(v_exercise->>'repMin', '')::integer, nullif(v_exercise->>'repMax', '')::integer,
        nullif(v_exercise->>'targetSeconds', '')::integer,
        nullif(v_exercise->>'targetDistanceMeters', '')::numeric,
        nullif(v_exercise->>'targetRir', '')::numeric,
        nullif(v_exercise->>'targetRpe', '')::numeric,
        (v_exercise->>'restSeconds')::integer,
        nullif(v_exercise->>'startWeightKg', '')::numeric,
        nullif(v_exercise->>'loadIncrementKg', '')::numeric,
        v_exercise->>'notes', v_exercise->>'warmupNote'
      );
    end loop;
  end loop;

  delete from public.gym_program_days
    where program_id = v_program_id and user_id = v_user_id
      and not (id = any(v_saved_day_ids));

  return v_program_id;
end;
$$;

revoke all on function public.save_gym_program(uuid, jsonb) from public, anon;
grant execute on function public.save_gym_program(uuid, jsonb) to authenticated;

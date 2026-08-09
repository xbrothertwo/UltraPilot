-- Locking (protects a workout from being replaced by the next automatic plan
-- generation regardless of source) and a personal note distinct from the
-- (possibly auto-generated) description.
alter table public.planned_workouts
  add column if not exists locked boolean not null default false,
  add column if not exists personal_note text;

alter table public.planned_workouts
  add constraint planned_workouts_personal_note_check check (personal_note is null or char_length(personal_note) <= 1000);

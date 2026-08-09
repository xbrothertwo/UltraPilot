-- Sport, goal, variable length, a fifth phase, and pause/resume for training blocks.
alter table public.training_blocks
  add column if not exists sport_type text not null default 'cycling',
  add column if not exists goal text,
  add column if not exists week_count smallint not null default 4,
  add column if not exists paused_at timestamptz;

alter table public.training_blocks
  add constraint training_blocks_sport_type_check check (sport_type in ('cycling', 'running'));
alter table public.training_blocks
  add constraint training_blocks_goal_check check (goal is null or char_length(goal) between 1 and 500);
alter table public.training_blocks
  add constraint training_blocks_week_count_check check (week_count between 2 and 16);

alter table public.training_blocks drop constraint training_blocks_status_check;
alter table public.training_blocks add constraint training_blocks_status_check check (status in ('active', 'paused', 'completed', 'archived'));

drop index public.training_blocks_one_active_per_user;
create unique index training_blocks_one_active_per_user on public.training_blocks(user_id) where status in ('active', 'paused');

alter table public.training_block_weeks drop constraint training_block_weeks_week_number_check;
alter table public.training_block_weeks add constraint training_block_weeks_week_number_check check (week_number between 1 and 16);

alter table public.training_block_weeks drop constraint training_block_weeks_phase_check;
alter table public.training_block_weeks add constraint training_block_weeks_phase_check check (phase in ('foundation', 'build', 'load', 'peak', 'recovery'));

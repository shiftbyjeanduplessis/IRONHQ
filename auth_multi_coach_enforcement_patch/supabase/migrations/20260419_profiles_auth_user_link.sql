alter table if exists profiles
  add column if not exists auth_user_id uuid null;

create unique index if not exists profiles_auth_user_id_unique_idx
  on profiles(auth_user_id)
  where auth_user_id is not null;

create index if not exists athlete_program_assignments_coach_id_active_idx
  on athlete_program_assignments(coach_id, is_active);

-- Add edit locking, audit metadata, and updated_at support for optimistic concurrency.

alter table public.players
  add column if not exists updated_by uuid references auth.users(id);

alter table public.club_sessions
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.rounds
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists edit_lock_user_id uuid references auth.users(id),
  add column if not exists edit_lock_expires_at timestamptz;

alter table public.pairings
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.pairing_constraints
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.results
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.pairing_history
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.ladder_snapshots
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.ladder_snapshot_entries
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_players_set_updated_at on public.players;
create trigger trg_players_set_updated_at
before update on public.players
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_attendance_set_updated_at on public.attendance;
create trigger trg_attendance_set_updated_at
before update on public.attendance
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_pairings_set_updated_at on public.pairings;
create trigger trg_pairings_set_updated_at
before update on public.pairings
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_rounds_set_updated_at on public.rounds;
create trigger trg_rounds_set_updated_at
before update on public.rounds
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_club_sessions_set_updated_at on public.club_sessions;
create trigger trg_club_sessions_set_updated_at
before update on public.club_sessions
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_pairing_constraints_set_updated_at on public.pairing_constraints;
create trigger trg_pairing_constraints_set_updated_at
before update on public.pairing_constraints
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_results_set_updated_at on public.results;
create trigger trg_results_set_updated_at
before update on public.results
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_pairing_history_set_updated_at on public.pairing_history;
create trigger trg_pairing_history_set_updated_at
before update on public.pairing_history
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_ladder_snapshots_set_updated_at on public.ladder_snapshots;
create trigger trg_ladder_snapshots_set_updated_at
before update on public.ladder_snapshots
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_ladder_snapshot_entries_set_updated_at on public.ladder_snapshot_entries;
create trigger trg_ladder_snapshot_entries_set_updated_at
before update on public.ladder_snapshot_entries
for each row execute function public.set_row_updated_at();

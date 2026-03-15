-- Initial schema from docs/mvp-postgres-plan.md section "Postgres schema (v1)"

create extension if not exists pgcrypto;

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'player')),
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  active boolean not null default true,
  ladder_rank integer not null unique check (ladder_rank > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists player_accounts (
  player_id uuid not null references players(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (player_id, user_id)
);

create table if not exists club_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  status text not null check (status in ('open', 'pairing_ready', 'in_round', 'completed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (session_date)
);

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references club_sessions(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  status text not null check (status in ('draft', 'published', 'completed')),
  created_at timestamptz not null default now(),
  unique (session_id, round_number)
);

create table if not exists attendance (
  session_id uuid not null references club_sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  is_present boolean not null default false,
  is_available boolean not null default false,
  checked_in_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

create table if not exists pairings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  board_number integer not null check (board_number > 0),
  white_player_id uuid not null references players(id),
  black_player_id uuid not null references players(id),
  state text not null check (state in ('proposed', 'approved', 'published', 'finished')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (white_player_id <> black_player_id),
  unique (round_id, board_number),
  unique (round_id, white_player_id),
  unique (round_id, black_player_id)
);

create table if not exists pairing_constraints (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  constraint_type text not null check (constraint_type in ('force_pair', 'forbid_pair')),
  player_a_id uuid not null references players(id),
  player_b_id uuid not null references players(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (player_a_id <> player_b_id)
);

create table if not exists results (
  pairing_id uuid primary key references pairings(id) on delete cascade,
  result_code text not null check (result_code in ('1-0', '0-1', '1/2-1/2', 'void')),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  is_admin_override boolean not null default false
);

create table if not exists pairing_history (
  id bigserial primary key,
  played_at timestamptz not null default now(),
  session_id uuid not null references club_sessions(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  white_player_id uuid not null references players(id),
  black_player_id uuid not null references players(id),
  result_code text not null check (result_code in ('1-0', '0-1', '1/2-1/2', 'void'))
);

create index if not exists idx_pairing_history_white_played_at
  on pairing_history(white_player_id, played_at desc);
create index if not exists idx_pairing_history_black_played_at
  on pairing_history(black_player_id, played_at desc);

create table if not exists ladder_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references club_sessions(id) on delete cascade,
  round_id uuid references rounds(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists ladder_snapshot_entries (
  snapshot_id uuid not null references ladder_snapshots(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  rank_position integer not null check (rank_position > 0),
  primary key (snapshot_id, player_id),
  unique (snapshot_id, rank_position)
);

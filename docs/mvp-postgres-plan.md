# Chess Club MVP: Postgres Schema + Minimal API/Data Plan

This document describes a pragmatic **v1 architecture** where the backend is mainly for storage, while pairing generation and ladder updates run on the admin device.

## 1) Stack recommendation (v1)

- **Frontend**: React + TypeScript + Vite (PWA)
- **Backend storage/auth**: Supabase Postgres + Supabase Auth
- **Notifications/sharing**: WhatsApp share links from app UI
- **Server logic**: none required for v1 (optional in v2)

This keeps implementation fast and close to a spreadsheet workflow while preserving a clean upgrade path.

---

## 2) Postgres schema (v1)

> Notes:
> - Uses UUID primary keys.
> - Stores enough history for later improvements.
> - Keeps pairing algorithm out of the backend for now.

```sql
-- Optional helpers
create extension if not exists pgcrypto;

-- ===== USERS / ROLES =====
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin', 'player')),
  created_at timestamptz not null default now()
);

-- ===== PLAYERS =====
create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  active boolean not null default true,
  ladder_rank integer not null unique check (ladder_rank > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optional link from logged-in user -> player identity
create table if not exists player_accounts (
  player_id uuid not null references players(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (player_id, user_id)
);

-- ===== CLUB EVENINGS / ROUNDS =====
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

-- ===== ATTENDANCE =====
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

-- ===== PAIRINGS =====
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

-- ===== MANUAL CONSTRAINTS =====
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

-- ===== RESULTS =====
create table if not exists results (
  pairing_id uuid primary key references pairings(id) on delete cascade,
  result_code text not null check (result_code in ('1-0', '0-1', '1/2-1/2', 'void')),
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  is_admin_override boolean not null default false
);

-- ===== HISTORY FOR "PLAYED RECENTLY" =====
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

-- ===== LADDER SNAPSHOTS =====
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
```

---

## 3) Minimal API/data access plan (no custom backend required)

You can do this directly from the client using Supabase JS.

### Admin flows

1. **Open session**
   - Insert into `club_sessions` with `status = 'open'`.
2. **Check attendance**
   - Upsert into `attendance` for each player.
3. **Generate pairings locally (admin device)**
   - Read: `players`, `attendance`, recent `pairing_history`, `pairing_constraints`.
   - Compute proposal in client.
   - Write `rounds` row (`draft`) and `pairings` rows (`proposed`).
4. **Approve + publish**
   - Update `pairings.state = 'published'`, `rounds.status = 'published'`, `club_sessions.status = 'in_round'`.
5. **Enter/approve results**
   - Upsert `results` rows.
6. **Finalize round (still client-side in v1)**
   - Insert finished pairings into `pairing_history`.
   - Compute new ladder locally.
   - Save snapshot (`ladder_snapshots`, `ladder_snapshot_entries`).
   - Update `players.ladder_rank` in a transaction-like batch from client.

### Player flows

1. Read current published pairings for active round.
2. Submit result for own game (or request correction).
3. View ladder and past rounds.

---

## 4) Recommended Row Level Security (RLS) baseline

> Keep this simple for v1.

- Everyone authenticated can **read** players, sessions, rounds, published pairings, ladder snapshots.
- Only admins can:
  - manage sessions, attendance, constraints, pairings, finalize/override results.
- Players can:
  - submit or update results only for pairings where they are white/black.

Implementation pattern:
- `profiles.role = 'admin'` policy helper function.
- Join via `player_accounts` to verify the caller belongs to a pairing before allowing result submission.

---

## 5) Client-side reliability safeguards (important if logic stays on admin device)

Even without server functions, add these now:

1. **Single admin lock per round**
   - Add `rounds.edit_lock_user_id` + `edit_lock_expires_at` to avoid dual edits.
2. **Optimistic concurrency checks**
   - Use `updated_at` guards in updates for `players`, `attendance`, and `pairings`.
3. **Audit fields**
   - Always record `updated_by` and `updated_at`.
4. **Idempotent finalize action**
   - A finalize operation should no-op if round already completed.

---

## 6) Automatic regression testing plan

### Unit tests (fast)
- Pairing constraint validation (`force_pair`, `forbid_pair`).
- Ladder update behavior from result input.
- Recent-opponent penalty calculations.

### Integration tests
- Session lifecycle: open → pair → publish → result submit → finalize.
- Permission tests with admin vs player roles.

### E2E tests (Playwright)
- Admin publishes round; player sees pairing.
- Player submits result; admin finalizes; ladder updates.

### CI pipeline (GitHub Actions)
- On PR: install, lint, typecheck, unit/integration tests.
- On main: run e2e and build.

Example workflow skeleton:

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

---

## 7) Suggested v1-to-v2 upgrade path

When ready, move only two operations server-side (Edge Function or tiny API):

1. **Finalize round** (authoritative write of history + ladder).
2. **Ladder update** (single trusted transaction).

This gives better consistency without changing the data model.

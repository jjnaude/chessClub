-- Baseline RLS for Chess Club MVP.
-- Aligns with docs/mvp-postgres-plan.md guidance:
-- - authenticated read access for common data
-- - admin-only writes for session management tables
-- - players can only submit results for their own pairings through player_accounts

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.can_submit_own_result(target_pairing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pairings pr
    join public.player_accounts pa
      on pa.user_id = auth.uid()
     and pa.player_id in (pr.white_player_id, pr.black_player_id)
    where pr.id = target_pairing_id
  );
$$;

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.player_accounts enable row level security;
alter table public.club_sessions enable row level security;
alter table public.rounds enable row level security;
alter table public.attendance enable row level security;
alter table public.pairings enable row level security;
alter table public.pairing_constraints enable row level security;
alter table public.results enable row level security;
alter table public.pairing_history enable row level security;
alter table public.ladder_snapshots enable row level security;
alter table public.ladder_snapshot_entries enable row level security;

create policy "authenticated read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "users insert own profile"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users update own profile or admin"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "authenticated read players"
  on public.players
  for select
  to authenticated
  using (true);

create policy "admin write players"
  on public.players
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read player_accounts"
  on public.player_accounts
  for select
  to authenticated
  using (true);

create policy "admin write player_accounts"
  on public.player_accounts
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read club_sessions"
  on public.club_sessions
  for select
  to authenticated
  using (true);

create policy "admin write club_sessions"
  on public.club_sessions
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read rounds"
  on public.rounds
  for select
  to authenticated
  using (true);

create policy "admin write rounds"
  on public.rounds
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read attendance"
  on public.attendance
  for select
  to authenticated
  using (true);

create policy "admin write attendance"
  on public.attendance
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read pairings"
  on public.pairings
  for select
  to authenticated
  using (true);

create policy "admin write pairings"
  on public.pairings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read pairing_constraints"
  on public.pairing_constraints
  for select
  to authenticated
  using (true);

create policy "admin write pairing_constraints"
  on public.pairing_constraints
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read results"
  on public.results
  for select
  to authenticated
  using (true);

create policy "admin update delete results"
  on public.results
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin delete results"
  on public.results
  for delete
  to authenticated
  using (public.is_admin());

create policy "player submit own result"
  on public.results
  for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and (
      public.is_admin()
      or public.can_submit_own_result(pairing_id)
    )
  );

create policy "authenticated read pairing_history"
  on public.pairing_history
  for select
  to authenticated
  using (true);

create policy "admin write pairing_history"
  on public.pairing_history
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read ladder_snapshots"
  on public.ladder_snapshots
  for select
  to authenticated
  using (true);

create policy "admin write ladder_snapshots"
  on public.ladder_snapshots
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read ladder_snapshot_entries"
  on public.ladder_snapshot_entries
  for select
  to authenticated
  using (true);

create policy "admin write ladder_snapshot_entries"
  on public.ladder_snapshot_entries
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

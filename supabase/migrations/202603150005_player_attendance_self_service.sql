create or replace function public.can_manage_own_attendance(target_session_id uuid, target_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_accounts pa
    join public.club_sessions cs on cs.id = target_session_id
    where pa.user_id = auth.uid()
      and pa.player_id = target_player_id
      and cs.status in ('open', 'pairing_ready', 'in_round')
  );
$$;

drop policy if exists "player insert own attendance" on public.attendance;
create policy "player insert own attendance"
  on public.attendance
  for insert
  to authenticated
  with check (
    updated_by = auth.uid()
    and public.can_manage_own_attendance(session_id, player_id)
  );

drop policy if exists "player update own attendance" on public.attendance;
create policy "player update own attendance"
  on public.attendance
  for update
  to authenticated
  using (public.can_manage_own_attendance(session_id, player_id))
  with check (
    updated_by = auth.uid()
    and public.can_manage_own_attendance(session_id, player_id)
  );

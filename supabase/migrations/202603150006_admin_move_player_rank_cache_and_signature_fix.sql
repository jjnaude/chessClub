-- Ensure rank-move RPC exists in all environments and is discoverable by PostgREST.
-- Some environments can have migration history drift where a version is recorded but
-- function body/signature does not match expected runtime calls.

create or replace function public.admin_move_player_rank(
  target_player_id uuid,
  target_rank integer,
  actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_rank integer;
  max_rank integer;
  bounded_target integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can reorder player ranks.';
  end if;

  select ladder_rank
    into selected_rank
  from public.players
  where id = target_player_id;

  if selected_rank is null then
    raise exception 'Selected player could not be found.';
  end if;

  select coalesce(max(ladder_rank), 0)
    into max_rank
  from public.players;

  bounded_target := greatest(1, least(target_rank, max_rank));

  if selected_rank = bounded_target then
    return;
  end if;

  update public.players
  set ladder_rank = max_rank + 1,
      updated_by = coalesce(actor_id, auth.uid())
  where id = target_player_id;

  if bounded_target < selected_rank then
    update public.players
    set ladder_rank = ladder_rank + 1,
        updated_by = coalesce(actor_id, auth.uid())
    where ladder_rank >= bounded_target
      and ladder_rank < selected_rank;
  else
    update public.players
    set ladder_rank = ladder_rank - 1,
        updated_by = coalesce(actor_id, auth.uid())
    where ladder_rank <= bounded_target
      and ladder_rank > selected_rank;
  end if;

  update public.players
  set ladder_rank = bounded_target,
      updated_by = coalesce(actor_id, auth.uid())
  where id = target_player_id;
end;
$$;

-- Compatibility overload for clients/schema-caches that resolve argument order differently.
create or replace function public.admin_move_player_rank(
  actor_id uuid,
  target_player_id uuid,
  target_rank integer
)
returns void
language sql
security definer
set search_path = public
as $$
  select public.admin_move_player_rank(target_player_id, target_rank, actor_id);
$$;

grant execute on function public.admin_move_player_rank(uuid, integer, uuid) to authenticated;
grant execute on function public.admin_move_player_rank(uuid, uuid, integer) to authenticated;

-- Force PostgREST to reload schema cache so RPC becomes immediately visible.
notify pgrst, 'reload schema';

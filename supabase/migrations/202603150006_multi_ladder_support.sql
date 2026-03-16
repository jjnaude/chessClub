-- Support multiple ladders with per-ladder rankings and session-level ladder selection.

create table if not exists public.ladders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.ladder_rankings (
  ladder_id uuid not null references public.ladders(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rank_position integer not null check (rank_position > 0),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (ladder_id, player_id),
  unique (ladder_id, rank_position)
);

alter table public.club_sessions
  add column if not exists ladder_id uuid references public.ladders(id);

alter table public.ladder_snapshots
  add column if not exists ladder_id uuid references public.ladders(id);

insert into public.ladders (name, description, created_by, updated_by)
select 'Classic', 'Default ladder migrated from players.ladder_rank', auth.uid(), auth.uid()
where not exists (select 1 from public.ladders);

insert into public.ladder_rankings (ladder_id, player_id, rank_position)
select default_ladder.id, p.id, p.ladder_rank
from public.players p
cross join lateral (
  select l.id
  from public.ladders l
  order by l.created_at asc
  limit 1
) as default_ladder
where not exists (
  select 1
  from public.ladder_rankings lr
  where lr.ladder_id = default_ladder.id
);

update public.club_sessions cs
set ladder_id = default_ladder.id
from (
  select l.id
  from public.ladders l
  order by l.created_at asc
  limit 1
) as default_ladder
where cs.ladder_id is null;

alter table public.club_sessions
  alter column ladder_id set not null;

update public.ladder_snapshots ls
set ladder_id = cs.ladder_id
from public.club_sessions cs
where ls.session_id = cs.id
  and ls.ladder_id is null;

alter table public.ladder_snapshots
  alter column ladder_id set not null;

alter table public.ladders enable row level security;
alter table public.ladder_rankings enable row level security;

create policy "authenticated read ladders"
  on public.ladders
  for select
  to authenticated
  using (true);

create policy "admin write ladders"
  on public.ladders
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "authenticated read ladder_rankings"
  on public.ladder_rankings
  for select
  to authenticated
  using (true);

create policy "admin write ladder_rankings"
  on public.ladder_rankings
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop trigger if exists trg_ladders_set_updated_at on public.ladders;
create trigger trg_ladders_set_updated_at
before update on public.ladders
for each row execute function public.set_row_updated_at();

drop trigger if exists trg_ladder_rankings_set_updated_at on public.ladder_rankings;
create trigger trg_ladder_rankings_set_updated_at
before update on public.ladder_rankings
for each row execute function public.set_row_updated_at();

create or replace function public.admin_create_ladder_from_existing(
  ladder_name text,
  source_ladder_id uuid,
  ladder_description text default null,
  actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_ladder_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create ladders.';
  end if;

  if trim(coalesce(ladder_name, '')) = '' then
    raise exception 'Ladder name is required.';
  end if;

  insert into public.ladders (name, description, created_by, updated_by)
  values (trim(ladder_name), nullif(trim(coalesce(ladder_description, '')), ''), coalesce(actor_id, auth.uid()), coalesce(actor_id, auth.uid()))
  returning id into new_ladder_id;

  if source_ladder_id is not null then
    insert into public.ladder_rankings (ladder_id, player_id, rank_position, updated_by)
    select new_ladder_id, lr.player_id, lr.rank_position, coalesce(actor_id, auth.uid())
    from public.ladder_rankings lr
    where lr.ladder_id = source_ladder_id;
  else
    insert into public.ladder_rankings (ladder_id, player_id, rank_position, updated_by)
    select new_ladder_id, p.id, row_number() over (order by p.full_name asc), coalesce(actor_id, auth.uid())
    from public.players p
    where p.active = true;
  end if;

  return new_ladder_id;
end;
$$;

grant execute on function public.admin_create_ladder_from_existing(text, uuid, text, uuid) to authenticated;

create or replace function public.admin_move_ladder_player_rank(
  target_ladder_id uuid,
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
    raise exception 'Only admins can reorder ladder ranks.';
  end if;

  select rank_position
    into selected_rank
  from public.ladder_rankings
  where ladder_id = target_ladder_id
    and player_id = target_player_id;

  if selected_rank is null then
    raise exception 'Selected player could not be found in the selected ladder.';
  end if;

  select coalesce(max(rank_position), 0)
    into max_rank
  from public.ladder_rankings
  where ladder_id = target_ladder_id;

  bounded_target := greatest(1, least(target_rank, max_rank));

  if selected_rank = bounded_target then
    return;
  end if;

  update public.ladder_rankings
  set rank_position = max_rank + 1,
      updated_by = coalesce(actor_id, auth.uid())
  where ladder_id = target_ladder_id
    and player_id = target_player_id;

  if bounded_target < selected_rank then
    update public.ladder_rankings
    set rank_position = rank_position + 1,
        updated_by = coalesce(actor_id, auth.uid())
    where ladder_id = target_ladder_id
      and rank_position >= bounded_target
      and rank_position < selected_rank;
  else
    update public.ladder_rankings
    set rank_position = rank_position - 1,
        updated_by = coalesce(actor_id, auth.uid())
    where ladder_id = target_ladder_id
      and rank_position <= bounded_target
      and rank_position > selected_rank;
  end if;

  update public.ladder_rankings
  set rank_position = bounded_target,
      updated_by = coalesce(actor_id, auth.uid())
  where ladder_id = target_ladder_id
    and player_id = target_player_id;
end;
$$;

grant execute on function public.admin_move_ladder_player_rank(uuid, uuid, integer, uuid) to authenticated;

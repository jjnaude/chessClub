-- Manual constraint checks requested in task list.
-- Run after migration + seed + one round/pairing setup.

-- 1) Unique ladder_rank should reject duplicates.
begin;
  savepoint dup_ladder_rank;
  insert into players (full_name, ladder_rank) values ('Constraint Test Player', 1);
rollback to dup_ladder_rank;
commit;

-- 2) Unique per-round board/player should reject duplicate board assignment.
begin;
  with ctx as (
    select
      '11111111-1111-1111-1111-111111111111'::uuid as session_id,
      current_setting('app.admin_user_id', true)::uuid as admin_user_id
  ), new_round as (
    insert into rounds (id, session_id, round_number, status)
    select '22222222-2222-2222-2222-222222222221'::uuid, session_id, 1, 'draft'
    from ctx
    on conflict (id) do update set status = excluded.status
    returning id
  )
  insert into pairings (id, round_id, board_number, white_player_id, black_player_id, state, created_by)
  select
    '33333333-3333-3333-3333-333333333331'::uuid,
    id,
    1,
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000102'::uuid,
    'proposed',
    (select admin_user_id from ctx)
  from new_round
  on conflict (id) do nothing;

  savepoint dup_board;
  insert into pairings (round_id, board_number, white_player_id, black_player_id, state, created_by)
  values (
    '22222222-2222-2222-2222-222222222221'::uuid,
    1,
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000104'::uuid,
    'proposed',
    current_setting('app.admin_user_id', true)::uuid
  );
rollback to dup_board;

  savepoint dup_player;
  insert into pairings (round_id, board_number, white_player_id, black_player_id, state, created_by)
  values (
    '22222222-2222-2222-2222-222222222221'::uuid,
    2,
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000105'::uuid,
    'proposed',
    current_setting('app.admin_user_id', true)::uuid
  );
rollback to dup_player;
commit;

-- 3) result_code must be in allowed enum-like check set.
begin;
  savepoint invalid_result_code;
  insert into results (pairing_id, result_code, submitted_by)
  values (
    '33333333-3333-3333-3333-333333333331'::uuid,
    '2-0',
    current_setting('app.admin_user_id', true)::uuid
  );
rollback to invalid_result_code;
commit;

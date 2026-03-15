-- Seed data for local/dev usage.
-- Prerequisite: create an admin user in Supabase Auth (email/password) and set the user UUID
-- before running this file:
--   set app.admin_user_id = '<auth.users.id>';

begin;

-- Resolve admin auth user id from a runtime setting.
with admin_ctx as (
  select current_setting('app.admin_user_id', true)::uuid as admin_user_id
)
insert into profiles (user_id, display_name, role)
select admin_user_id, 'Club Admin', 'admin'
from admin_ctx
where admin_user_id is not null
on conflict (user_id) do update
set display_name = excluded.display_name,
    role = excluded.role;

insert into players (id, full_name, ladder_rank, active, notes)
values
  ('00000000-0000-0000-0000-000000000101', 'Alice Johnson', 1, true, null),
  ('00000000-0000-0000-0000-000000000102', 'Ben Carter', 2, true, null),
  ('00000000-0000-0000-0000-000000000103', 'Chloe Nguyen', 3, true, null),
  ('00000000-0000-0000-0000-000000000104', 'Daniel Kim', 4, true, null),
  ('00000000-0000-0000-0000-000000000105', 'Elena Rossi', 5, true, null),
  ('00000000-0000-0000-0000-000000000106', 'Farah Ahmed', 6, true, null),
  ('00000000-0000-0000-0000-000000000107', 'Gavin Patel', 7, true, null),
  ('00000000-0000-0000-0000-000000000108', 'Hannah Lee', 8, true, null),
  ('00000000-0000-0000-0000-000000000109', 'Isaac Wright', 9, true, null),
  ('00000000-0000-0000-0000-000000000110', 'Julia Silva', 10, true, null)
on conflict (id) do update
set full_name = excluded.full_name,
    ladder_rank = excluded.ladder_rank,
    active = excluded.active,
    notes = excluded.notes,
    updated_at = now();

-- One open club session.
with admin_ctx as (
  select current_setting('app.admin_user_id', true)::uuid as admin_user_id
)
insert into club_sessions (id, session_date, status, created_by)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  current_date,
  'open',
  admin_user_id
from admin_ctx
where admin_user_id is not null
on conflict (id) do update
set session_date = excluded.session_date,
    status = excluded.status,
    created_by = excluded.created_by;

commit;

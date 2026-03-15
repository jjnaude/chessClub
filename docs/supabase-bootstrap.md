# Supabase bootstrap checklist for Chess Club MVP

This repo includes reproducible SQL artifacts for the v1 Postgres schema and seed data:

- Migration: `supabase/migrations/202603150001_initial_schema.sql`
- Seed data: `supabase/seed.sql`
- Manual constraint checks: `supabase/manual_constraint_checks.sql`

---

## What you need first

1. A Supabase account with access to an organization.
2. `npx` available locally.
3. An **Auth admin user UUID** (`auth.users.id`) to use as the initial club admin in seed data.

---

## 1) Get `SUPABASE_ACCESS_TOKEN` (yes, you need this for CLI project creation/linking)

You can create a personal access token in Supabase dashboard:

1. Open Supabase dashboard.
2. Click your avatar (top-right) → **Account Settings**.
3. Go to **Access Tokens**.
4. Create a new token and copy it.

Set it in your shell before running CLI commands:

```bash
export SUPABASE_ACCESS_TOKEN='<your-token>'
```

Optional quick check:

```bash
npx supabase projects list
```

If this works, CLI auth is set.

---

## 2) Create a Supabase project + enable email/password auth

Create the project:

```bash
npx supabase projects create chess-club-mvp --org-id <ORG_ID> --db-password '<STRONG_DB_PASSWORD>'
```

Then in Supabase dashboard for the new project:

1. Open **Authentication → Providers → Email**.
2. Ensure **Enable Email provider** is on.
3. For local/dev convenience, optionally set **Confirm email** off.

Create the first admin auth account (email/password) in **Authentication → Users** (or by signing up through your app).

---

## 3) Link this repo to the project

```bash
npx supabase link --project-ref <PROJECT_REF>
```

You can find `<PROJECT_REF>` in the project URL (`https://supabase.com/dashboard/project/<PROJECT_REF>`).

---

## 4) Apply migration to dev database

```bash
npx supabase db push
```

This applies `supabase/migrations/202603150001_initial_schema.sql`.

---

## 5) Seed sample data (10 players, 1 admin profile, 1 open club session)

Get your admin user UUID from `auth.users.id`, then run:

```sql
set app.admin_user_id = '<ADMIN_AUTH_USER_UUID>';
\i supabase/seed.sql
```

Run this in Supabase SQL editor (paste the file content) or in `psql` connected to your project.

---

## 6) Verify key constraints manually

Run with the same `app.admin_user_id` set:

```sql
set app.admin_user_id = '<ADMIN_AUTH_USER_UUID>';
\i supabase/manual_constraint_checks.sql
```

Expected behavior: insert attempts fail at savepoints, proving enforcement of:

- unique `players.ladder_rank`
- unique per-round `pairings.board_number` and per-round player usage
- valid `results.result_code`

---

## Running this through Codex/agent environments

If you want an agent to execute Supabase CLI commands, make the token available to that environment first, e.g.:

```bash
export SUPABASE_ACCESS_TOKEN='<your-token>'
```

Then ask the agent to run `supabase projects create`, `supabase link`, and `supabase db push`.

Without this token (or without Docker for local Supabase), project creation and DB apply commands will fail.

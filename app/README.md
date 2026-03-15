# Chess Club App

React + TypeScript + Vite starter for a chess club dashboard.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Deploy to GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/deploy-gh-pages.yml` that builds `app/` and deploys to Pages on every push to `main`.

1. In GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push to `main` (or run the workflow manually from the **Actions** tab).

The workflow sets `VITE_BASE_PATH` to `/<repo-name>/` automatically so assets resolve on GitHub Pages. The app uses a hash router (`/#/...`) so deep links also work on static hosting.

## Features

- PWA enabled via `vite-plugin-pwa`
- Route pages: Login, Dashboard, Current Round, Ladder, Admin Session
- Shared UI primitives and page loading/error handling

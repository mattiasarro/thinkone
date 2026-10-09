# Agent instructions

## Branches and environments

- **`dev` is the working branch.** Develop on it, commit to it and push it. It deploys to the **dev** Railway project
  (`https://dev.thinkone.ai`, API `https://api.dev.thinkone.ai`).
- **`main` is production** (`https://prod.thinkone.ai`, API `https://api.prod.thinkone.ai`, Railway project `prod`).
  Do not push to `main` or deploy production unless the user explicitly asks for a production release.
- The two Railway projects share nothing (separate Postgres, bucket, secrets). The working directory is linked to
  the dev project (`railway status` shows project `dev`, environment `dev`), so plain `railway …` commands target dev.

## Ship every change (to dev)

When you make a change, commit it, push it and deploy it to dev. Do not stop at a local commit, and do not ask first.

1. Make sure you are on `dev` (`git branch --show-current`); if not, `git checkout dev` first.
2. Run the checks for what you touched and don't push if they fail:
   - backend: `cd backend && uv run pytest -q`
   - frontend: `cd frontend && npx tsc --noEmit && npx eslint .`
3. `git push origin dev`
4. Deploy the affected services in the dev project with `deploy/deploy.sh` (it deploys the pushed HEAD commit and
   waits for SUCCESS; pushing to GitHub does **not** trigger a deploy, and `railway redeploy --from-source` can build a
   stale commit):
   - `backend/**` changed: `deploy/deploy.sh api worker` (same image; the api start command runs migrations, so api
     goes first)
   - `frontend/**` changed: `deploy/deploy.sh frontend`
   - docs, `deploy/` or `data/` only: push, no deploy
5. Check it's healthy: `https://api.dev.thinkone.ai/api/health` returns ok and `https://dev.thinkone.ai/login`
   loads (Railway fallbacks while the custom DNS is pending: `https://api-dev-701f.up.railway.app`,
   `https://frontend-dev-3256.up.railway.app`). If a deploy fails, read its build/deploy logs
   (`railway logs -d <deployment id>`) and fix it rather than leaving dev broken.

## Releasing to production (only when asked)

1. `git checkout main && git merge --ff-only dev && git push origin main`, then `git checkout dev`.
2. `deploy/deploy.sh --prod api worker frontend` (only the services affected since the last release; api first).
3. Check `https://api.prod.thinkone.ai/api/health` and `https://prod.thinkone.ai/login`.

Service setup, env vars, project IDs and rollback are in `deploy/RAILWAY.md`.

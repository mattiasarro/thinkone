# Agent instructions

## Branches and environments

- **`dev` is the working branch.** Develop on it, commit to it and push it. It deploys to the **dev** Railway project
  (`https://dev.futureone.ai`, API `https://api.dev.futureone.ai`).
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
4. Redeploy the affected services in the dev project. Pushing to GitHub does **not** trigger a deploy:
   - `backend/**` changed: `railway redeploy --service api --from-source --yes`, then the same for `worker` (same image;
     the api start command runs migrations, so api goes first)
   - `frontend/**` changed: `railway redeploy --service frontend --from-source --yes`
   - docs or `data/` only: push, no redeploy
5. Wait for each deployment to reach SUCCESS and check it's healthy: `https://api.dev.futureone.ai/api/health`
   returns ok and `https://dev.futureone.ai/login` loads (Railway fallbacks: `https://api-dev-701f.up.railway.app`,
   `https://frontend-dev-3256.up.railway.app`). If a deploy fails, read its build/deploy logs and fix it rather
   than leaving dev broken.

## Releasing to production (only when asked)

1. `git checkout main && git merge --ff-only dev && git push origin main`, then `git checkout dev`.
2. Redeploy in the prod project, explicitly: `railway redeploy --service api --from-source --yes
   -p cd1607c6-06af-406c-bb80-1c7cf036c692 -e production`, then `worker`, then `frontend` (as affected).
3. Check `https://api.prod.thinkone.ai/api/health` and `https://prod.thinkone.ai/login`.

Service setup, env vars, project IDs and rollback are in `deploy/RAILWAY.md`.
